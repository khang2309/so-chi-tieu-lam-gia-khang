import React, { useState } from 'react';
import { X, ArrowRightLeft, Check } from 'lucide-react';
import { Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';

interface WalletTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  onTransfer: (
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    note: string,
    date: string
  ) => void;
}

export const WalletTransferModal: React.FC<WalletTransferModalProps> = ({
  isOpen,
  onClose,
  wallets,
  walletBalances,
  onTransfer,
}) => {
  const [fromWalletId, setFromWalletId] = useState<string>(wallets[1]?.id || wallets[0]?.id || '');
  const [toWalletId, setToWalletId] = useState<string>(wallets[0]?.id || '');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!numAmount || numAmount <= 0) {
      alert('Vui lòng nhập số tiền cần chuyển!');
      return;
    }
    if (fromWalletId === toWalletId) {
      alert('Ví nguồn và ví đích không được trùng nhau!');
      return;
    }

    onTransfer(
      fromWalletId,
      toWalletId,
      numAmount,
      note.trim(),
      new Date().toISOString()
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#3b6e8c]/15 text-[#3b6e8c] flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a]">
                Chuyển Tiền Giữa Các Ví
              </h3>
              <p className="text-xs text-[#7a6a58]">
                Luân chuyển số dư nội bộ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* From Wallet */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Từ ví (Nguồn trừ tiền):
            </label>
            <select
              value={fromWalletId}
              onChange={(e) => setFromWalletId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (Khả dụng: {formatCurrency(walletBalances[w.id] || 0)})
                </option>
              ))}
            </select>
          </div>

          {/* To Wallet */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Đến ví (Đích nhận tiền):
            </label>
            <select
              value={toWalletId}
              onChange={(e) => setToWalletId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (Số dư hiện tại: {formatCurrency(walletBalances[w.id] || 0)})
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Số tiền chuyển (VNĐ):
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              className="w-full text-xl font-bold font-sans px-4 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Ghi chú (Tùy chọn):
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Rút tiền ATM, nạp ví MoMo..."
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            />
          </div>

          {/* Footer */}
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
              className="px-5 py-2 rounded-xl bg-[#3b6e8c] text-white text-xs font-semibold hover:bg-[#2e5973] transition flex items-center gap-1.5 shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Thực hiện chuyển</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
