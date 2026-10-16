import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Copy,
  Calendar,
  Check,
  Tag,
  BookOpen,
  Wallet as WalletIcon,
  FileText,
  ArrowRightLeft,
  Calculator,
} from 'lucide-react';
import { Transaction, Ledger, Wallet, Category } from '../types';
import { formatCurrency, toLocalDateTimeInput } from '../utils/formatters';
import { sanitizeData } from '../utils/firestoreSync';
import { CustomCalculatorKeyboard } from './CustomCalculatorKeyboard';
import {
  formatExpressionWithDots,
  evaluateMathExpression,
  isMathExpression,
  parseAmountOrExpression,
} from '../utils/mathExpression';

interface DuplicateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTransaction: Transaction | null;
  ledgers: Ledger[];
  wallets: Wallet[];
  categories: Category[];
  onConfirm: (data: Omit<Transaction, 'id' | 'createdAt'>) => void;
}

export const DuplicateTransactionModal: React.FC<DuplicateTransactionModalProps> = ({
  isOpen,
  onClose,
  sourceTransaction,
  ledgers,
  wallets,
  categories,
  onConfirm,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [showKeypad, setShowKeypad] = useState<boolean>(false);
  const [date, setDate] = useState<string>(() => toLocalDateTimeInput(new Date()));
  const [note, setNote] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [ledgerId, setLedgerId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');

  const amountScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (amountScrollRef.current) {
      amountScrollRef.current.scrollLeft = amountScrollRef.current.scrollWidth;
    }
  }, [amount]);

  useEffect(() => {
    if (isOpen && sourceTransaction) {
      setAmount(formatExpressionWithDots(sourceTransaction.amount.toString()));
      setDate(toLocalDateTimeInput(new Date())); // Mặc định lấy đúng ngày & giờ hiện tại
      setNote(sourceTransaction.note || '');
      setCategoryId(sourceTransaction.categoryId);
      setLedgerId(sourceTransaction.ledgerId);
      setWalletId(sourceTransaction.walletId);
      setToWalletId(sourceTransaction.toWalletId || '');
      setType(sourceTransaction.type);
      setShowKeypad(true); // Luôn mở sẵn bàn phím máy tính giống TransactionModal
    }
  }, [isOpen, sourceTransaction]);

  const evaluatedAmount = evaluateMathExpression(amount);
  const hasExpression = isMathExpression(amount);

  const handleOpenKeypad = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowKeypad(true);
  };

  const getAmountFontSize = (val: string) => {
    const len = (val || '').length;
    if (len <= 8) return 'text-3xl sm:text-4xl';
    if (len <= 13) return 'text-2xl sm:text-3xl';
    if (len <= 18) return 'text-xl sm:text-2xl';
    return 'text-lg sm:text-xl';
  };

  if (!isOpen || !sourceTransaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let evaluatedVal = evaluateMathExpression(amount);
    if (evaluatedVal === null || isNaN(evaluatedVal)) {
      evaluatedVal = parseAmountOrExpression(amount);
    }
    const finalAmount = Math.round(evaluatedVal || 0);
    if (finalAmount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ lớn hơn 0!');
      return;
    }

    const safeDate = date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date();

    onConfirm(
      sanitizeData({
        amount: finalAmount,
        type,
        date: safeDate.toISOString(),
        categoryId: type === 'transfer' ? '' : categoryId,
        ledgerId,
        walletId,
        toWalletId: type === 'transfer' ? (toWalletId || null) : null,
        note: note.trim(),
      })
    );

    onClose();
  };

  const filteredCategories = categories.filter(
    (c) => c.type === 'both' || c.type === type
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl bg-[#fffdfa] border-0 sm:border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb] shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center shrink-0">
              <Copy className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#3e332a] leading-tight">
              Nhân Bản Giao Dịch
            </h3>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-xl bg-[#2e7d32] text-white text-xs font-bold hover:bg-[#256629] active:scale-95 transition shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Check className="w-4 h-4" />
            <span>Nhân bản</span>
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. Loại giao dịch (Chi / Thu / Chuyển) */}
          <div className="grid grid-cols-3 p-1 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setType('expense')}
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
              onClick={() => setType('income')}
              className={`py-2 rounded-lg transition ${
                type === 'income'
                  ? 'bg-[#2e7d32] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Thu nhập (+)
            </button>
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`py-2 rounded-lg transition ${
                type === 'transfer'
                  ? 'bg-[#3b6e8c] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Chuyển tiền
            </button>
          </div>

          {/* 2. Amount Input (Money Lover Style) */}
          <div className="pt-1 pb-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a6a58]">
                Số tiền (VNĐ) <span className="text-[#b94a3b]">*</span>
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

            {/* Money Lover Style Amount Bar */}
            <div
              onClick={handleOpenKeypad}
              className={`mt-1.5 flex items-center justify-between gap-2.5 pb-2 border-b-2 cursor-pointer select-none transition ${
                type === 'expense'
                  ? 'border-[#b94a3b]'
                  : type === 'income'
                  ? 'border-[#2e7d32]'
                  : 'border-[#3b6e8c]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="px-2.5 py-1 rounded bg-[#e5e7eb] text-gray-700 text-xs font-bold uppercase tracking-wider shrink-0">
                  VND
                </span>
                <div
                  ref={amountScrollRef}
                  className="flex-1 min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth flex items-center"
                >
                  <span
                    className={`${getAmountFontSize(amount)} font-extrabold tracking-tight inline-block ${
                      type === 'expense'
                        ? 'text-[#b94a3b]'
                        : type === 'income'
                        ? 'text-[#2e7d32]'
                        : 'text-[#3b6e8c]'
                    }`}
                  >
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

          {/* 3. Ghi chú chi tiết */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#7a6a58]" />
              <span>Ghi chú chi tiết:</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onFocus={() => setShowKeypad(false)}
              placeholder="Nhập ghi chú giao dịch..."
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            />
          </div>

          {/* 4. Danh mục (nếu không phải chuyển tiền) */}
          {type !== 'transfer' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#7a6a58]" />
                <span>Danh mục:</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Sổ và Ví */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#7a6a58]" />
                <span>Lưu vào sổ:</span>
              </label>
              <select
                value={ledgerId}
                onChange={(e) => setLedgerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
              >
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                <WalletIcon className="w-3.5 h-3.5 text-[#7a6a58]" />
                <span>{type === 'transfer' ? 'Từ ví nguồn:' : 'Nguồn tiền / Ví:'}</span>
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {type === 'transfer' && (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-[#3b6e8c]" />
                  <span>Đến ví nhận:</span>
                </label>
                <select
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
                >
                  {wallets
                    .filter((w) => w.id !== walletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* 6. Ngày & Giờ ghi nhận */}
          <div className="p-3 rounded-xl bg-[#fff7ed] border border-[#ea580c]/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#9a3412] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#ea580c]" />
                <span>Ngày & Giờ ghi nhận (Mặc định: Hiện tại)</span>
              </label>
              <button
                type="button"
                onClick={() => setDate(toLocalDateTimeInput(new Date()))}
                className="text-[10px] font-semibold text-[#c2410c] px-2 py-0.5 rounded-full bg-[#ffedd5] hover:bg-[#fed7aa] transition cursor-pointer"
              >
                Đặt về hiện tại
              </button>
            </div>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value || toLocalDateTimeInput(new Date()))}
              onFocus={() => setShowKeypad(false)}
              className="w-full px-3 py-2 rounded-lg bg-white border border-[#fdba74] text-xs font-medium text-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
              required
            />
          </div>
        </form>

        {/* Custom Calculator Keypad Docked at Bottom */}
        {showKeypad && (
          <div className="shrink-0 border-t border-[#e5e7eb] bg-[#f9fafb] animate-in slide-in-from-bottom-2 duration-150">
            <CustomCalculatorKeyboard
              value={amount}
              onChange={setAmount}
              quickAmounts={[10000, 20000, 30000, 50000, 100000, 200000, 500000, 1000000]}
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
