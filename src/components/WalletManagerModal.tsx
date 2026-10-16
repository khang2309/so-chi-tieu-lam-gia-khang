import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Wallet as WalletIcon,
  Check,
  ArrowRightLeft,
  Star,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Calculator,
} from 'lucide-react';
import { Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';
import { CustomCalculatorKeyboard } from './CustomCalculatorKeyboard';
import {
  formatExpressionWithDots,
  evaluateMathExpression,
  isMathExpression,
  parseAmountOrExpression,
} from '../utils/mathExpression';

interface WalletManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  onAddWallet: (data: Omit<Wallet, 'id' | 'createdAt'>) => void;
  onUpdateWallet: (id: string, data: Partial<Wallet>) => void;
  onSetDefaultWallet?: (id: string) => void;
  onReorderWallets?: (reordered: Wallet[]) => void;
  onDeleteWallet: (id: string) => void;
  onOpenTransferModal: () => void;
}

export const WalletManagerModal: React.FC<WalletManagerModalProps> = ({
  isOpen,
  onClose,
  wallets,
  walletBalances,
  onAddWallet,
  onUpdateWallet,
  onSetDefaultWallet,
  onReorderWallets,
  onDeleteWallet,
  onOpenTransferModal,
}) => {
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const moveWallet = (fromIndex: number, toIndex: number) => {
    if (!onReorderWallets) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= wallets.length || toIndex >= wallets.length) return;
    if (fromIndex === toIndex) return;
    const updated = [...wallets];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onReorderWallets(updated);
  };

  // Form states
  const [name, setName] = useState<string>('');
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [icon, setIcon] = useState<string>('Landmark');
  const [color, setColor] = useState<string>('#1565c0');
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState<boolean>(true);
  const amountScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (amountScrollRef.current) {
      amountScrollRef.current.scrollLeft = amountScrollRef.current.scrollWidth;
    }
  }, [initialBalance]);

  const evaluatedBalance = evaluateMathExpression(initialBalance);
  const hasBalanceExpression = isMathExpression(initialBalance);

  const getAmountFontSize = (val: string) => {
    const len = (val || '').length;
    if (len <= 8) return 'text-3xl sm:text-4xl';
    if (len <= 13) return 'text-2xl sm:text-3xl';
    if (len <= 18) return 'text-xl sm:text-2xl';
    return 'text-lg sm:text-xl';
  };

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingWallet(null);
    setName('');
    setInitialBalance('0');
    setAccountNumber('');
    setIcon('Landmark');
    setColor('#1565c0');
    setIsDefault(wallets.length === 0);
    setShowKeypad(true);
    setIsAdding(true);
  };

  const handleStartEdit = (w: Wallet) => {
    setIsAdding(false);
    setEditingWallet(w);
    setName(w.name);
    // Hiển thị số dư hiện tại thực tế để người dùng dễ dàng điều chỉnh khớp với tài khoản
    const currentBal = walletBalances[w.id] !== undefined ? walletBalances[w.id] : w.initialBalance;
    const roundedBal = Math.round(Number(currentBal) || 0);
    setInitialBalance(formatExpressionWithDots(roundedBal.toString()));
    setAccountNumber(w.accountNumber || '');
    setIcon(w.icon);
    setColor(w.color);
    setIsDefault(Boolean(w.isDefault));
    setShowKeypad(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên ví / ngân hàng!');
      return;
    }
    const numBalance = Math.round(parseAmountOrExpression(initialBalance, 0));

    if (editingWallet) {
      // Số dư hiện tại = Số dư ban đầu + Tổng biến động từ giao dịch
      // => Tổng biến động = Số dư hiện tại cũ - Số dư ban đầu cũ
      // Khi người dùng nhập Số dư hiện tại mới (numBalance):
      // Số dư ban đầu mới = Số dư hiện tại mới - Tổng biến động
      const currentOldBalance = Math.round(
        walletBalances[editingWallet.id] !== undefined
          ? walletBalances[editingWallet.id]
          : editingWallet.initialBalance
      );
      const oldInitial = Math.round(Number(editingWallet.initialBalance) || 0);
      const netTransactions = currentOldBalance - oldInitial;
      const newInitialBalance = Math.round(numBalance - netTransactions);

      onUpdateWallet(editingWallet.id, {
        name: name.trim(),
        initialBalance: newInitialBalance,
        accountNumber: accountNumber.trim(),
        icon,
        color,
        isDefault,
      });
      setEditingWallet(null);
    } else {
      onAddWallet({
        name: name.trim(),
        initialBalance: Math.round(numBalance),
        accountNumber: accountNumber.trim(),
        icon,
        color,
        isDefault,
      });
      setIsAdding(false);
    }
  };

  const availableIcons = [
    { name: 'Banknote', label: 'Tiền mặt' },
    { name: 'Building2', label: 'MB Bank' },
    { name: 'CreditCard', label: 'Timo' },
    { name: 'Landmark', label: 'BIDV/Sacombank' },
    { name: 'Smartphone', label: 'MoMo/App' },
    { name: 'PiggyBank', label: 'Tiết kiệm' },
  ];

  const availableColors = [
    '#2e7d32', // green
    '#1565c0', // blue MB
    '#7b1fa2', // purple Timo
    '#00897b', // teal BIDV
    '#c62828', // red Sacom
    '#ad1457', // pink Momo
    '#a25832', // leather
    '#4b5563', // gray
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg h-full sm:h-auto max-h-[100dvh] sm:max-h-[92vh] rounded-none sm:rounded-2xl bg-[#fffdfa] border-0 sm:border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
        {isAdding || editingWallet ? (
          <>
            {/* Header cho Form Thêm/Sửa Ví */}
            <div className="px-5 py-3.5 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingWallet(null);
                    setShowKeypad(false);
                  }}
                  className="p-1 -ml-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-base font-bold text-[#3e332a]">
                  {editingWallet ? `Chỉnh sửa ví: ${editingWallet.name}` : 'Thêm Ví / Nguồn tiền mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 rounded-xl bg-[#2e7d32] text-white text-xs font-bold hover:bg-[#256629] active:scale-95 transition shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Check className="w-4 h-4" />
                <span>{editingWallet ? 'Lưu' : 'Thêm'}</span>
              </button>
            </div>

            {/* Form Body (Scrollable) */}
            <form
              onSubmit={handleSave}
              className="p-4 sm:p-5 pb-28 sm:pb-6 overflow-y-auto space-y-4 flex-1 overscroll-contain"
            >
              {/* 1. Amount Input (Money Lover Style) */}
              <div className="pt-1 pb-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a6a58] flex items-center gap-1.5">
                    <span>{editingWallet ? 'Số dư hiện tại' : 'Số dư ban đầu'} (VNĐ)</span>
                    <span className="text-[#b94a3b]">*</span>
                    {editingWallet && (
                      <span className="text-[10px] text-amber-700 font-normal lowercase">
                        (tự cân đối)
                      </span>
                    )}
                  </label>
                  {!showKeypad && (
                    <button
                      type="button"
                      onClick={() => {
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                        setShowKeypad(true);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 transition cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mở bàn phím số</span>
                    </button>
                  )}
                </div>

                {/* Money Lover Amount Bar */}
                <div
                  onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    setShowKeypad(true);
                  }}
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
                      <span className={`${getAmountFontSize(initialBalance)} font-extrabold text-[#16a34a] tracking-tight inline-block`}>
                        {initialBalance || '0'}
                      </span>
                    </div>
                  </div>
                  {hasBalanceExpression && evaluatedBalance !== null && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg shrink-0 shadow-2xs whitespace-nowrap">
                      = {formatCurrency(Math.round(evaluatedBalance))}
                    </span>
                  )}
                </div>

                {editingWallet && (
                  <p className="text-[10px] text-[#7a6a58] mt-1.5 leading-tight">
                    💡 Nhập số tiền hiện có. Ứng dụng tự động cân đối số dư ban đầu để khớp thực tế mà không làm mất lịch sử thu chi.
                  </p>
                )}
              </div>

              {/* 2. Tên ví */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a6a58]">
                  Tên ví / Ngân hàng <span className="text-[#b94a3b]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setShowKeypad(false)}
                  placeholder="VD: Techcombank, VNPAY, Tiền mặt..."
                  required
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
                />
              </div>

              {/* 3. Số tài khoản */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a6a58]">
                  Số tài khoản / Ghi chú số thẻ
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  onFocus={() => setShowKeypad(false)}
                  placeholder="VD: 1903xxx hoặc Tiền mặt trong ví"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
                />
              </div>

              {/* Icon & Color selector */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a6a58] block mb-1">
                    Icon nhận diện
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {availableIcons.map((ic) => (
                      <button
                        type="button"
                        key={ic.name}
                        onClick={() => setIcon(ic.name)}
                        className={`w-9 h-9 rounded-xl border transition flex items-center justify-center cursor-pointer ${
                          icon === ic.name
                            ? 'bg-[#3e332a] text-white border-[#3e332a] shadow-xs scale-105'
                            : 'bg-[#fffdfa] text-[#7a6a58] border-[#ebdcc9] hover:bg-[#f5ebe0]'
                        }`}
                        title={ic.label}
                      >
                        <DynamicIcon name={ic.name} className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a6a58] block mb-1">
                    Màu sắc ví
                  </label>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {availableColors.map((cl) => (
                      <button
                        type="button"
                        key={cl}
                        onClick={() => setColor(cl)}
                        className={`w-7 h-7 rounded-full border border-white/60 transition cursor-pointer shadow-2xs ${
                          color === cl ? 'ring-2 ring-offset-2 ring-[#3e332a] scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: cl }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#a25832]"
                />
                <span className="text-xs font-semibold text-[#3e332a] flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Đặt làm ví mặc định khi ghi chép giao dịch</span>
                </span>
              </label>
            </form>

            {/* Custom Calculator Keypad Docked at Bottom */}
            {showKeypad && (
              <div className="shrink-0 border-t border-[#e5e7eb] bg-[#f9fafb] animate-in slide-in-from-bottom-2 duration-150">
                <CustomCalculatorKeyboard
                  value={initialBalance}
                  onChange={setInitialBalance}
                  quickAmounts={[50000, 100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000]}
                  onDone={() => {
                    const ev = evaluateMathExpression(initialBalance);
                    if (ev !== null && isMathExpression(initialBalance)) {
                      setInitialBalance(formatExpressionWithDots(Math.round(ev).toString()));
                    }
                    setShowKeypad(false);
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Header cho Danh sách Ví */}
            <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
                  <WalletIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#3e332a]">
                    Quản Lý Nguồn Tiền & Ví
                  </h3>
                  <p className="text-xs text-[#7a6a58]">
                    Tiền mặt, Ngân hàng, Ví điện tử
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-5 pb-24 sm:pb-5 overflow-y-auto space-y-4 flex-1">
              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#7a6a58]">
                  Danh sách ví hiện có ({wallets.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTransferModal();
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-[#ebdcc9] bg-[#fbf5eb] text-xs font-medium text-[#7a6a58] hover:text-[#3e332a] transition flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-[#a25832]" />
                    <span>Chuyển tiền</span>
                  </button>
                  <button
                    onClick={handleStartAdd}
                    className="px-3 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm ví mới</span>
                  </button>
                </div>
              </div>

              {/* Wallets List */}
              <div className="divide-y divide-[#ebdcc9] border border-[#ebdcc9] rounded-xl bg-[#fffdfa] overflow-hidden">
                {wallets.map((wallet, idx) => {
                  const currentBalance = walletBalances[wallet.id] || 0;
                  const isDragging = draggingId === wallet.id;
                  return (
                    <div
                      key={wallet.id}
                      data-wallet-index={idx}
                      draggable={Boolean(onReorderWallets && wallets.length > 1)}
                      onDragStart={() => {
                        dragIndexRef.current = idx;
                        setDraggingId(wallet.id);
                      }}
                      onDragEnter={() => {
                        const fromIdx = dragIndexRef.current;
                        if (fromIdx !== null && fromIdx !== idx) {
                          moveWallet(fromIdx, idx);
                          dragIndexRef.current = idx;
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={() => {
                        dragIndexRef.current = null;
                        setDraggingId(null);
                      }}
                      className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition select-none ${
                        isDragging ? 'bg-[#f5ebe0] ring-2 ring-[#a25832] z-10' : 'hover:bg-[#fbf5eb]/50'
                      }`}
                    >
                      {/* Drag Handle (Touch + Mouse) */}
                      {wallets.length > 1 && onReorderWallets && (
                        <div
                          onTouchStart={() => {
                            dragIndexRef.current = idx;
                            setDraggingId(wallet.id);
                          }}
                          onTouchMove={(e) => {
                            if (dragIndexRef.current === null) return;
                            const touch = e.touches[0];
                            if (!touch) return;
                            const el = document.elementFromPoint(touch.clientX, touch.clientY);
                            const row = el?.closest('[data-wallet-index]');
                            if (row) {
                              const targetIdx = Number(row.getAttribute('data-wallet-index'));
                              if (!isNaN(targetIdx) && targetIdx !== dragIndexRef.current) {
                                moveWallet(dragIndexRef.current, targetIdx);
                                dragIndexRef.current = targetIdx;
                              }
                            }
                          }}
                          onTouchEnd={() => {
                            dragIndexRef.current = null;
                            setDraggingId(null);
                          }}
                          className="p-1 -ml-1 rounded-lg text-[#a89886] hover:text-[#3e332a] active:text-[#a25832] cursor-grab active:cursor-grabbing touch-none shrink-0"
                          title="Giữ và kéo để đổi vị trí ví"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}

                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: wallet.color }}
                        >
                          <DynamicIcon name={wallet.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-[#3e332a] truncate">
                              {wallet.name}
                            </span>
                            {wallet.isDefault && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                <span>Mặc định</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs">
                            <span className="font-bold text-[#2e7d32]">
                              {formatCurrency(currentBalance)}
                            </span>
                            {wallet.accountNumber && (
                              <span className="text-[#7a6a58] text-[11px] truncate">
                                • {wallet.accountNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {wallets.length > 1 && onReorderWallets && (
                          <div className="flex flex-col mr-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveWallet(idx, idx - 1)}
                              className="p-0.5 rounded text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] disabled:opacity-25 disabled:pointer-events-none transition"
                              title="Chuyển lên trên"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === wallets.length - 1}
                              onClick={() => moveWallet(idx, idx + 1)}
                              className="p-0.5 rounded text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] disabled:opacity-25 disabled:pointer-events-none transition"
                              title="Chuyển xuống dưới"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {!wallet.isDefault && onSetDefaultWallet && (
                          <button
                            type="button"
                            onClick={() => onSetDefaultWallet(wallet.id)}
                            className="px-2 py-1 rounded-lg border border-[#ebdcc9] bg-[#fffdfa] hover:bg-amber-50 hover:border-amber-300 text-[11px] font-semibold text-[#7a6a58] hover:text-amber-800 transition flex items-center gap-1 cursor-pointer"
                            title="Đặt làm ví mặc định"
                          >
                            <Star className="w-3 h-3 text-amber-500" />
                            <span className="hidden sm:inline">Đặt mặc định</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(wallet)}
                          className="p-1.5 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition cursor-pointer"
                          title="Chỉnh sửa ví"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Xóa ví "${wallet.name}"?`)) {
                              onDeleteWallet(wallet.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-[#a89886] hover:text-[#b94a3b] hover:bg-[#f5ebe0] transition cursor-pointer"
                          title="Xóa ví"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-end shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#3e332a] text-[#fdf8f0] text-xs font-semibold hover:bg-[#2c241d] transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
