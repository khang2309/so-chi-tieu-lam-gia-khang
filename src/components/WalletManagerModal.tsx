import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Wallet as WalletIcon,
  Check,
  ArrowRightLeft,
  Star,
} from 'lucide-react';
import { Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';
import { SmartAmountInput } from './SmartAmountInput';
import { parseAmountOrExpression } from '../utils/mathExpression';

interface WalletManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  onAddWallet: (data: Omit<Wallet, 'id' | 'createdAt'>) => void;
  onUpdateWallet: (id: string, data: Partial<Wallet>) => void;
  onSetDefaultWallet?: (id: string) => void;
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
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
            className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
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
                className="px-2.5 py-1.5 rounded-lg border border-[#ebdcc9] bg-[#fbf5eb] text-xs font-medium text-[#7a6a58] hover:text-[#3e332a] transition flex items-center gap-1"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#a25832]" />
                <span>Chuyển tiền</span>
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

          {/* Add / Edit Form Modal (Hiển thị dạng Popup trực tiếp, không bắt cuộn lên đầu trang) */}
          {(isAdding || editingWallet) && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between">
                  <span className="text-sm font-bold text-[#3e332a]">
                    {editingWallet ? `Chỉnh sửa ví: ${editingWallet.name}` : 'Thêm Ví / Nguồn tiền mới'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingWallet(null);
                    }}
                    className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form
                  onSubmit={handleSave}
                  className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto"
                >
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
                        autoFocus
                        className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
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
                      className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs text-[#3e332a]"
                    />
                  </div>

                  {/* Icon & Color selector */}
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="text-[11px] font-semibold text-[#7a6a58] block mb-1">
                        Icon nhận diện:
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
                      <label className="text-[11px] font-semibold text-[#7a6a58] block mb-1">
                        Màu sắc ví:
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

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#f0e4d5]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdding(false);
                        setEditingWallet(null);
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#f5ebe0] transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingWallet ? 'Lưu cập nhật' : 'Thêm ví'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Wallets List */}
          <div className="divide-y divide-[#ebdcc9] border border-[#ebdcc9] rounded-xl bg-[#fffdfa] overflow-hidden">
            {wallets.map((wallet) => {
              const currentBalance = walletBalances[wallet.id] || 0;
              return (
                <div
                  key={wallet.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-[#fbf5eb]/60 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <DynamicIcon name={wallet.icon} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs sm:text-sm text-[#3e332a] truncate">
                          {wallet.name}
                        </span>
                        {wallet.isDefault && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                            <span>Mặc định</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#7a6a58]">
                        Số dư hiện tại:{' '}
                        <strong className="text-[#3e332a]">
                          {formatCurrency(currentBalance)}
                        </strong>
                        {wallet.accountNumber && (
                          <span className="text-[#a89886] ml-1.5">
                            • {wallet.accountNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
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
                      className="p-1.5 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition"
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
                      className="p-1.5 rounded-lg text-[#a89886] hover:text-[#b94a3b] hover:bg-[#f5ebe0] transition"
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
        <div className="p-4 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#3e332a] text-[#fdf8f0] text-xs font-semibold hover:bg-[#2c241d] transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
