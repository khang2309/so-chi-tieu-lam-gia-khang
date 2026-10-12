import React, { useState, useEffect, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import { Transaction, Ledger, Wallet, Category, TransactionType } from '../types';
import { DynamicIcon } from './DynamicIcon';
import { formatCurrency } from '../utils/formatters';

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
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [ledgerId, setLedgerId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

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
        setAmount(orig.amount.toString());
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
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(editingTransaction.amount.toString());
      setDate(
        editingTransaction.date.includes('T')
          ? editingTransaction.date.slice(0, 16)
          : editingTransaction.date + 'T12:00'
      );
      setCategoryId(editingTransaction.categoryId);
      setLedgerId(editingTransaction.ledgerId);
      setWalletId(editingTransaction.walletId);
      setNote((editingTransaction.note || '').replace(/\\n/g, '\n'));
    } else {
      // Defaults for new transaction (hỗ trợ điền từ giọng nói hoặc mẫu)
      const defaultType = initialValues?.type || 'expense';
      setType(defaultType);
      setAmount(initialValues?.amount ? initialValues.amount.toString() : '');
      const now = new Date();
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDate(localIso);

      const defaultLedger =
        initialLedgerId && initialLedgerId !== 'all'
          ? initialLedgerId
          : ledgers[0]?.id || 'ledger-personal';
      setLedgerId(defaultLedger);

      const defaultWallet =
        initialValues?.walletId ||
        (initialWalletId && initialWalletId !== 'all'
          ? initialWalletId
          : wallets[0]?.id || 'wallet-cash');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!numAmount || numAmount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ lớn hơn 0!');
      return;
    }
    if (!categoryId) {
      alert('Vui lòng chọn danh mục!');
      return;
    }

    const safeDate = date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date();

    onSave(
      {
        amount: numAmount,
        type,
        date: safeDate.toISOString(),
        categoryId,
        ledgerId,
        walletId,
        toWalletId: null,
        note: note.trim(),
      },
      editingTransaction?.id
    );
    onClose();
  };

  const handleQuickAddAmount = (addValue: number) => {
    const current = parseFloat(amount.replace(/[^0-9]/g, '')) || 0;
    setAmount((current + addValue).toString());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <h3 className="text-base font-bold text-[#3e332a]">
            {editingTransaction ? 'Chỉnh Sửa Giao Dịch' : 'Thêm Giao Dịch Mới'}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
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

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Số tiền (VNĐ) <span className="text-[#b94a3b]">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full text-2xl font-bold font-sans px-4 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#7a6a58]">
                ₫
              </span>
            </div>

            {/* Quick Amount Suggestion Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[20000, 50000, 100000, 200000, 500000, 1000000].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleQuickAddAmount(val)}
                  className="px-2 py-0.5 rounded-md bg-[#f5ebe0] hover:bg-[#ebdcc9] text-[11px] font-medium text-[#7a6a58] transition"
                >
                  +{val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                </button>
              ))}
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="px-2 py-0.5 rounded-md bg-[#f5ebe0] hover:bg-[#ebdcc9] text-[11px] text-[#b94a3b] font-medium transition"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* Note Input with Autocomplete (Đặt ngay bên dưới ô Số tiền) */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#7a6a58]">
                Ghi chú chi tiết
              </label>
              {note && (
                <button
                  type="button"
                  onClick={() => setNote('')}
                  className="text-[10px] text-[#7a6a58] hover:text-[#b94a3b]"
                >
                  Xóa
                </button>
              )}
            </div>
            <div className="relative">
              <textarea
                rows={3}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="VD: Cơm trưa, Xăng xe, Tiền phòng..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none transition shadow-2xs resize-y min-h-[72px]"
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
                        <span className="text-[10px] text-[#7a6a58] font-medium opacity-0 group-hover:opacity-100 transition hidden sm:inline">
                          chọn
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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 border border-[#ebdcc9] rounded-xl bg-[#fbf5eb]/60">
              {filteredCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
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

          {/* Ledger and Wallet Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Ledger */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#7a6a58]">Thuộc Sổ</label>
              <select
                value={ledgerId}
                onChange={(e) => setLedgerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
              >
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Wallet */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#7a6a58]">
                Nguồn tiền / Ví
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Time Picker */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">Ngày & Giờ</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value || new Date().toISOString().slice(0, 16))}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#ebdcc9] text-xs font-medium text-[#7a6a58] hover:bg-[#f5ebe0] transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] active:scale-95 transition shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{editingTransaction ? 'Lưu thay đổi' : 'Ghi vào sổ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
