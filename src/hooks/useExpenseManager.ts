import { useState, useEffect, useMemo, useRef } from 'react';
import { Ledger, Wallet, Category, Transaction, TimeFilter } from '../types';
import { DEFAULT_LEDGERS, DEFAULT_WALLETS, DEFAULT_CATEGORIES, DEFAULT_TRANSACTIONS } from '../data/initialData';
import { isWithinTimeFilter } from '../utils/formatters';
import { auth } from '../firebase';
import {
  syncTransactionToFirestore,
  syncWalletToFirestore,
  removeWalletFromFirestore,
  syncLedgerToFirestore,
  removeLedgerFromFirestore,
  syncCategoryToFirestore,
  removeCategoryFromFirestore,
  subscribeToUserFirestoreData,
  mergeEntitiesById,
  performTwoWaySync,
  sanitizeData,
  clearAllUserFirestoreData,
} from '../utils/firestoreSync';
import { saveAndShareFile, utf8ToBase64 } from '../utils/fileExporter';

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
  // 1. Initial State from LocalStorage (được deep sanitize triệt để loại bỏ undefined)
  const [ledgers, setLedgers] = useState<Ledger[]>(() => {
    try {
      if (localStorage.getItem('user_is_logged_out') === 'true') return [];
      const saved = localStorage.getItem(STORAGE_KEYS.LEDGERS);
      return saved ? sanitizeData(JSON.parse(saved)) : DEFAULT_LEDGERS;
    } catch {
      return DEFAULT_LEDGERS;
    }
  });

  const [wallets, setWallets] = useState<Wallet[]>(() => {
    try {
      if (localStorage.getItem('user_is_logged_out') === 'true') return [];
      const saved = localStorage.getItem(STORAGE_KEYS.WALLETS);
      if (saved) {
        const parsed: Wallet[] = sanitizeData(JSON.parse(saved));
        if (parsed.length > 0 && !parsed.some((w) => w.isDefault)) {
          parsed[0].isDefault = true;
        }
        return parsed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
      return DEFAULT_WALLETS;
    } catch {
      return DEFAULT_WALLETS;
    }
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      if (localStorage.getItem('user_is_logged_out') === 'true') return DEFAULT_CATEGORIES;
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (saved) {
        const parsed = sanitizeData(JSON.parse(saved));
        return parsed.map((cat: Category) =>
          cat.id === 'cat-gas' && (cat.name.includes('Yamaha Janus') || cat.name === 'Xăng xe (Yamaha Janus)')
            ? { ...cat, name: 'Xăng xe' }
            : cat
        );
      }
      return DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      if (localStorage.getItem('user_is_logged_out') === 'true') return [];
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return saved ? sanitizeData(JSON.parse(saved)) : DEFAULT_TRANSACTIONS;
    } catch {
      return DEFAULT_TRANSACTIONS;
    }
  });

  const [activeLedgerId, setActiveLedgerId] = useState<string>(() => {
    try {
      if (localStorage.getItem('user_is_logged_out') === 'true') return 'all';
      const savedLedgersRaw = localStorage.getItem(STORAGE_KEYS.LEDGERS);
      if (savedLedgersRaw) {
        const parsedLedgers: Ledger[] = JSON.parse(savedLedgersRaw);
        const defaultL = parsedLedgers.find((l) => l.isDefault);
        if (defaultL) return defaultL.id;
      }
    } catch (_) {}
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_LEDGER) || 'all';
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

  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const autoSyncRunningRef = useRef(false);
  const activeUidRef = useRef<string | null>(null);
  const unsubDataRef = useRef<any>(null);
  const deletedWalletIdsRef = useRef<Set<string>>(new Set());
  const deletedLedgerIdsRef = useRef<Set<string>>(new Set());
  const deletedCategoryIdsRef = useRef<Set<string>>(new Set());
  const resetPromiseRef = useRef<Promise<void> | null>(null);

  // Hàm kéo ngay lập tức toàn bộ dữ liệu từ Cloud về và cập nhật vào State qua 2-Way Delta Diff Sync
  const fetchAndSyncUserData = async (targetUid?: string) => {
    const uid = targetUid || auth?.currentUser?.uid;
    if (!uid) return;
    return runAutoSync(uid);
  };

  // Hàm tự động đồng bộ 2 chiều (Auto-Sync) ngầm khi đăng nhập (Delta Diff Sync Siêu Tốc)
  const runAutoSync = async (uid: string) => {
    if (autoSyncRunningRef.current) return;
    if (activeUidRef.current !== uid || auth?.currentUser?.uid !== uid) return;
    if (resetPromiseRef.current) {
      try {
        await resetPromiseRef.current;
      } catch (_) {}
    }
    if (activeUidRef.current !== uid || auth?.currentUser?.uid !== uid) return;
    autoSyncRunningRef.current = true;
    setIsAutoSyncing(true);

    try {
      // Đọc dữ liệu local mới nhất từ LocalStorage để không bị stale closure
      let localTxs: Transaction[] = transactions;
      let localWallets: Wallet[] = wallets;
      let localLedgers: Ledger[] = ledgers;
      let localCategories: Category[] = categories;

      try {
        const rawTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
        if (rawTxs) localTxs = JSON.parse(rawTxs);
        const rawW = localStorage.getItem(STORAGE_KEYS.WALLETS);
        if (rawW) localWallets = JSON.parse(rawW);
        const rawL = localStorage.getItem(STORAGE_KEYS.LEDGERS);
        if (rawL) localLedgers = JSON.parse(rawL);
        const rawC = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
        if (rawC) localCategories = JSON.parse(rawC);
      } catch (err) {
        console.warn('Lỗi phân tích LocalStorage khi Auto-Sync:', err);
      }

      // Sạch hóa dữ liệu tuyệt đối trước khi đồng bộ (xóa sạch mọi undefined)
      const cleanPayload = {
        transactions: sanitizeData(localTxs || []),
        wallets: sanitizeData(
          (localWallets || []).filter((w) => !deletedWalletIdsRef.current.has(w.id))
        ),
        ledgers: sanitizeData(
          (localLedgers || []).filter((l) => !deletedLedgerIdsRef.current.has(l.id))
        ),
        categories: sanitizeData(
          (localCategories || []).filter((c) => !deletedCategoryIdsRef.current.has(c.id))
        ),
      };

      const res = await performTwoWaySync(uid, cleanPayload, { preferCloudLists: true });
      if (activeUidRef.current !== uid || auth?.currentUser?.uid !== uid) return;

      if (res.success && res.mergedData) {
        const cleanMerged = sanitizeData(res.mergedData);
        const finalWallets = cleanMerged.wallets.filter(
          (w: Wallet) => !deletedWalletIdsRef.current.has(w.id)
        );
        const finalLedgers = cleanMerged.ledgers.filter(
          (l: Ledger) => !deletedLedgerIdsRef.current.has(l.id)
        );
        const finalCategories = cleanMerged.categories.filter(
          (c: Category) => !deletedCategoryIdsRef.current.has(c.id)
        );

        setTransactions(cleanMerged.transactions);
        setWallets(finalWallets);
        setLedgers(finalLedgers);
        setCategories(finalCategories);
        if (finalLedgers.length > 0) {
          const defaultL = finalLedgers.find((l: Ledger) => l.isDefault) || finalLedgers[0];
          setActiveLedgerId((prev) =>
            prev === 'all' || !finalLedgers.some((l: Ledger) => l.id === prev)
              ? defaultL.id
              : prev
          );
        }

        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(cleanMerged.transactions));
        localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(finalWallets));
        localStorage.setItem(STORAGE_KEYS.LEDGERS, JSON.stringify(finalLedgers));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(finalCategories));
      }
    } catch (err) {
      console.warn('Lỗi Auto-Sync:', err);
    } finally {
      setIsAutoSyncing(false);
      autoSyncRunningRef.current = false;
    }
  };

  // Đồng bộ thời gian thực từ Firestore qua onSnapshot & Tự động đồng bộ khi Đăng nhập
  useEffect(() => {
    if (!auth) return;

    const unsubAuth = auth.onAuthStateChanged(async (currentUser: any) => {
      // Huỷ bỏ bộ lắng nghe cũ nếu có
      if (unsubDataRef.current) {
        unsubDataRef.current();
        unsubDataRef.current = null;
      }

      if (currentUser?.uid) {
        const uid = currentUser.uid;
        activeUidRef.current = uid;
        deletedWalletIdsRef.current.clear();
        deletedLedgerIdsRef.current.clear();
        deletedCategoryIdsRef.current.clear();

        // 1. Gắn bộ lắng nghe thay đổi thời gian thực ngay lập tức
        unsubDataRef.current = subscribeToUserFirestoreData(uid, {
          onTransactions: (fireTxs, isEmpty) => {
            if (activeUidRef.current !== uid || auth?.currentUser?.uid !== uid) return;
            if (!isEmpty) {
              setTransactions((prev) => {
                const merged = mergeEntitiesById(prev, fireTxs);
                merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                return sanitizeData(merged);
              });
            }
          },
          onWallets: (fireWallets, isEmpty) => {
            if (activeUidRef.current !== uid || auth?.currentUser?.uid !== uid) return;
            if (!isEmpty) {
              const filtered = fireWallets.filter(
                (w) => !deletedWalletIdsRef.current.has(w.id)
              );
              if (filtered.length > 0) {
                setWallets(sanitizeData(filtered));
              }
            }
          },
          onLedgers: (fireLedgers, isEmpty) => {
            if (activeUidRef.current !== uid || auth?.currentUser?.uid !== uid) return;
            if (!isEmpty) {
              const filtered = fireLedgers.filter(
                (l) => !deletedLedgerIdsRef.current.has(l.id)
              );
              if (filtered.length > 0) {
                setLedgers(sanitizeData(filtered));
              }
            }
          },
          onCategories: (fireCategories, isEmpty) => {
            if (activeUidRef.current !== uid || auth?.currentUser?.uid !== uid) return;
            if (!isEmpty) {
              const filtered = fireCategories.filter(
                (c) => !deletedCategoryIdsRef.current.has(c.id)
              );
              if (filtered.length > 0) {
                setCategories(sanitizeData(filtered));
              }
            }
          },
        });

        // 3. Tự động đồng bộ 2 chiều ngầm
        runAutoSync(uid);
      } else {
        // NGƯỜI DÙNG ĐÃ ĐĂNG XUẤT (currentUser == null)
        activeUidRef.current = null;
        if (unsubDataRef.current) {
          unsubDataRef.current();
          unsubDataRef.current = null;
        }

        // Xóa trắng hoàn toàn Giao dịch (0 giao dịch), Ví (0 ví) và Sổ (0 sổ) khi đã đăng xuất
        if (localStorage.getItem('user_is_logged_out') === 'true') {
          setTransactions([]);
          setWallets([]);
          setLedgers([]);
          setCategories(DEFAULT_CATEGORIES);
          setActiveLedgerId('all');
          setActiveWalletId('all');

          try {
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, '[]');
            localStorage.setItem(STORAGE_KEYS.WALLETS, '[]');
            localStorage.setItem(STORAGE_KEYS.LEDGERS, '[]');
            localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
            localStorage.setItem(STORAGE_KEYS.ACTIVE_LEDGER, 'all');
            localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET, 'all');
          } catch (_) {}
        }
      }
    });

    return () => {
      if (unsubDataRef.current) {
        unsubDataRef.current();
        unsubDataRef.current = null;
      }
      unsubAuth();
    };
  }, []);

  // 3. Computed Wallet Balances
  const walletBalances = useMemo(() => {
    const balanceMap: Record<string, number> = {};

    wallets.forEach((wallet) => {
      balanceMap[wallet.id] = wallet.initialBalance;
    });

    transactions.filter((tx) => !tx.isDeleted).forEach((tx) => {
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
      // Ẩn các giao dịch đã xóa mềm (Soft delete)
      if (tx.isDeleted) return false;

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
    const now = new Date().toISOString();
    const newTx: Transaction = sanitizeData({
      ...data,
      toWalletId: data.type === 'transfer' ? (data.toWalletId || null) : null,
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      createdAt: now,
      updatedAt: now,
    });
    setTransactions((prev) => [newTx, ...prev]);
    if (auth?.currentUser?.uid) {
      syncTransactionToFirestore(auth.currentUser.uid, newTx);
    }
    return newTx;
  };

  const addBatchTransactions = (items: Array<Omit<Transaction, 'id' | 'createdAt'>>) => {
    const now = new Date().toISOString();
    const newTxs: Transaction[] = sanitizeData(
      items.map((data, idx) => ({
        ...data,
        toWalletId: data.type === 'transfer' ? (data.toWalletId || null) : null,
        id: 'tx-' + (Date.now() + idx) + '-' + Math.random().toString(36).substr(2, 4),
        createdAt: now,
        updatedAt: now,
      }))
    );
    setTransactions((prev) => [...newTxs, ...prev]);
    if (auth?.currentUser?.uid) {
      newTxs.forEach((tx) => syncTransactionToFirestore(auth.currentUser.uid, tx));
    }
    return newTxs;
  };

  const updateTransaction = (id: string, data: Partial<Transaction>) => {
    const now = new Date().toISOString();
    setTransactions((prev) => {
      const updated = prev.map((tx) => {
        if (tx.id === id) {
          const merged = { ...tx, ...data, updatedAt: now };
          if (merged.type !== 'transfer') {
            merged.toWalletId = null;
          }
          return sanitizeData(merged);
        }
        return tx;
      });
      const target = updated.find((tx) => tx.id === id);
      if (target && auth?.currentUser?.uid) {
        syncTransactionToFirestore(auth.currentUser.uid, target);
      }
      return updated;
    });
  };

  const deleteTransaction = (id: string) => {
    const now = new Date().toISOString();
    setTransactions((prev) => {
      const updated = prev.map((tx) =>
        tx.id === id ? sanitizeData({ ...tx, isDeleted: true, updatedAt: now }) : tx
      );
      const target = updated.find((tx) => tx.id === id);
      if (target && auth?.currentUser?.uid) {
        // Đồng bộ giao dịch đã đánh dấu xóa mềm lên Firestore
        syncTransactionToFirestore(auth.currentUser.uid, target);
      }
      return updated;
    });
  };

  const addLedger = (data: Omit<Ledger, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString();
    const shouldBeDefault = Boolean(data.isDefault) || ledgers.length === 0;
    const newLedger: Ledger = sanitizeData({
      ...data,
      isDefault: shouldBeDefault,
      order: ledgers.length,
      id: 'ledger-' + Date.now(),
      createdAt: now,
      updatedAt: now,
    });
    setLedgers((prev) => {
      const base = shouldBeDefault
        ? prev.map((l) => sanitizeData({ ...l, isDefault: false, updatedAt: now }))
        : prev;
      const next = [...base, newLedger];
      const uid = auth?.currentUser?.uid;
      if (uid) {
        if (shouldBeDefault) {
          next.forEach((l) => syncLedgerToFirestore(uid, l));
        } else {
          syncLedgerToFirestore(uid, newLedger);
        }
      }
      return next;
    });
    if (shouldBeDefault) {
      setActiveLedgerId(newLedger.id);
    }
    return newLedger;
  };

  const updateLedger = (id: string, data: Partial<Ledger>) => {
    const now = new Date().toISOString();
    setLedgers((prev) => {
      const updated = prev.map((l) => {
        if (l.id === id) {
          return sanitizeData({ ...l, ...data, updatedAt: now });
        }
        if (data.isDefault) {
          return sanitizeData({ ...l, isDefault: false, updatedAt: now });
        }
        return l;
      });
      const uid = auth?.currentUser?.uid;
      if (uid) {
        if (data.isDefault) {
          updated.forEach((l) => syncLedgerToFirestore(uid, l));
        } else {
          const target = updated.find((l) => l.id === id);
          if (target) syncLedgerToFirestore(uid, target);
        }
      }
      return updated;
    });
    if (data.isDefault) {
      setActiveLedgerId(id);
    }
  };

  const setDefaultLedger = (id: string) => {
    const now = new Date().toISOString();
    setLedgers((prev) => {
      const updated = prev.map((l) =>
        sanitizeData({
          ...l,
          isDefault: l.id === id,
          updatedAt: now,
        })
      );
      try {
        localStorage.setItem(STORAGE_KEYS.LEDGERS, JSON.stringify(updated));
      } catch (_) {}
      const uid = auth?.currentUser?.uid;
      if (uid) {
        updated.forEach((l) => syncLedgerToFirestore(uid, l));
      }
      return updated;
    });
    setActiveLedgerId(id);
  };

  const reorderLedgers = (reordered: Ledger[]) => {
    const now = new Date().toISOString();
    const updated = reordered.map((l, idx) =>
      sanitizeData({
        ...l,
        order: idx,
        updatedAt: now,
      })
    );
    setLedgers(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.LEDGERS, JSON.stringify(updated));
    } catch (_) {}
    const uid = auth?.currentUser?.uid;
    if (uid) {
      updated.forEach((l) => syncLedgerToFirestore(uid, l));
    }
  };

  const deleteLedger = (id: string) => {
    deletedLedgerIdsRef.current.add(id);
    const now = new Date().toISOString();
    let remaining = ledgers.filter((l) => l.id !== id);
    if (remaining.length > 0 && !remaining.some((l) => l.isDefault)) {
      remaining = remaining.map((l, idx) =>
        idx === 0 ? sanitizeData({ ...l, isDefault: true, updatedAt: now }) : l
      );
    }
    setLedgers(remaining);
    try {
      localStorage.setItem(STORAGE_KEYS.LEDGERS, JSON.stringify(remaining));
    } catch (_) {}

    const uid = auth?.currentUser?.uid;
    if (uid) {
      removeLedgerFromFirestore(uid, id);
      remaining.forEach((l) => syncLedgerToFirestore(uid, l));
    }
    if (activeLedgerId === id || remaining.length === 0) {
      const defaultL = remaining.find((l) => l.isDefault) || remaining[0];
      setActiveLedgerId(defaultL?.id || 'all');
    }
  };

  const addWallet = (data: Omit<Wallet, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString();
    const shouldBeDefault = Boolean(data.isDefault) || wallets.length === 0;
    const newWallet: Wallet = sanitizeData({
      ...data,
      isDefault: shouldBeDefault,
      order: wallets.length,
      id: 'wallet-' + Date.now(),
      createdAt: now,
      updatedAt: now,
    });
    setWallets((prev) => {
      const updated = shouldBeDefault
        ? prev.map((w) => sanitizeData({ ...w, isDefault: false, updatedAt: now }))
        : prev;
      return [...updated, newWallet];
    });
    const uid = auth?.currentUser?.uid;
    if (uid) {
      if (shouldBeDefault) {
        wallets.forEach((w) => syncWalletToFirestore(uid, { ...w, isDefault: false }));
      }
      syncWalletToFirestore(uid, newWallet);
    }
    return newWallet;
  };

  const updateWallet = (id: string, data: Partial<Wallet>) => {
    const now = new Date().toISOString();
    setWallets((prev) => {
      const updated = prev.map((w) => {
        if (w.id === id) {
          return sanitizeData({ ...w, ...data, updatedAt: now });
        }
        if (data.isDefault) {
          return sanitizeData({ ...w, isDefault: false, updatedAt: now });
        }
        return w;
      });
      const uid = auth?.currentUser?.uid;
      if (uid) {
        if (data.isDefault) {
          updated.forEach((w) => syncWalletToFirestore(uid, w));
        } else {
          const target = updated.find((w) => w.id === id);
          if (target) syncWalletToFirestore(uid, target);
        }
      }
      return updated;
    });
  };

  const setDefaultWallet = (id: string) => {
    const now = new Date().toISOString();
    setWallets((prev) => {
      const updated = prev.map((w) =>
        sanitizeData({
          ...w,
          isDefault: w.id === id,
          updatedAt: now,
        })
      );
      try {
        localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(updated));
      } catch (_) {}
      const uid = auth?.currentUser?.uid;
      if (uid) {
        updated.forEach((w) => syncWalletToFirestore(uid, w));
      }
      return updated;
    });
  };

  const reorderWallets = (reordered: Wallet[]) => {
    const now = new Date().toISOString();
    const updated = reordered.map((w, idx) =>
      sanitizeData({
        ...w,
        order: idx,
        updatedAt: now,
      })
    );
    setWallets(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(updated));
    } catch (_) {}
    const uid = auth?.currentUser?.uid;
    if (uid) {
      updated.forEach((w) => syncWalletToFirestore(uid, w));
    }
  };

  const deleteWallet = (id: string) => {
    const now = new Date().toISOString();
    deletedWalletIdsRef.current.add(id);
    let remaining = wallets.filter((w) => w.id !== id);
    if (remaining.length > 0 && !remaining.some((w) => w.isDefault)) {
      remaining = remaining.map((w, idx) =>
        idx === 0 ? sanitizeData({ ...w, isDefault: true, updatedAt: now }) : w
      );
    }
    setWallets(remaining);
    try {
      localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(remaining));
    } catch (_) {}

    const uid = auth?.currentUser?.uid;
    if (uid) {
      removeWalletFromFirestore(uid, id);
      remaining.forEach((w) => syncWalletToFirestore(uid, w));
    }
    if (activeWalletId === id || remaining.length === 0) {
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
    const now = new Date().toISOString();
    const fallbackLedger = ledgers.find((l) => l.isDefault) || ledgers[0];

    const newTx: Transaction = sanitizeData({
      id: 'tx-transfer-' + Date.now(),
      amount,
      type: 'transfer',
      date,
      categoryId: 'cat-other-expense',
      note: defaultNote,
      ledgerId: activeLedgerId === 'all' ? (fallbackLedger?.id || 'ledger-personal') : activeLedgerId,
      walletId: fromWalletId,
      toWalletId,
      createdAt: now,
      updatedAt: now,
    });

    setTransactions((prev) => [newTx, ...prev]);
    if (auth?.currentUser?.uid) {
      syncTransactionToFirestore(auth.currentUser.uid, newTx);
    }
  };

  const addCategory = (data: Omit<Category, 'id'>) => {
    const now = new Date().toISOString();
    const newCat: Category = sanitizeData({
      ...data,
      id: 'cat-' + Date.now(),
      createdAt: now,
      updatedAt: now,
    });
    setCategories((prev) => [...prev, newCat]);
    if (auth?.currentUser?.uid) {
      syncCategoryToFirestore(auth.currentUser.uid, newCat);
    }
    return newCat;
  };

  const updateCategory = (id: string, data: Partial<Category>) => {
    const now = new Date().toISOString();
    setCategories((prev) => {
      const updated = prev.map((c) => (c.id === id ? sanitizeData({ ...c, ...data, updatedAt: now }) : c));
      const target = updated.find((c) => c.id === id);
      if (target && auth?.currentUser?.uid) {
        syncCategoryToFirestore(auth.currentUser.uid, target);
      }
      return updated;
    });
  };

  const deleteCategory = (id: string) => {
    deletedCategoryIdsRef.current.add(id);
    const remaining = categories.filter((c) => c.id !== id);
    setCategories(remaining);
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(remaining));
    } catch (_) {}

    const uid = auth?.currentUser?.uid;
    if (uid) {
      removeCategoryFromFirestore(uid, id);
      remaining.forEach((c) => syncCategoryToFirestore(uid, c));
    }
  };

  const resetToDefaults = async () => {
    if (
      window.confirm(
        'Bạn có chắc chắn muốn ĐẶT LẠI TẤT CẢ? Toàn bộ giao dịch, ví tiền và sổ chi tiêu sẽ bị xóa sạch hoàn toàn (không còn ví hay sổ nào).'
      )
    ) {
      deletedWalletIdsRef.current.clear();
      deletedLedgerIdsRef.current.clear();
      deletedCategoryIdsRef.current.clear();

      // Reset hoàn toàn NGAY LẬP TỨC (0ms phản hồi): 0 giao dịch, 0 ví, 0 sổ
      setTransactions([]);
      setWallets([]);
      setLedgers([]);
      setCategories(DEFAULT_CATEGORIES);
      setActiveLedgerId('all');
      setActiveWalletId('all');
      setIncludeAllWallets(true);
      setTimeFilter('month');

      try {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, '[]');
        localStorage.setItem(STORAGE_KEYS.WALLETS, '[]');
        localStorage.setItem(STORAGE_KEYS.LEDGERS, '[]');
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
        localStorage.setItem(STORAGE_KEYS.ACTIVE_LEDGER, 'all');
        localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET, 'all');
      } catch (_) {}

      window.dispatchEvent(
        new CustomEvent('show-app-toast', {
          detail: 'Đã đặt lại thành công: Đã xóa sạch toàn bộ ví, sổ và giao dịch!',
        })
      );

      // Xóa đồng thời trên Firestore Cloud ở chế độ chạy ngầm (không làm đơ/chậm giao diện)
      const uid = auth.currentUser?.uid;
      if (uid) {
        const wipePromise = clearAllUserFirestoreData(uid)
          .catch((err) => {
            console.warn('Lỗi khi xóa dữ liệu ngầm trên Firestore:', err);
          })
          .finally(() => {
            if (resetPromiseRef.current === wipePromise) {
              resetPromiseRef.current = null;
            }
          });
        resetPromiseRef.current = wipePromise;
      }
    }
  };

  const clearUserData = () => {
    activeUidRef.current = null;
    if (unsubDataRef.current) {
      unsubDataRef.current();
      unsubDataRef.current = null;
    }

    try {
      localStorage.setItem('user_is_logged_out', 'true');
      localStorage.setItem('sochitieu_user_offline_preference', 'true');
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, '[]');
      localStorage.setItem(STORAGE_KEYS.WALLETS, '[]');
      localStorage.setItem(STORAGE_KEYS.LEDGERS, '[]');
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_LEDGER, 'all');
      localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET, 'all');
      sessionStorage.clear();
    } catch (_) {}

    // Đưa toàn bộ Giao dịch (0 giao dịch), Ví (0 ví) và Sổ (0 sổ) về trạng thái trắng tinh khi Đăng xuất
    setTransactions([]);
    setWallets([]);
    setLedgers([]);
    setCategories(DEFAULT_CATEGORIES);
    setActiveLedgerId('all');
    setActiveWalletId('all');
  };

  const exportDataJson = async () => {
    const data = {
      ledgers,
      wallets,
      categories,
      transactions: transactions.filter((tx) => !tx.isDeleted),
      exportedAt: new Date().toISOString(),
      version: 'Kyouma 2.0',
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `so-chi-tieu-kyouma-2.0-${new Date().toISOString().slice(0, 10)}.json`;
    const base64Data = utf8ToBase64(jsonStr);
    await saveAndShareFile(filename, base64Data, 'application/json');
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

  const syncToCloud = async () => {
    if (!auth?.currentUser?.uid) {
      const msg = 'Chưa đăng nhập tài khoản Firebase';
      alert('Lỗi Firebase: ' + msg);
      return { success: false, count: 0, message: msg };
    }

    // Nếu có tiến trình Đặt lại đang xóa ngầm trên Cloud, đợi nó hoàn tất để không đồng bộ dữ liệu cũ
    if (resetPromiseRef.current) {
      try {
        await resetPromiseRef.current;
      } catch (_) {}
    }

    const res = await performTwoWaySync(auth.currentUser.uid, {
      transactions,
      wallets,
      ledgers,
      categories,
    });

    if (res.success && res.mergedData) {
      // Bước 3: Ghi đè mảng đã được gộp (Merge) chuẩn xác xuống LocalStorage & State
      setTransactions(res.mergedData.transactions);
      setWallets(res.mergedData.wallets);
      setLedgers(res.mergedData.ledgers);
      setCategories(res.mergedData.categories);

      if (res.mergedData.ledgers.length === 0) {
        setActiveLedgerId('all');
        localStorage.setItem(STORAGE_KEYS.ACTIVE_LEDGER, 'all');
      }
      if (res.mergedData.wallets.length === 0) {
        setActiveWalletId('all');
        localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET, 'all');
      }

      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(res.mergedData.transactions));
      localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(res.mergedData.wallets));
      localStorage.setItem(STORAGE_KEYS.LEDGERS, JSON.stringify(res.mergedData.ledgers));
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(res.mergedData.categories));
    }
    return res;
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
    setDefaultLedger,
    reorderLedgers,
    deleteLedger,
    addWallet,
    updateWallet,
    setDefaultWallet,
    reorderWallets,
    deleteWallet,
    transferMoney,
    addCategory,
    updateCategory,
    deleteCategory,
    resetToDefaults,
    clearUserData,
    exportDataJson,
    importDataJson,
    syncToCloud,
    isAutoSyncing,
    fetchAndSyncUserData,
  };
}
