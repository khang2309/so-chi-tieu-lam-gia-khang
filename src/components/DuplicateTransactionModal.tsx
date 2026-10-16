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
  DollarSign,
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
      setShowKeypad(false);
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
    if (len <= 8) return 'text-2xl sm:text-3xl';
    if (len <= 14) return 'text-xl sm:text-2xl';
    if (len <= 20) return 'text-lg sm:text-xl';
    return 'text-base sm:text-lg';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a]">
                Nhân Bản Giao Dịch
              </h3>
              <p className="text-xs text-[#7a6a58]">
                Tạo giao dịch mới dựa trên dữ liệu giao dịch cũ
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* ĐIỂM CHÚ Ý QUAN TRỌNG: Ô CHỌN NGÀY ĐƯỢC LÀM NỔI BẬT ĐẶC BIỆT */}
          <div className="p-3.5 rounded-xl bg-[#fff7ed] border-2 border-[#ea580c] shadow-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#9a3412] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#ea580c]" />
                <span>★ Ngày & Giờ ghi nhận (Mặc định: Hiện tại)</span>
              </label>
              <button
                type="button"
                onClick={() => setDate(toLocalDateTimeInput(new Date()))}
                className="text-[10px] font-semibold text-[#c2410c] px-2 py-0.5 rounded-full bg-[#ffedd5] hover:bg-[#fed7aa] transition"
              >
                Đặt về hiện tại
              </button>
            </div>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value || toLocalDateTimeInput(new Date()))}
              onFocus={() => setShowKeypad(false)}
              className="w-full px-3 py-2 rounded-lg bg-white border border-[#fdba74] text-sm font-bold text-[#7c2d12] focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
              required
            />
          </div>

          {/* Số tiền với bàn phím máy tính & không bị che bởi ... */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-[#a25832]" />
                <span>Số tiền:</span>
              </label>
              {showKeypad ? (
                <button
                  type="button"
                  onClick={() => setShowKeypad(false)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#7a6a58] hover:text-[#3e332a] bg-[#ebdcc9]/50 px-2.5 py-0.5 rounded-full transition cursor-pointer"
                >
                  <span>Thu gọn bàn phím</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenKeypad}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#a25832] hover:text-[#8c4623] bg-[#fbf5eb] border border-[#ebdcc9] px-2.5 py-0.5 rounded-full transition cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-[#a25832]" />
                  <span>Mở bàn phím số</span>
                </button>
              )}
            </div>

            {/* Money Lover Style Amount Bar */}
            <div
              onClick={handleOpenKeypad}
              className={`mt-1 flex items-center justify-between gap-2.5 pb-2 border-b-2 cursor-pointer select-none transition ${
                type === 'expense'
                  ? 'border-[#b94a3b]'
                  : type === 'income'
                  ? 'border-[#2e7d32]'
                  : 'border-[#3b6e8c]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="px-2 py-0.5 rounded bg-[#e5e7eb] text-gray-700 text-xs font-bold uppercase tracking-wider shrink-0">
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
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0 shadow-2xs whitespace-nowrap">
                  = {formatCurrency(Math.round(evaluatedAmount))}
                </span>
              )}
            </div>
          </div>

          {/* Ghi chú */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#7a6a58]" />
              <span>Ghi chú / Nội dung:</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onFocus={() => setShowKeypad(false)}
              placeholder="Nhập ghi chú giao dịch..."
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none resize-y min-h-[72px]"
            />
          </div>

          {/* Loại giao dịch (Chi / Thu / Chuyển) */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-1.5 rounded-lg text-xs font-bold transition border ${
                type === 'expense'
                  ? 'bg-[#b94a3b] text-white border-[#b94a3b]'
                  : 'bg-[#fbf5eb] text-[#7a6a58] border-[#ebdcc9]'
              }`}
            >
              Chi tiêu
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-1.5 rounded-lg text-xs font-bold transition border ${
                type === 'income'
                  ? 'bg-[#2e7d32] text-white border-[#2e7d32]'
                  : 'bg-[#fbf5eb] text-[#7a6a58] border-[#ebdcc9]'
              }`}
            >
              Thu nhập
            </button>
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`py-1.5 rounded-lg text-xs font-bold transition border ${
                type === 'transfer'
                  ? 'bg-[#3b6e8c] text-white border-[#3b6e8c]'
                  : 'bg-[#fbf5eb] text-[#7a6a58] border-[#ebdcc9]'
              }`}
            >
              Chuyển tiền
            </button>
          </div>

          {/* Danh mục (nếu không phải chuyển tiền) */}
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

          {/* Sổ lưu giao dịch */}
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

          {/* Ví tiền */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                <WalletIcon className="w-3.5 h-3.5 text-[#7a6a58]" />
                <span>{type === 'transfer' ? 'Từ ví nguồn:' : 'Thanh toán từ ví:'}</span>
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
              <div className="space-y-1">
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

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#f0e4d5] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#ebdcc9] text-xs font-medium text-[#7a6a58] hover:bg-[#ebdcc9] transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#a25832] text-white text-xs font-bold hover:bg-[#8c4623] active:scale-95 transition shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Xác nhận nhân bản</span>
            </button>
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
