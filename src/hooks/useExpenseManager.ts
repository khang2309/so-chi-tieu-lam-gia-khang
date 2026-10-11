import { useState, useEffect, useMemo } from 'react';
import { Ledger, Wallet, Category, Transaction, TimeFilter } from '../types';
import { DEFAULT_LEDGERS, DEFAULT_WALLETS, DEFAULT_CATEGORIES, DEFAULT_TRANSACTIONS } from '../data/initialData';
import { isWithinTimeFilter } from '../utils/formatters';

const STORAGE_KEYS = {
  LEDGERS: 'sochitieu_ledgers_v2',
  WALLETS: 'sochitieu_wallets_v2',
  CATEGORIES: 'sochitieu_categories_v2',
  TRANSACTIONS: 'sochitieu_transactions_v2',
  ACTIVE_LEDGER: 'sochitieu_active_ledger_v2',
  ACTIVE_WALLET: 'sochitieu_active_wallet_v2',
  INCLUDE_ALL_WALLETS: 'sochitieu_include_all_wallets_v2',
  TIME_FILTER: 'sochitieu_time_filter_v2',
};

export function useExpenseManager() {
  // 1. Initial State from LocalStorage
  const [ledgers, setLedgers] = useState<Ledger[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEDGERS);
      return saved ? JSON.parse(saved) : DEFAULT_LEDGERS;
    } catch {
      return DEFAULT_LEDGERS;
    }
  });

  const [wallets, setWallets] = useState<Wallet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WALLETS);
      return saved ? JSON.parse(saved) : DEFAULT_WALLETS;
    } catch {
      return DEFAULT_WALLETS;
    }
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return saved ? JSON.parse(saved) : DEFAULT_TRANSACTIONS;
    } catch {
      return DEFAULT_TRANSACTIONS;
    }
  });

  const [activeLedgerId, setActiveLedgerId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_LEDGER) || 'ledger-personal';
  });

  const [activeWalletId, setActiveWalletId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_WALLET) || 'all';
  });

  const [includeAllWallets, setIncludeAllWallets] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INCLUDE_ALL_WALLETS);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [timeFilter, setTimeFilter] = useState<TimeFilter>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TIME_FILTER) as TimeFilter;
    return saved || 'month';
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  // 2. Persist to LocalStorage on changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LEDGERS, JSON.stringify(ledgers));
  }, [ledgers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));
  }, [wallets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LEDGER, activeLedgerId);
  }, [activeLedgerId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET, activeWalletId);
  }, [activeWalletId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INCLUDE_ALL_WALLETS, JSON.stringify(includeAllWallets));
  }, [includeAllWallets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TIME_FILTER, timeFilter);
  }, [timeFilter]);

  // 3. Computed Wallet Balances
  const walletBalances = useMemo(() => {
    const balanceMap: Record<string, number> = {};

    wallets.forEach((wallet) => {
      balanceMap[wallet.id] = wallet.initialBalance;
    });

    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        if (balanceMap[tx.walletId] !== undefined) {
          balanceMap[tx.walletId] -= tx.amount;
        }
      } else if (tx.type === 'income') {
        if (balanceMap[tx.walletId] !== undefined) {
          balanceMap[tx.walletId] += tx.amount;
        }
      } else if (tx.type === 'transfer') {
        if (balanceMap[tx.walletId] !== undefined) {
          balanceMap[tx.walletId] -= tx.amount;
        }
        if (tx.toWalletId && balanceMap[tx.toWalletId] !== undefined) {
          balanceMap[tx.toWalletId] += tx.amount;
        }
      }
    });

    return balanceMap;
  }, [wallets, transactions]);

  const totalAllWalletsBalance = useMemo(() => {
    return Object.values(walletBalances).reduce((acc, val) => acc + val, 0);
  }, [walletBalances]);

  // 4. Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Ledger filter
      if (activeLedgerId !== 'all' && tx.ledgerId !== activeLedgerId) {
        return false;
      }

      // Wallet filter: if NOT including all wallets and a specific wallet is selected
      if (!includeAllWallets && activeWalletId !== 'all') {
        if (tx.walletId !== activeWalletId && tx.toWalletId !== activeWalletId) {
          return false;
        }
      }

      // Time filter
      if (!isWithinTimeFilter(tx.date, timeFilter)) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const category = categories.find((c) => c.id === tx.categoryId);
        const categoryName = category ? category.name.toLowerCase() : '';
        const noteMatch = tx.note.toLowerCase().includes(query);
        const categoryMatch = categoryName.includes(query);
        const amountMatch = tx.amount.toString().includes(query);
        return noteMatch || categoryMatch || amountMatch;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, activeLedgerId, includeAllWallets, activeWalletId, timeFilter, typeFilter, searchQuery, categories]);

  // 5. Dashboard Statistics
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
      }
    });

    // Effective balance depending on whether viewing single wallet or all
    const displayBalance = (!includeAllWallets && activeWalletId !== 'all')
      ? (walletBalances[activeWalletId] || 0)
      : totalAllWalletsBalance;

    return {
      income,
      expense,
      net: income - expense,
      balance: displayBalance,
    };
  }, [filteredTransactions, includeAllWallets, activeWalletId, walletBalances, totalAllWalletsBalance]);

  // Category breakdown for expenses
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    let totalExpense = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'expense') {
        totalExpense += tx.amount;
        map[tx.categoryId] = (map[tx.categoryId] || 0) + tx.amount;
      }
    });

    return Object.entries(map)
      .map(([catId, amount]) => {
        const category = categories.find((c) => c.id === catId);
        return {
          categoryId: catId,
          name: category?.name || 'Khác',
          color: category?.color || '#a25832',
          icon: category?.icon || 'Tag',
          amount,
          percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, categories]);

  // 6. Action Handlers
  const addTransaction = (data: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = {
      ...data,
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [newTx, ...prev]);
    return newTx;
  };

  const addBatchTransactions = (items: Array<Omit<Transaction, 'id' | 'createdAt'>>) => {
    const newTxs: Transaction[] = items.map((data, idx) => ({
      ...data,
      id: 'tx-' + (Date.now() + idx) + '-' + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString(),
    }));
    setTransactions((prev) => [...newTxs, ...prev]);
    return newTxs;
  };

  const updateTransaction = (id: string, data: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, ...data } : tx))
    );
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  const addLedger = (data: Omit<Ledger, 'id' | 'createdAt'>) => {
    const newLedger: Ledger = {
      ...data,
      id: 'ledger-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setLedgers((prev) => [...prev, newLedger]);
    return newLedger;
  };

  const updateLedger = (id: string, data: Partial<Ledger>) => {
    setLedgers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...data } : l))
    );
  };

  const deleteLedger = (id: string) => {
    if (ledgers.length <= 1) {
      alert('Bạn phải giữ lại ít nhất một cuốn sổ!');
      return;
    }
    setLedgers((prev) => prev.filter((l) => l.id !== id));
    if (activeLedgerId === id) {
      const remaining = ledgers.filter((l) => l.id !== id);
      setActiveLedgerId(remaining[0]?.id || 'all');
    }
  };

  const addWallet = (data: Omit<Wallet, 'id' | 'createdAt'>) => {
    const newWallet: Wallet = {
      ...data,
      id: 'wallet-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setWallets((prev) => [...prev, newWallet]);
    return newWallet;
  };

  const updateWallet = (id: string, data: Partial<Wallet>) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...data } : w))
    );
  };

  const deleteWallet = (id: string) => {
    if (wallets.length <= 1) {
      alert('Bạn cần giữ lại ít nhất 1 nguồn tiền/ví!');
      return;
    }
    setWallets((prev) => prev.filter((w) => w.id !== id));
    if (activeWalletId === id) {
      setActiveWalletId('all');
    }
  };

  const transferMoney = (
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    note: string,
    date: string
  ) => {
    const fromW = wallets.find((w) => w.id === fromWalletId);
    const toW = wallets.find((w) => w.id === toWalletId);
    const defaultNote = `Chuyển tiền: ${fromW?.name || ''} ➜ ${toW?.name || ''}${note ? ' (' + note + ')' : ''}`;

    const newTx: Transaction = {
      id: 'tx-transfer-' + Date.now(),
      amount,
      type: 'transfer',
      date,
      categoryId: 'cat-other-expense',
      note: defaultNote,
      ledgerId: activeLedgerId === 'all' ? (ledgers[0]?.id || 'ledger-personal') : activeLedgerId,
      walletId: fromWalletId,
      toWalletId,
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);
  };

  const addCategory = (data: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...data,
      id: 'cat-' + Date.now(),
    };
    setCategories((prev) => [...prev, newCat]);
    return newCat;
  };

  const updateCategory = (id: string, data: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const resetToDefaults = () => {
    if (window.confirm('Bạn có chắc chắn muốn đặt lại dữ liệu mẫu ban đầu? Mọi thay đổi hiện tại sẽ được thay thế.')) {
      setLedgers(DEFAULT_LEDGERS);
      setWallets(DEFAULT_WALLETS);
      setCategories(DEFAULT_CATEGORIES);
      setTransactions(DEFAULT_TRANSACTIONS);
      setActiveLedgerId('ledger-personal');
      setActiveWalletId('all');
      setIncludeAllWallets(true);
      setTimeFilter('month');
    }
  };

  const exportDataJson = () => {
    const data = {
      ledgers,
      wallets,
      categories,
      transactions,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `so-chi-tieu-lam-gia-khang-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDataJson = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.ledgers && parsed.wallets && parsed.transactions) {
        setLedgers(parsed.ledgers);
        setWallets(parsed.wallets);
        if (parsed.categories) setCategories(parsed.categories);
        setTransactions(parsed.transactions);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Lỗi nhập dữ liệu:', e);
      return false;
    }
  };

  return {
    ledgers,
    wallets,
    categories,
    transactions,
    activeLedgerId,
    setActiveLedgerId,
    activeWalletId,
    setActiveWalletId,
    includeAllWallets,
    setIncludeAllWallets,
    timeFilter,
    setTimeFilter,
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    walletBalances,
    totalAllWalletsBalance,
    filteredTransactions,
    stats,
    categoryBreakdown,
    addTransaction,
    addBatchTransactions,
    updateTransaction,
    deleteTransaction,
    addLedger,
    updateLedger,
    deleteLedger,
    addWallet,
    updateWallet,
    deleteWallet,
    transferMoney,
    addCategory,
    updateCategory,
    deleteCategory,
    resetToDefaults,
    exportDataJson,
    importDataJson,
  };
}
