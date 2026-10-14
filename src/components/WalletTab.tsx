import React, { useState } from 'react';
import {
  Wallet as WalletIcon,
  Plus,
  ArrowRightLeft,
  Edit3,
  Trash2,
  Check,
  Star,
} from 'lucide-react';
import { Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';
import { SmartAmountInput } from './SmartAmountInput';
import { parseAmountOrExpression } from '../utils/mathExpression';

interface WalletTabProps {
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  totalBalance: number;
  onAddWallet: (data: Omit<Wallet, 'id' | 'createdAt'>) => void;
  onUpdateWallet: (id: string, data: Partial<Wallet>) => void;
  onSetDefaultWallet?: (id: string) => void;
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
  onDeleteWallet,
  onOpenTransferModal,
}) => {
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState<string>('');
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [icon, setIcon] = useState<string>('Landmark');
  const [color, setColor] = useState<string>('#1565c0');
  const [isDefault, setIsDefault] = useState<boolean>(false);

  const handleStartAdd = () => {
    setEditingWallet(null);
    setName('');
    setInitialBalance('0');
    setAccountNumber('');
    setIcon('Landmark');
    setColor('#1565c0');
    setIsDefault(wallets.length === 0);
    setIsAdding(true);
  };

  const handleStartEdit = (w: Wallet) => {
    setIsAdding(false);
    setEditingWallet(w);
    setName(w.name);
    // Hiển thị số dư hiện tại thực tế để người dùng dễ dàng điều chỉnh khớp với tài khoản
    const currentBal = walletBalances[w.id] !== undefined ? walletBalances[w.id] : w.initialBalance;
    setInitialBalance(currentBal.toString());
    setAccountNumber(w.accountNumber || '');
    setIcon(w.icon);
    setColor(w.color);
    setIsDefault(Boolean(w.isDefault));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên ví / ngân hàng!');
      return;
    }
    const numBalance = parseAmountOrExpression(initialBalance, 0);

    if (editingWallet) {
      // Số dư hiện tại = Số dư ban đầu + Tổng biến động từ giao dịch
      // => Tổng biến động = Số dư hiện tại cũ - Số dư ban đầu cũ
      // Khi người dùng nhập Số dư hiện tại mới (numBalance):
      // Số dư ban đầu mới = Số dư hiện tại mới - Tổng biến động
      const currentOldBalance =
        walletBalances[editingWallet.id] !== undefined
          ? walletBalances[editingWallet.id]
          : editingWallet.initialBalance;
      const netTransactions = currentOldBalance - editingWallet.initialBalance;
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

        {/* Add / Edit Form */}
        {(isAdding || editingWallet) && (
          <form
            onSubmit={handleSave}
            className="p-4 sm:p-5 bg-[#fbf5eb] border-b border-[#ebdcc9] space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#3e332a]">
                {editingWallet ? `Chỉnh sửa ví: ${editingWallet.name}` : 'Thêm Ví / Nguồn tiền mới'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingWallet(null);
                }}
                className="text-xs text-[#7a6a58] hover:underline"
              >
                Hủy bỏ
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58]">
                  Tên ví / Ngân hàng:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Techcombank, VNPAY..."
                  required
                  className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58] flex items-center justify-between">
                  <span>
                    {editingWallet ? 'Số dư hiện tại:' : 'Số dư ban đầu:'}
                  </span>
                  {editingWallet && (
                    <span className="text-[10px] text-amber-700 font-medium">
                      (Tự khớp giao dịch cũ)
                    </span>
                  )}
                </label>
                <div className="mt-0.5">
                  <SmartAmountInput
                    value={initialBalance}
                    onChange={setInitialBalance}
                    size="compact"
                    placeholder="0"
                  />
                </div>
                {editingWallet && (
                  <p className="text-[10px] text-[#7a6a58] mt-1 leading-tight">
                    💡 Nhập số tiền hiện có. Ứng dụng tự động cân đối số dư ban đầu để khớp thực tế mà không làm mất lịch sử thu chi.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#7a6a58]">
                Số tài khoản / Ghi chú số thẻ:
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="VD: 1903xxx hoặc Tiền mặt trong ví"
                className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs text-[#3e332a]"
              />
            </div>

            {/* Icon & Color selector */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58]">
                  Icon nhận diện:
                </label>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {availableIcons.map((ic) => (
                    <button
                      type="button"
                      key={ic.name}
                      onClick={() => setIcon(ic.name)}
                      className={`p-1.5 rounded-md border transition ${
                        icon === ic.name
                          ? 'bg-[#3e332a] text-white border-[#3e332a]'
                          : 'bg-[#fffdfa] text-[#7a6a58] border-[#ebdcc9]'
                      }`}
                    >
                      <DynamicIcon name={ic.name} className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58]">
                  Màu sắc ví:
                </label>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {availableColors.map((cl) => (
                    <button
                      type="button"
                      key={cl}
                      onClick={() => setColor(cl)}
                      className={`w-5 h-5 rounded-full border transition ${
                        color === cl ? 'ring-2 ring-[#3e332a] scale-110' : ''
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

            <div className="pt-1 flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition flex items-center gap-1 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingWallet ? 'Lưu cập nhật' : 'Thêm ví'}</span>
              </button>
            </div>
          </form>
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
          {wallets.map((wallet) => {
            const currentBalance = walletBalances[wallet.id] || 0;
            return (
              <div
                key={wallet.id}
                className="p-4 rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper hover:bg-[#fbf5eb]/60 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: wallet.color }}
                  >
                    <DynamicIcon name={wallet.icon} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
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
                  {wallets.length > 1 && (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
