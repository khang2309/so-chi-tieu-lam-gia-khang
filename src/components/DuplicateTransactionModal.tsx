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
  ChevronDown,
  ArrowLeft,
  Plus,
} from 'lucide-react';
import { Transaction, Ledger, Wallet, Category } from '../types';
import { formatCurrency, toLocalDateTimeInput } from '../utils/formatters';
import { sanitizeData } from '../utils/firestoreSync';
import { CustomCalculatorKeyboard } from './CustomCalculatorKeyboard';
import { DynamicIcon } from './DynamicIcon';
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
  onAddLedger?: (data: Omit<Ledger, 'id' | 'createdAt'>) => Ledger;
  onAddWallet?: (data: Omit<Wallet, 'id' | 'createdAt'>) => Wallet;
}

export const DuplicateTransactionModal: React.FC<DuplicateTransactionModalProps> = ({
  isOpen,
  onClose,
  sourceTransaction,
  ledgers,
  wallets,
  categories,
  onConfirm,
  onAddLedger,
  onAddWallet,
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
  const [showLedgerPicker, setShowLedgerPicker] = useState<boolean>(false);
  const [showWalletPicker, setShowWalletPicker] = useState<boolean>(false);
  const [showToWalletPicker, setShowToWalletPicker] = useState<boolean>(false);

  // Creation state inside pickers
  const [isCreatingLedgerInPicker, setIsCreatingLedgerInPicker] = useState<boolean>(false);
  const [newLedgerName, setNewLedgerName] = useState<string>('');
  const [isCreatingWalletInPicker, setIsCreatingWalletInPicker] = useState<boolean>(false);
  const [newWalletName, setNewWalletName] = useState<string>('');
  const [newWalletBalance, setNewWalletBalance] = useState<string>('');

  const amountScrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
      setIsCreatingLedgerInPicker(false);
      setIsCreatingWalletInPicker(false);
      setNewLedgerName('');
      setNewWalletName('');
      setNewWalletBalance('');
      if (formRef.current) {
        formRef.current.scrollTop = 0;
      }
    }
  }, [isOpen, sourceTransaction]);

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
    setIsCreatingLedgerInPicker(false);
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
    setIsCreatingWalletInPicker(false);
    setNewWalletName('');
    setNewWalletBalance('');
  };

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

  const selectedLedger = ledgers.find((l) => l.id === ledgerId);
  const selectedWallet = wallets.find((w) => w.id === walletId);
  const selectedToWallet = wallets.find((w) => w.id === toWalletId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
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

        {/* Sticky Top: Type Toggle & Amount */}
        <div className="px-5 pt-3 pb-2.5 bg-[#fffdfa] border-b border-[#f0e4d5] shrink-0 space-y-2.5">
          {/* 1. Loại giao dịch (Chi / Thu / Chuyển) */}
          <div className="grid grid-cols-3 p-1 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 rounded-lg transition cursor-pointer ${
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
              className={`py-2 rounded-lg transition cursor-pointer ${
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
              className={`py-2 rounded-lg transition cursor-pointer ${
                type === 'transfer'
                  ? 'bg-[#3b6e8c] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Chuyển tiền
            </button>
          </div>

          {/* 2. Amount Input (Money Lover Style) */}
          <div className="pt-0.5">
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
              className={`mt-1 flex items-center justify-between gap-2.5 pb-1.5 border-b-2 cursor-pointer select-none transition ${
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
        </div>

        {/* Form Body (Scrollable) */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">

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

          {/* 4. Danh mục (nếu không phải chuyển tiền) - Dạng lưới icon chuẩn TransactionModal */}
          {type !== 'transfer' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#7a6a58]" />
                <span>Danh mục <span className="text-[#b94a3b]">*</span></span>
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
                      className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
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
          )}

          {/* 5. Sổ và Ví */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-[#7a6a58]" />
                  <span>Lưu vào sổ:</span>
                </label>
                {onAddLedger && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowLedgerPicker(true);
                      setIsCreatingLedgerInPicker(true);
                      setShowKeypad(false);
                    }}
                    className="text-[11px] text-[#a25832] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tạo sổ mới</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLedgerPicker(true);
                  setIsCreatingLedgerInPicker(false);
                  setShowKeypad(false);
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] flex items-center justify-between gap-2 hover:bg-[#f5ebe0] transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {selectedLedger ? (
                    <>
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: selectedLedger.color || '#a25832' }}
                      >
                        <DynamicIcon name={selectedLedger.icon || 'BookOpen'} className="w-3 h-3 text-white" />
                      </div>
                      <span className="font-semibold text-xs text-[#3e332a] truncate">{selectedLedger.name}</span>
                    </>
                  ) : (
                    <span className="text-[#a89886] italic">Chưa chọn sổ</span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-[#7a6a58] shrink-0" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                  <WalletIcon className="w-3.5 h-3.5 text-[#7a6a58]" />
                  <span>{type === 'transfer' ? 'Từ ví nguồn:' : 'Nguồn tiền / Ví:'}</span>
                </label>
                {onAddWallet && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowWalletPicker(true);
                      setIsCreatingWalletInPicker(true);
                      setShowKeypad(false);
                    }}
                    className="text-[11px] text-[#a25832] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tạo ví mới</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWalletPicker(true);
                  setIsCreatingWalletInPicker(false);
                  setShowKeypad(false);
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] flex items-center justify-between gap-2 hover:bg-[#f5ebe0] transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {selectedWallet ? (
                    <>
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: selectedWallet.color || '#2e7d32' }}
                      >
                        <DynamicIcon name={selectedWallet.icon || 'Landmark'} className="w-3 h-3 text-white" />
                      </div>
                      <span className="font-semibold text-xs text-[#3e332a] truncate">{selectedWallet.name}</span>
                    </>
                  ) : (
                    <span className="text-[#a89886] italic">Chưa chọn ví</span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-[#7a6a58] shrink-0" />
              </button>
            </div>

            {type === 'transfer' && (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[#7a6a58] flex items-center gap-1">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-[#3b6e8c]" />
                  <span>Đến ví nhận:</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowToWalletPicker(true);
                    setShowKeypad(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] flex items-center justify-between gap-2 hover:bg-[#f5ebe0] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedToWallet ? (
                      <>
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: selectedToWallet.color || '#3b6e8c' }}
                        >
                          <DynamicIcon name={selectedToWallet.icon || 'Landmark'} className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-semibold text-xs text-[#3e332a] truncate">{selectedToWallet.name}</span>
                      </>
                    ) : (
                      <span className="text-[#a89886] italic">Chưa chọn ví nhận</span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-[#7a6a58] shrink-0" />
                </button>
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

        {/* Modal / Popup chọn Sổ */}
        {showLedgerPicker && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {isCreatingLedgerInPicker ? (
                    <button
                      type="button"
                      onClick={() => setIsCreatingLedgerInPicker(false)}
                      className="p-1 -ml-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-sm font-bold text-[#3e332a]">
                    {isCreatingLedgerInPicker ? 'Tạo Sổ Ghi Chép Mới' : 'Chọn Sổ Chi Tiêu'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLedgerPicker(false);
                    setIsCreatingLedgerInPicker(false);
                  }}
                  className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isCreatingLedgerInPicker ? (
                <div className="p-4 space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#7a6a58]">
                      Tên sổ ghi chép <span className="text-[#b94a3b]">*</span>
                    </label>
                    <input
                      type="text"
                      value={newLedgerName}
                      onChange={(e) => setNewLedgerName(e.target.value)}
                      placeholder="VD: Chi tiêu cá nhân, Du lịch..."
                      className="w-full px-3 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#a25832] focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newLedgerName.trim()) {
                            handleCreateNewLedger(newLedgerName);
                            setIsCreatingLedgerInPicker(false);
                            setShowLedgerPicker(false);
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingLedgerInPicker(false)}
                      className="flex-1 py-2.5 rounded-xl border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#fbf5eb] transition cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={!newLedgerName.trim()}
                      onClick={() => {
                        handleCreateNewLedger(newLedgerName);
                        setIsCreatingLedgerInPicker(false);
                        setShowLedgerPicker(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-[#a25832] disabled:opacity-50 text-white text-xs font-bold hover:bg-[#8c4623] active:scale-95 transition cursor-pointer shadow-xs"
                    >
                      Tạo & Chọn ngay
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 overflow-y-auto space-y-2 flex-1 overscroll-contain">
                  {ledgers.map((l) => {
                    const isSelected = ledgerId === l.id;
                    return (
                      <button
                        type="button"
                        key={l.id}
                        onClick={() => {
                          setLedgerId(l.id);
                          setShowLedgerPicker(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-[#a25832] bg-[#fbf5eb] ring-1 ring-[#a25832]'
                            : 'border-[#ebdcc9] hover:bg-[#fbf5eb]/60 bg-[#fffdfa]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: l.color || '#a25832' }}
                          >
                            <DynamicIcon name={l.icon || 'BookOpen'} className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#3e332a] truncate">{l.name}</div>
                            {l.description ? (
                              <div className="text-[11px] text-[#7a6a58] truncate">{l.description}</div>
                            ) : (
                              <div className="text-[10px] text-[#a89886] italic">Sổ chi tiêu</div>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#2e7d32] shrink-0" />}
                      </button>
                    );
                  })}

                  {onAddLedger && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingLedgerInPicker(true)}
                      className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#a25832] bg-[#fff8ed] text-xs font-bold text-[#a25832] hover:bg-[#faebd7] transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tạo sổ mới...</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal / Popup chọn Ví nguồn */}
        {showWalletPicker && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {isCreatingWalletInPicker ? (
                    <button
                      type="button"
                      onClick={() => setIsCreatingWalletInPicker(false)}
                      className="p-1 -ml-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-[#2e7d32]/10 text-[#2e7d32] flex items-center justify-center">
                      <WalletIcon className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-sm font-bold text-[#3e332a]">
                    {isCreatingWalletInPicker
                      ? 'Tạo Ví Tiền Mới'
                      : type === 'transfer'
                      ? 'Chọn Ví Nguồn'
                      : 'Chọn Nguồn Tiền / Ví'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowWalletPicker(false);
                    setIsCreatingWalletInPicker(false);
                  }}
                  className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isCreatingWalletInPicker ? (
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#7a6a58]">
                      Tên ví tiền <span className="text-[#b94a3b]">*</span>
                    </label>
                    <input
                      type="text"
                      value={newWalletName}
                      onChange={(e) => setNewWalletName(e.target.value)}
                      placeholder="VD: Tiền mặt, Techcombank, MoMo..."
                      className="w-full px-3 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#2e7d32] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#7a6a58]">
                      Số dư khởi tạo (VNĐ)
                    </label>
                    <input
                      type="text"
                      value={newWalletBalance}
                      onChange={(e) => setNewWalletBalance(formatExpressionWithDots(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#2e7d32] focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newWalletName.trim()) {
                            handleCreateNewWallet(newWalletName, newWalletBalance);
                            setIsCreatingWalletInPicker(false);
                            setShowWalletPicker(false);
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingWalletInPicker(false)}
                      className="flex-1 py-2.5 rounded-xl border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#fbf5eb] transition cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={!newWalletName.trim()}
                      onClick={() => {
                        handleCreateNewWallet(newWalletName, newWalletBalance);
                        setIsCreatingWalletInPicker(false);
                        setShowWalletPicker(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-[#2e7d32] disabled:opacity-50 text-white text-xs font-bold hover:bg-[#256629] active:scale-95 transition cursor-pointer shadow-xs"
                    >
                      Tạo & Chọn ngay
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 overflow-y-auto space-y-2 flex-1 overscroll-contain">
                  {wallets.map((w) => {
                    const isSelected = walletId === w.id;
                    return (
                      <button
                        type="button"
                        key={w.id}
                        onClick={() => {
                          setWalletId(w.id);
                          setShowWalletPicker(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-[#2e7d32] bg-[#f0fdf4] ring-1 ring-[#2e7d32]'
                            : 'border-[#ebdcc9] hover:bg-[#fbf5eb]/60 bg-[#fffdfa]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: w.color || '#2e7d32' }}
                          >
                            <DynamicIcon name={w.icon || 'Landmark'} className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#3e332a] truncate">{w.name}</div>
                            {w.accountNumber ? (
                              <div className="text-[11px] text-[#7a6a58] truncate">{w.accountNumber}</div>
                            ) : (
                              <div className="text-[10px] text-[#a89886] italic">Ví tiền</div>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#2e7d32] shrink-0" />}
                      </button>
                    );
                  })}

                  {onAddWallet && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingWalletInPicker(true)}
                      className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#2e7d32] bg-[#f0fdf4] text-xs font-bold text-[#2e7d32] hover:bg-emerald-100/60 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tạo ví mới...</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal / Popup chọn Ví nhận (nếu chuyển tiền) */}
        {showToWalletPicker && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#3b6e8c]/10 text-[#3b6e8c] flex items-center justify-center">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-[#3e332a]">Chọn Ví Nhận</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToWalletPicker(false)}
                  className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 overflow-y-auto space-y-2 flex-1 overscroll-contain">
                {wallets
                  .filter((w) => w.id !== walletId)
                  .map((w) => {
                    const isSelected = toWalletId === w.id;
                    return (
                      <button
                        type="button"
                        key={w.id}
                        onClick={() => {
                          setToWalletId(w.id);
                          setShowToWalletPicker(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-[#3b6e8c] bg-[#f0f9ff] ring-1 ring-[#3b6e8c]'
                            : 'border-[#ebdcc9] hover:bg-[#fbf5eb]/60 bg-[#fffdfa]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: w.color || '#3b6e8c' }}
                          >
                            <DynamicIcon name={w.icon || 'Landmark'} className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#3e332a] truncate">{w.name}</div>
                            {w.accountNumber ? (
                              <div className="text-[11px] text-[#7a6a58] truncate">{w.accountNumber}</div>
                            ) : (
                              <div className="text-[10px] text-[#a89886] italic">Ví tiền</div>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#3b6e8c] shrink-0" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
