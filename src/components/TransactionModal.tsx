import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Transaction, Ledger, Wallet, Category, TransactionType } from '../types';
import { DynamicIcon } from './DynamicIcon';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Transaction, 'id' | 'createdAt'>, editingId?: string) => void;
  editingTransaction?: Transaction | null;
  ledgers: Ledger[];
  wallets: Wallet[];
  categories: Category[];
  initialLedgerId?: string;
  initialWalletId?: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTransaction,
  ledgers,
  wallets,
  categories,
  initialLedgerId,
  initialWalletId,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [ledgerId, setLedgerId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [note, setNote] = useState<string>('');

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
      setNote(editingTransaction.note || '');
    } else {
      // Defaults for new transaction
      setType('expense');
      setAmount('');
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
        initialWalletId && initialWalletId !== 'all'
          ? initialWalletId
          : wallets[0]?.id || 'wallet-cash';
      setWalletId(defaultWallet);

      const firstExpenseCat = categories.find((c) => c.type === 'expense') || categories[0];
      setCategoryId(firstExpenseCat?.id || '');
      setNote('');
    }
  }, [editingTransaction, isOpen, initialLedgerId, initialWalletId, ledgers, wallets, categories]);

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

    onSave(
      {
        amount: numAmount,
        type,
        date: new Date(date).toISOString(),
        categoryId,
        ledgerId,
        walletId,
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
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
          >
            <X className="w-5 h-5" />
          </button>
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
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            />
          </div>

          {/* Note Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Ghi chú chi tiết
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Cơm trưa, Xăng xe Janus, Tiền phòng..."
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
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
