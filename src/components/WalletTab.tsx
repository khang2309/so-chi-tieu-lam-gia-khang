import React, { useState, useRef, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  Plus,
  ArrowRightLeft,
  Edit3,
  Trash2,
  Check,
  Star,
  X,
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

interface WalletTabProps {
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  totalBalance: number;
  onAddWallet: (data: Omit<Wallet, 'id' | 'createdAt'>) => void;
  onUpdateWallet: (id: string, data: Partial<Wallet>) => void;
  onSetDefaultWallet?: (id: string) => void;
  onReorderWallets?: (reordered: Wallet[]) => void;
  onDeleteWallet: (id: string) => void;
  onOpenTransferModal: () => void;
}

export const WalletTab: React.FC<WalletTabProps> = ({
  wallets,
  walletBalances,
  totalBalance,
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
    { name: 'Landmark', label: 'BIDV / Sacombank' },
    { name: 'Smartphone', label: 'MoMo' },
  ];

  const availableColors = [
    '#2e7d32', // Tiền mặt xanh lá
    '#1565c0', // MB Bank xanh dương
    '#6a1b9a', // Timo tím
    '#00695c', // BIDV xanh ngọc
    '#c2185b', // Sacombank / MoMo hồng tím
    '#a25832', // Nâu đất
    '#3e332a', // Đen than
  ];

  return (
    <section className="space-y-4">
      {/* 1. Ruled Balance Overview Card */}
      <div className="relative rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#a25832] via-[#c28b38] to-[#3d7a5a]" />

        <div className="paper-lined-bg p-4 sm:p-6 border-b border-[#ebdcc9]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f5ebe0] border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58]">
                <WalletIcon className="w-3.5 h-3.5 text-[#a25832]" />
                <span>Quản Lý Nguồn Tiền & Ví</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ebe0] text-[#7a6a58] font-medium">
                {wallets.length} ví
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenTransferModal}
                className="px-2.5 py-1.5 rounded-lg border border-[#ebdcc9] bg-[#fffdfa] text-xs font-semibold text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition flex items-center gap-1.5 shadow-xs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#a25832]" />
                <span>Chuyển tiền ví</span>
              </button>

              {!isAdding && !editingWallet && (
                <button
                  onClick={handleStartAdd}
                  className="px-3 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm ví mới</span>
                </button>
              )}
            </div>
          </div>

          {/* Balance Display with Ruled lines aesthetic */}
          <div className="mt-4">
            <div className="text-xs font-serif uppercase tracking-wider text-[#a89886]">
              Tổng Số Dư Khả Dụng Hiện Tại (Tất Cả Các Ví)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl sm:text-4xl font-bold font-sans text-[#3e332a] tracking-tight">
                {formatCurrency(totalBalance)}
              </div>
              <span className="text-xs text-[#7a6a58] italic font-serif">
                (Thực tế khả dụng)
              </span>
            </div>
          </div>
        </div>

        {/* Add / Edit Form Modal (Chuẩn hóa đồng bộ giao diện như TransactionModal) */}
        {(isAdding || editingWallet) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl bg-[#fffdfa] border-0 sm:border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
              {/* Header cố định */}
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
                className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1"
              >
                {/* 1. Amount Input (Money Lover Style) - Đặt lên đầu giống TransactionModal */}
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

                  {/* Money Lover Amount Bar with clean green underline */}
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
                <div className="space-y-2.5 pt-1">
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
                          className={`w-8 h-8 rounded-lg border transition flex items-center justify-center cursor-pointer ${
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
                          className={`w-6 h-6 rounded-full border border-white/60 transition cursor-pointer shadow-2xs ${
                            color === cl ? 'ring-2 ring-offset-2 ring-[#3e332a] scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: cl }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
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
            </div>
          </div>
        )}
      </div>

      {/* 2. Wallets List Grid */}
      {wallets.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-[#d8c8b4] bg-[#fffdfa] text-center space-y-2 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-[#f5ebe0] text-[#a25832] flex items-center justify-center mx-auto">
            <WalletIcon className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-[#3e332a]">Chưa có ví / nguồn tiền nào (0 ví)</div>
          <p className="text-xs text-[#7a6a58]">
            Bấm "Thêm ví mới" ở trên hoặc đăng nhập tài khoản để đồng bộ danh sách ví của bạn.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndexRef.current !== null && dragIndexRef.current !== idx) {
                    moveWallet(dragIndexRef.current, idx);
                  }
                  dragIndexRef.current = null;
                  setDraggingId(null);
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                  setDraggingId(null);
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border transition flex items-center justify-between gap-2.5 sm:gap-3 group select-none ${
                  isDragging
                    ? 'border-[#a25832] bg-[#f5ebe0] ring-2 ring-[#a25832]/30 shadow-md'
                    : 'border-[#e8ded1] bg-[#fffdfa] shadow-paper hover:bg-[#fbf5eb]/60'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Reorder Grip Handle & Chevron Up/Down */}
                  {wallets.length > 1 && onReorderWallets && (
                    <div className="flex items-center gap-0.5 shrink-0">
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
                          const card = el?.closest('[data-wallet-index]');
                          if (card) {
                            const targetIdx = Number(card.getAttribute('data-wallet-index'));
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
                        className="p-1 -ml-1 text-[#a89886] hover:text-[#3e332a] active:text-[#a25832] cursor-grab active:cursor-grabbing touch-none"
                        title="Giữ và kéo để đổi vị trí ví"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveWallet(idx, idx - 1);
                          }}
                          className="p-0.5 rounded text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                          title="Chuyển ví lên trên"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === wallets.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveWallet(idx, idx + 1);
                          }}
                          className="p-0.5 rounded text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                          title="Chuyển ví xuống dưới"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: wallet.color }}
                  >
                    <DynamicIcon name={wallet.icon} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-[#3e332a] truncate">
                        {wallet.name}
                      </span>
                      {wallet.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                          <span>Mặc định</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#7a6a58] mt-0.5">
                      Số dư:{' '}
                      <strong className="text-sm text-[#3e332a] font-bold">
                        {formatCurrency(currentBalance)}
                      </strong>
                    </div>
                    {wallet.accountNumber && (
                      <div className="text-[11px] text-[#a89886] truncate mt-0.5">
                        STK/Thẻ: {wallet.accountNumber}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {!wallet.isDefault && onSetDefaultWallet && (
                    <button
                      type="button"
                      onClick={() => onSetDefaultWallet(wallet.id)}
                      className="px-2 py-1.5 rounded-lg border border-[#ebdcc9] bg-[#fffdfa] hover:bg-amber-50 hover:border-amber-300 text-[11px] font-semibold text-[#7a6a58] hover:text-amber-800 transition flex items-center gap-1 cursor-pointer"
                      title="Đặt làm ví mặc định"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span className="hidden sm:inline">Đặt mặc định</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleStartEdit(wallet)}
                    className="p-2 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition"
                    title="Chỉnh sửa ví"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Xóa ví "${wallet.name}"?`)) {
                        onDeleteWallet(wallet.id);
                      }
                    }}
                    className="p-2 rounded-lg text-[#a89886] hover:text-[#b94a3b] hover:bg-[#fee2e2]/60 transition"
                    title="Xóa ví"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
