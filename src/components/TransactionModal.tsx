import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Check, Calculator, Plus, Sparkles, Zap } from 'lucide-react';
import { Transaction, Ledger, Wallet, Category, TransactionType } from '../types';
import { DynamicIcon } from './DynamicIcon';
import { formatCurrency, toLocalDateTimeInput } from '../utils/formatters';
import {
  formatExpressionWithDots,
  evaluateMathExpression,
  isMathExpression,
  parseAmountOrExpression,
} from '../utils/mathExpression';
import { CustomCalculatorKeyboard } from './CustomCalculatorKeyboard';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Transaction, 'id' | 'createdAt'>, editingId?: string) => void;
  editingTransaction?: Transaction | null;
  initialValues?: Partial<Omit<Transaction, 'id' | 'createdAt'>> | null;
  ledgers: Ledger[];
  wallets: Wallet[];
  categories: Category[];
  initialLedgerId?: string;
  initialWalletId?: string;
  existingTransactions?: Transaction[];
  onOpenVoiceModal?: () => void;
  onAddLedger?: (data: Omit<Ledger, 'id' | 'createdAt'>) => Ledger;
  onAddWallet?: (data: Omit<Wallet, 'id' | 'createdAt'>) => Wallet;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTransaction,
  initialValues,
  ledgers,
  wallets,
  categories,
  initialLedgerId,
  initialWalletId,
  existingTransactions = [],
  onAddLedger,
  onAddWallet,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [ledgerId, setLedgerId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState<boolean>(true);

  const amountScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (amountScrollRef.current) {
      amountScrollRef.current.scrollLeft = amountScrollRef.current.scrollWidth;
    }
  }, [amount]);

  const getAmountFontSize = (val: string) => {
    const len = (val || '').length;
    if (len <= 8) return 'text-3xl sm:text-4xl';
    if (len <= 13) return 'text-2xl sm:text-3xl';
    if (len <= 18) return 'text-xl sm:text-2xl';
    return 'text-lg sm:text-xl';
  };

  // Quick inline creation state for Ledgers & Wallets
  const [showQuickCreateLedger, setShowQuickCreateLedger] = useState<boolean>(false);
  const [newLedgerName, setNewLedgerName] = useState<string>('');
  const [showQuickCreateWallet, setShowQuickCreateWallet] = useState<boolean>(false);
  const [newWalletName, setNewWalletName] = useState<string>('');
  const [newWalletBalance, setNewWalletBalance] = useState<string>('');

  // Lấy các gợi ý từ lịch sử giao dịch (loại trừ đã xóa mềm) kèm giao dịch gốc tương ứng
  const noteSuggestions = useMemo(() => {
    if (!existingTransactions || existingTransactions.length === 0) return [];

    const map = new Map<string, { note: string; sourceTransaction: Transaction; count: number }>();
    for (const tx of existingTransactions) {
      if (tx.isDeleted) continue;
      const trimmed = tx.note?.trim();
      if (trimmed) {
        const existing = map.get(trimmed);
        if (!existing) {
          map.set(trimmed, {
            note: trimmed,
            sourceTransaction: tx,
            count: 1,
          });
        } else {
          existing.count += 1;
          // Ưu tiên giao dịch có ngày mới hơn
          if (new Date(tx.date).getTime() > new Date(existing.sourceTransaction.date).getTime()) {
            existing.sourceTransaction = tx;
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [existingTransactions]);

  // Lọc gợi ý theo từ khóa đang gõ trong ô Ghi chú
  const filteredSuggestions = useMemo(() => {
    if (!noteSuggestions.length) return [];
    const query = note.trim().toLowerCase();
    if (!query) {
      return noteSuggestions.slice(0, 8);
    }
    return noteSuggestions
      .filter((s) => s.note.toLowerCase().includes(query) && s.note.toLowerCase() !== query)
      .slice(0, 8);
  }, [noteSuggestions, note]);

  // Khi chọn gợi ý: Tự động điền Note, Số tiền (amount) và Danh mục (category) từ giao dịch gốc
  const handleSelectSuggestion = (item: { note: string; sourceTransaction: Transaction }) => {
    setNote(item.note);
    const orig = item.sourceTransaction;
    if (orig) {
      if (orig.amount && orig.amount > 0) {
        setAmount(formatExpressionWithDots(orig.amount.toString()));
      }
      if (orig.categoryId) {
        setCategoryId(orig.categoryId);
      }
      if (orig.type) {
        setType(orig.type);
      }
    }
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (isOpen) {
      setShowKeypad(true);
    }
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(formatExpressionWithDots(editingTransaction.amount.toString()));
      setDate(toLocalDateTimeInput(editingTransaction.date));
      setCategoryId(editingTransaction.categoryId);
      setLedgerId(editingTransaction.ledgerId);
      setWalletId(editingTransaction.walletId);
      setNote((editingTransaction.note || '').replace(/\\n/g, '\n'));
    } else {
      // Defaults for new transaction (hỗ trợ điền từ giọng nói hoặc mẫu)
      const defaultType = initialValues?.type || 'expense';
      setType(defaultType);
      setAmount(initialValues?.amount ? formatExpressionWithDots(initialValues.amount.toString()) : '');
      setDate(toLocalDateTimeInput(new Date()));

      const fallbackDefaultLedger = ledgers.find((l) => l.isDefault) || ledgers[0];
      const defaultLedger =
        initialLedgerId && initialLedgerId !== 'all'
          ? initialLedgerId
          : fallbackDefaultLedger?.id || '';
      setLedgerId(defaultLedger);

      const fallbackDefaultWallet = wallets.find((w) => w.isDefault) || wallets[0];
      const defaultWallet =
        initialValues?.walletId ||
        (initialWalletId && initialWalletId !== 'all'
          ? initialWalletId
          : fallbackDefaultWallet?.id || '');
      setWalletId(defaultWallet);

      if (initialValues?.categoryId) {
        const matched = categories.find((c) => c.id === initialValues.categoryId);
        if (matched && (matched.type === defaultType || matched.type === 'both')) {
          setCategoryId(initialValues.categoryId);
        } else {
          const firstCat = categories.find((c) =>
            defaultType === 'expense'
              ? c.type === 'expense' || c.type === 'both'
              : c.type === 'income' || c.type === 'both'
          ) || categories[0];
          setCategoryId(firstCat?.id || initialValues.categoryId);
        }
      } else {
        const firstCat = categories.find((c) =>
          defaultType === 'expense'
            ? c.type === 'expense' || c.type === 'both'
            : c.type === 'income' || c.type === 'both'
        ) || categories[0];
        setCategoryId(firstCat?.id || '');
      }

      setNote((initialValues?.note || '').replace(/\\n/g, '\n'));
    }
  }, [editingTransaction, initialValues, isOpen, initialLedgerId, initialWalletId, ledgers, wallets, categories]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) =>
    type === 'expense' ? c.type === 'expense' || c.type === 'both' : c.type === 'income' || c.type === 'both'
  );

  const evaluatedAmount = evaluateMathExpression(amount);
  const hasExpression = isMathExpression(amount);

  const handleQuickInitDefaultLedgerAndWallet = () => {
    if (ledgers.length === 0 && onAddLedger) {
      const created = onAddLedger({
        name: 'Chi tiêu cá nhân',
        description: 'Sổ chi tiêu cá nhân mặc định',
        icon: 'BookOpen',
        color: '#a25832',
        isDefault: true,
      });
      setLedgerId(created.id);
    }
    if (wallets.length === 0 && onAddWallet) {
      const created = onAddWallet({
        name: 'Tiền mặt',
        initialBalance: 0,
        icon: 'Wallet',
        color: '#2e7d32',
        isDefault: true,
      });
      setWalletId(created.id);
    }
  };

  const handleCreateNewLedger = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (onAddLedger) {
      const created = onAddLedger({
        name: trimmed,
        description: 'Sổ chi tiêu',
        icon: 'BookOpen',
        color: '#a25832',
        isDefault: ledgers.length === 0,
      });
      setLedgerId(created.id);
    }
    setShowQuickCreateLedger(false);
    setNewLedgerName('');
  };

  const handleCreateNewWallet = (name: string, initialBalanceStr: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const initialBalance = parseAmountOrExpression(initialBalanceStr, 0);
    if (onAddWallet) {
      const created = onAddWallet({
        name: trimmed,
        initialBalance: initialBalance,
        icon: 'Wallet',
        color: '#2e7d32',
        isDefault: wallets.length === 0,
      });
      setWalletId(created.id);
    }
    setShowQuickCreateWallet(false);
    setNewWalletName('');
    setNewWalletBalance('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseAmountOrExpression(amount, 0);
    if (!numAmount || numAmount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ lớn hơn 0!');
      return;
    }
    if (!categoryId) {
      alert('Vui lòng chọn danh mục!');
      return;
    }

    let finalLedgerId = ledgerId;
    if (!finalLedgerId || !ledgers.some((l) => l.id === finalLedgerId)) {
      if (ledgers.length > 0) {
        finalLedgerId = (ledgers.find((l) => l.isDefault) || ledgers[0]).id;
      } else if (onAddLedger) {
        const created = onAddLedger({
          name: 'Chi tiêu cá nhân',
          description: 'Sổ chi tiêu cá nhân mặc định',
          icon: 'BookOpen',
          color: '#a25832',
          isDefault: true,
        });
        finalLedgerId = created.id;
      }
    }

    let finalWalletId = walletId;
    if (!finalWalletId || !wallets.some((w) => w.id === finalWalletId)) {
      if (wallets.length > 0) {
        finalWalletId = (wallets.find((w) => w.isDefault) || wallets[0]).id;
      } else if (onAddWallet) {
        const created = onAddWallet({
          name: 'Tiền mặt',
          initialBalance: 0,
          icon: 'Wallet',
          color: '#2e7d32',
          isDefault: true,
        });
        finalWalletId = created.id;
      }
    }

    const safeDate = date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date();

    onSave(
      {
        amount: numAmount,
        type,
        date: safeDate.toISOString(),
        categoryId,
        ledgerId: finalLedgerId,
        walletId: finalWalletId,
        toWalletId: null,
        note: note.trim(),
      },
      editingTransaction?.id
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl bg-[#fffdfa] border-0 sm:border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb] shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-[#3e332a]">
              {editingTransaction ? 'Chỉnh Sửa Giao Dịch' : 'Thêm Giao Dịch'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-xl bg-[#2e7d32] text-white text-xs font-bold hover:bg-[#256629] active:scale-95 transition shadow-xs flex items-center gap-1"
          >
            <Check className="w-4 h-4" />
            <span>Lưu</span>
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Type Toggle: Chi tiêu / Thu nhập */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                const firstExp = categories.find((c) => c.type === 'expense');
                if (firstExp) setCategoryId(firstExp.id);
              }}
              className={`py-2 rounded-lg transition ${
                type === 'expense'
                  ? 'bg-[#b94a3b] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Chi tiêu (-)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                const firstInc = categories.find((c) => c.type === 'income');
                if (firstInc) setCategoryId(firstInc.id);
              }}
              className={`py-2 rounded-lg transition ${
                type === 'income'
                  ? 'bg-[#2e7d32] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Thu nhập (+)
            </button>
          </div>

          {/* Amount Input (Money Lover Style) */}
          <div className="pt-1 pb-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a6a58]">
                Số tiền (VNĐ) <span className="text-[#b94a3b]">*</span>
              </label>
              {!showKeypad && (
                <button
                  type="button"
                  onClick={() => setShowKeypad(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 transition"
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mở bàn phím số</span>
                </button>
              )}
            </div>

            {/* Money Lover Amount Bar with clean green underline */}
            <div
              onClick={() => setShowKeypad(true)}
              className="mt-1.5 flex items-center justify-between gap-2.5 pb-2 border-b-2 border-emerald-500 cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="px-2.5 py-1 rounded bg-[#e5e7eb] text-gray-700 text-xs font-bold uppercase tracking-wider shrink-0">
                  VND
                </span>
                <div
                  ref={amountScrollRef}
                  className="flex-1 min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth flex items-center"
                >
                  <span className={`${getAmountFontSize(amount)} font-extrabold text-[#16a34a] tracking-tight inline-block`}>
                    {amount || '0'}
                  </span>
                </div>
              </div>
              {hasExpression && evaluatedAmount !== null && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg shrink-0 shadow-2xs whitespace-nowrap">
                  = {formatCurrency(Math.round(evaluatedAmount))}
                </span>
              )}
            </div>
          </div>

          {/* Note Input with Autocomplete */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#7a6a58]">
                Ghi chú chi tiết
              </label>
              {note && (
                <button
                  type="button"
                  onClick={() => setNote('')}
                  className="text-xs text-[#7a6a58] hover:text-[#b94a3b] transition"
                >
                  Xóa
                </button>
              )}
            </div>
            <div className="relative">
              <textarea
                rows={2}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  setShowKeypad(false);
                  setShowSuggestions(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="VD: Cơm trưa, Xăng xe, Tiền phòng..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none transition shadow-2xs resize-y min-h-[60px]"
              />
            </div>

            {/* Dropdown Gợi ý thông minh */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-[#fffdfa] border border-[#d8c8b4] rounded-xl shadow-lg max-h-52 overflow-y-auto p-1.5 divide-y divide-[#f5ebe0]">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a25832] flex items-center justify-between">
                  <span>Gợi ý từ lịch sử ({filteredSuggestions.length})</span>
                  <span className="text-[9px] text-[#7a6a58] lowercase font-normal italic">tự điền tiền & danh mục</span>
                </div>
                {filteredSuggestions.map((item, idx) => {
                  const cat = categories.find((c) => c.id === item.sourceTransaction.categoryId);
                  const formattedAmt =
                    item.sourceTransaction.amount > 0
                      ? formatCurrency(item.sourceTransaction.amount)
                      : '0 ₫';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(item);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-[#3e332a] hover:bg-[#f5ebe0] rounded-xl transition flex items-center justify-between gap-2.5 group active:scale-[0.99]"
                    >
                      {/* Tên ghi chú & danh mục */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="font-bold text-[#3e332a] truncate text-xs">
                          {item.note}
                        </span>
                        {cat && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0 truncate max-w-[85px]"
                            style={{
                              backgroundColor: `${cat.color}18`,
                              color: cat.color,
                            }}
                          >
                            {cat.name}
                          </span>
                        )}
                      </div>

                      {/* Số tiền kế bên hiển thị to, rõ ràng */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-[#a25832] bg-[#fbf5eb] px-2 py-0.5 rounded-lg border border-[#ebdcc9] shadow-2xs group-hover:bg-[#fffdfa] group-hover:border-[#a25832] transition">
                          {formattedAmt}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category Selector Grid */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Danh mục <span className="text-[#b94a3b]">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 border border-[#ebdcc9] rounded-xl bg-[#fbf5eb]/60">
              {filteredCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => {
                      setCategoryId(cat.id);
                      setShowKeypad(false);
                    }}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'border-[#a25832] bg-[#fffdfa] ring-2 ring-[#a25832]'
                        : 'border-transparent hover:bg-[#f5ebe0]'
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      <DynamicIcon name={cat.icon} className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-medium text-[#3e332a] truncate w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick banner if no ledgers or wallets exist */}
          {(ledgers.length === 0 || wallets.length === 0) && (
            <div className="p-3 rounded-xl bg-[#fff8ed] border border-[#ebdcc9] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs text-[#a25832]">
                <Sparkles className="w-4 h-4 shrink-0 text-[#a25832]" />
                <span className="font-semibold text-[11px] leading-tight">
                  {ledgers.length === 0 && wallets.length === 0
                    ? 'Bạn chưa có Sổ & Ví tiền nào'
                    : ledgers.length === 0
                    ? 'Bạn chưa có Sổ ghi chép nào'
                    : 'Bạn chưa có Ví tiền nào'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleQuickInitDefaultLedgerAndWallet}
                className="px-2.5 py-1 rounded-lg bg-[#a25832] text-white text-[11px] font-bold hover:bg-[#8c4623] active:scale-95 transition shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                <span>Tạo nhanh 1 chạm</span>
              </button>
            </div>
          )}

          {/* Ledger and Wallet Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Ledger */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#7a6a58]">Thuộc Sổ</label>
                {onAddLedger && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickCreateLedger((prev) => !prev);
                      setShowKeypad(false);
                    }}
                    className="text-[11px] text-[#a25832] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tạo sổ mới</span>
                  </button>
                )}
              </div>

              {showQuickCreateLedger && (
                <div className="p-2 rounded-xl bg-[#fffdfa] border border-[#a25832] shadow-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#a25832]">
                    <span>Tên Sổ ghi chép mới:</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickCreateLedger(false)}
                      className="text-[#7a6a58] hover:text-[#b94a3b] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newLedgerName}
                      onChange={(e) => setNewLedgerName(e.target.value)}
                      placeholder="VD: Chi tiêu cá nhân"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#a25832] focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateNewLedger(newLedgerName);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateNewLedger(newLedgerName)}
                      disabled={!newLedgerName.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-[#a25832] disabled:opacity-50 text-white text-xs font-bold shrink-0 hover:bg-[#8c4623] active:scale-95 transition cursor-pointer"
                    >
                      Tạo & Chọn
                    </button>
                  </div>
                </div>
              )}

              <select
                value={ledgerId}
                onChange={(e) => {
                  if (e.target.value === '__CREATE__') {
                    setShowQuickCreateLedger(true);
                    setShowKeypad(false);
                    return;
                  }
                  setLedgerId(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
              >
                {ledgers.length === 0 ? (
                  <option value="">(Chưa tạo sổ - Bấm Tạo sổ)</option>
                ) : (
                  ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))
                )}
                {onAddLedger && (
                  <option value="__CREATE__">+ Tạo sổ mới...</option>
                )}
              </select>
            </div>

            {/* Wallet */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#7a6a58]">
                  Nguồn tiền / Ví
                </label>
                {onAddWallet && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickCreateWallet((prev) => !prev);
                      setShowKeypad(false);
                    }}
                    className="text-[11px] text-[#a25832] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tạo ví mới</span>
                  </button>
                )}
              </div>

              {showQuickCreateWallet && (
                <div className="p-2 rounded-xl bg-[#fffdfa] border border-[#a25832] shadow-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#a25832]">
                    <span>Tạo Ví tiền mới:</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickCreateWallet(false)}
                      className="text-[#7a6a58] hover:text-[#b94a3b] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newWalletName}
                    onChange={(e) => setNewWalletName(e.target.value)}
                    placeholder="Tên ví (VD: Tiền mặt, MB Bank...)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#a25832] focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newWalletBalance}
                      onChange={(e) => setNewWalletBalance(formatExpressionWithDots(e.target.value))}
                      placeholder="Số dư (0đ)"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#a25832] focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateNewWallet(newWalletName, newWalletBalance);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateNewWallet(newWalletName, newWalletBalance)}
                      disabled={!newWalletName.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-[#a25832] disabled:opacity-50 text-white text-xs font-bold shrink-0 hover:bg-[#8c4623] active:scale-95 transition cursor-pointer"
                    >
                      Tạo & Chọn
                    </button>
                  </div>
                </div>
              )}

              <select
                value={walletId}
                onChange={(e) => {
                  if (e.target.value === '__CREATE__') {
                    setShowQuickCreateWallet(true);
                    setShowKeypad(false);
                    return;
                  }
                  setWalletId(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
              >
                {wallets.length === 0 ? (
                  <option value="">(Chưa tạo ví - Bấm Tạo ví)</option>
                ) : (
                  wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))
                )}
                {onAddWallet && (
                  <option value="__CREATE__">+ Tạo ví mới...</option>
                )}
              </select>
            </div>
          </div>

          {/* Date Time Picker */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">Ngày & Giờ</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value || toLocalDateTimeInput(new Date()))}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            />
          </div>
        </form>

        {/* Custom Calculator Keypad Docked at Bottom */}
        {showKeypad && (
          <div className="shrink-0 border-t border-[#e5e7eb] bg-[#f9fafb] animate-in slide-in-from-bottom-2 duration-150">
            <CustomCalculatorKeyboard
              value={amount}
              onChange={setAmount}
              onDone={() => {
                const ev = evaluateMathExpression(amount);
                if (ev !== null && isMathExpression(amount)) {
                  setAmount(formatExpressionWithDots(Math.round(ev).toString()));
                }
                setShowKeypad(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
