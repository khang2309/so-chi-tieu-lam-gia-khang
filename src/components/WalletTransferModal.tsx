import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowRightLeft,
  ArrowUpDown,
  Check,
  Calculator,
  AlertCircle,
} from 'lucide-react';
import { Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';
import { CustomCalculatorKeyboard } from './CustomCalculatorKeyboard';
import {
  parseAmountOrExpression,
  evaluateMathExpression,
  isMathExpression,
  formatExpressionWithDots,
} from '../utils/mathExpression';

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
  const [fromWalletId, setFromWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [showKeypad, setShowKeypad] = useState<boolean>(true);

  const amountScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (amountScrollRef.current) {
      amountScrollRef.current.scrollLeft = amountScrollRef.current.scrollWidth;
    }
  }, [amount]);

  const handleOpenKeypad = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowKeypad(true);
  };

  const getAmountFontSize = (val: string) => {
    const len = (val || '').length;
    if (len <= 8) return 'text-2xl sm:text-3xl';
    if (len <= 13) return 'text-xl sm:text-2xl';
    if (len <= 18) return 'text-lg sm:text-xl';
    return 'text-base sm:text-lg';
  };

  // Tự động khởi tạo 2 ví khác nhau và xóa trắng form mỗi khi mở modal
  useEffect(() => {
    if (isOpen && wallets.length > 0) {
      setAmount('');
      setNote('');
      setShowKeypad(true);

      const defaultFrom = wallets.find((w) => w.isDefault) || wallets[0];
      const defaultTo =
        wallets.find((w) => w.id !== defaultFrom?.id) || wallets[1] || wallets[0];

      setFromWalletId(defaultFrom?.id || '');
      setToWalletId(defaultTo?.id || '');
    }
  }, [isOpen, wallets]);

  if (!isOpen) return null;

  const numAmount = parseAmountOrExpression(amount, 0);
  const fromBalance = walletBalances[fromWalletId] || 0;
  const toBalance = walletBalances[toWalletId] || 0;

  const isSameWallet = Boolean(fromWalletId && toWalletId && fromWalletId === toWalletId);
  const isOverBalance = numAmount > fromBalance && fromBalance > 0;
  const canSubmit = numAmount > 0 && !isSameWallet && wallets.length >= 2;

  // Đổi chiều ví nguồn và đích 1 chạm
  const handleSwapWallets = () => {
    const prevFrom = fromWalletId;
    const prevTo = toWalletId;
    setFromWalletId(prevTo);
    setToWalletId(prevFrom);
  };

  const handleFromChange = (newFromId: string) => {
    setFromWalletId(newFromId);
    if (newFromId === toWalletId) {
      const other = wallets.find((w) => w.id !== newFromId);
      if (other) setToWalletId(other.id);
    }
  };

  const handleToChange = (newToId: string) => {
    setToWalletId(newToId);
    if (newToId === fromWalletId) {
      const other = wallets.find((w) => w.id !== newToId);
      if (other) setFromWalletId(other.id);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;

    const finalAmount = parseAmountOrExpression(amount, 0);
    if (finalAmount <= 0) return;

    onTransfer(
      fromWalletId,
      toWalletId,
      finalAmount,
      note.trim(),
      new Date().toISOString()
    );

    // Xóa sạch trạng thái sau khi chuyển xong
    setAmount('');
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl bg-[#fffdfa] border-0 sm:border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-[#3b6e8c]/15 text-[#3b6e8c] flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#3e332a] truncate">
                Chuyển Tiền Giữa Các Ví
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSubmit}
            className="px-4 py-1.5 rounded-xl bg-[#3b6e8c] text-white text-xs font-bold hover:bg-[#2e5973] active:scale-95 transition shadow-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer shrink-0"
          >
            <Check className="w-4 h-4" />
            <span>Chuyển</span>
          </button>
        </div>

        {/* Content Body (Scrollable, never obscured) */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3 overscroll-contain">
          {/* Wallets Selector Card with Swap Button */}
          <div className="p-3 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#7a6a58] uppercase tracking-wider">
                Chọn chiều luân chuyển
              </span>
              <button
                type="button"
                onClick={handleSwapWallets}
                className="px-2 py-0.5 rounded-md bg-white border border-[#ebdcc9] text-[11px] font-bold text-[#3b6e8c] hover:bg-[#ebdcc9] active:scale-95 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Bấm để hoán đổi ví nguồn và đích"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Đổi chiều ví</span>
              </button>
            </div>

            {/* From Wallet */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#3e332a]">
                  🔴 Từ ví (Nguồn trừ tiền):
                </label>
                <span className="text-[11px] font-bold text-[#3b6e8c]">
                  Khả dụng: {formatCurrency(fromBalance)}
                </span>
              </div>
              <select
                value={fromWalletId}
                onChange={(e) => handleFromChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:border-[#3b6e8c] focus:outline-none"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.id === toWalletId}>
                    {w.name} {w.id === toWalletId ? '(Đang là ví nhận)' : `(Dư: ${formatCurrency(walletBalances[w.id] || 0)})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Arrow Divider */}
            <div className="flex items-center justify-center -my-1">
              <button
                type="button"
                onClick={handleSwapWallets}
                className="w-6 h-6 rounded-full bg-white border border-[#ebdcc9] shadow-2xs flex items-center justify-center text-[#3b6e8c] hover:bg-[#ebdcc9] active:scale-90 transition cursor-pointer"
                title="Đổi chiều ví"
              >
                <ArrowUpDown className="w-3 h-3" />
              </button>
            </div>

            {/* To Wallet */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#3e332a]">
                  🟢 Đến ví (Đích nhận tiền):
                </label>
                <span className="text-[11px] font-bold text-[#2e7d32]">
                  Hiện có: {formatCurrency(toBalance)}
                </span>
              </div>
              <select
                value={toWalletId}
                onChange={(e) => handleToChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:border-[#3b6e8c] focus:outline-none"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.id === fromWalletId}>
                    {w.name} {w.id === fromWalletId ? '(Đang là ví chuyển)' : `(Dư: ${formatCurrency(walletBalances[w.id] || 0)})`}
                  </option>
                ))}
              </select>
            </div>

            {isSameWallet && (
              <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Ví nguồn và ví đích không được trùng nhau!</span>
              </p>
            )}
          </div>

          {/* Transfer Amount (Money Lover Style) */}
          <div className="pt-1 pb-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a6a58]">
                Số tiền chuyển (VNĐ) <span className="text-[#b94a3b]">*</span>
              </label>
              {!showKeypad && (
                <button
                  type="button"
                  onClick={handleOpenKeypad}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 transition cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mở bàn phím số</span>
                </button>
              )}
            </div>

            {/* Money Lover Amount Bar with clean underline */}
            <div
              onClick={handleOpenKeypad}
              className="mt-1.5 flex items-center justify-between gap-2.5 pb-2 border-b-2 border-[#3b6e8c] cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="px-2.5 py-1 rounded bg-[#e5e7eb] text-gray-700 text-xs font-bold uppercase tracking-wider shrink-0">
                  VND
                </span>
                <div
                  ref={amountScrollRef}
                  className="flex-1 min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth flex items-center"
                >
                  <span className={`${getAmountFontSize(amount)} font-extrabold text-[#3b6e8c] tracking-tight inline-block`}>
                    {amount || '0'}
                  </span>
                </div>
              </div>
              {isMathExpression(amount) && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg shrink-0 shadow-2xs whitespace-nowrap">
                  = {formatCurrency(numAmount)}
                </span>
              )}
            </div>

            {isOverBalance && (
              <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1 mt-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Cảnh báo: Số tiền chuyển vượt quá số dư khả dụng ({formatCurrency(fromBalance)})</span>
              </p>
            )}
          </div>

          {/* Note Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Ghi chú chuyển tiền:
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onFocus={() => setShowKeypad(false)}
              placeholder="VD: Rút ATM, nạp ví MoMo, chuyển tiền nhà..."
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#3b6e8c] focus:outline-none"
            />
          </div>
        </div>

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
              quickAmounts={[50000, 100000, 200000, 500000, 1000000, 2000000]}
            />
          </div>
        )}
      </div>
    </div>
  );
};
