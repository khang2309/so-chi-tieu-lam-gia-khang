import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Wallet as WalletIcon,
  Check,
  ArrowRightLeft,
} from 'lucide-react';
import { Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';

interface WalletManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  onAddWallet: (data: Omit<Wallet, 'id' | 'createdAt'>) => void;
  onUpdateWallet: (id: string, data: Partial<Wallet>) => void;
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

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingWallet(null);
    setName('');
    setInitialBalance('0');
    setAccountNumber('');
    setIcon('Landmark');
    setColor('#1565c0');
    setIsAdding(true);
  };

  const handleStartEdit = (w: Wallet) => {
    setIsAdding(false);
    setEditingWallet(w);
    setName(w.name);
    setInitialBalance(w.initialBalance.toString());
    setAccountNumber(w.accountNumber || '');
    setIcon(w.icon);
    setColor(w.color);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên ví / ngân hàng!');
      return;
    }
    const numBalance = parseFloat(initialBalance.replace(/[^0-9]/g, '')) || 0;

    if (editingWallet) {
      onUpdateWallet(editingWallet.id, {
        name: name.trim(),
        initialBalance: numBalance,
        accountNumber: accountNumber.trim(),
        icon,
        color,
      });
      setEditingWallet(null);
    } else {
      onAddWallet({
        name: name.trim(),
        initialBalance: numBalance,
        accountNumber: accountNumber.trim(),
        icon,
        color,
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

          {/* Add / Edit Form */}
          {(isAdding || editingWallet) && (
            <form
              onSubmit={handleSave}
              className="p-4 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] space-y-3"
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
                    className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#7a6a58]">
                    Số dư ban đầu:
                  </label>
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                  />
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#7a6a58]">
                    Icon nhận diện:
                  </label>
                  <div className="flex items-center gap-1 mt-1">
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
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
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
                      <div className="font-semibold text-xs sm:text-sm text-[#3e332a] truncate">
                        {wallet.name}
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
                    <button
                      onClick={() => handleStartEdit(wallet)}
                      className="p-1.5 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition"
                      title="Chỉnh sửa ví"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {wallets.length > 1 && (
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
                    )}
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
