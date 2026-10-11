import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  BookMarked,
  Check,
} from 'lucide-react';
import { Ledger } from '../types';
import { DynamicIcon } from './DynamicIcon';

interface LedgerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgers: Ledger[];
  activeLedgerId: string;
  onSelectLedger: (id: string) => void;
  onAddLedger: (data: Omit<Ledger, 'id' | 'createdAt'>) => void;
  onUpdateLedger: (id: string, data: Partial<Ledger>) => void;
  onDeleteLedger: (id: string) => void;
}

export const LedgerManagerModal: React.FC<LedgerManagerModalProps> = ({
  isOpen,
  onClose,
  ledgers,
  activeLedgerId,
  onSelectLedger,
  onAddLedger,
  onUpdateLedger,
  onDeleteLedger,
}) => {
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [icon, setIcon] = useState<string>('BookOpen');
  const [color, setColor] = useState<string>('#a25832');

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingLedger(null);
    setName('');
    setDescription('');
    setIcon('BookOpen');
    setColor('#a25832');
    setIsAdding(true);
  };

  const handleStartEdit = (l: Ledger) => {
    setIsAdding(false);
    setEditingLedger(l);
    setName(l.name);
    setDescription(l.description || '');
    setIcon(l.icon);
    setColor(l.color);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên sổ chi tiêu!');
      return;
    }

    if (editingLedger) {
      onUpdateLedger(editingLedger.id, {
        name: name.trim(),
        description: description.trim(),
        icon,
        color,
      });
      setEditingLedger(null);
    } else {
      onAddLedger({
        name: name.trim(),
        description: description.trim(),
        icon,
        color,
      });
      setIsAdding(false);
    }
  };

  const availableIcons = [
    { name: 'User', label: 'Cá nhân' },
    { name: 'Home', label: 'Tiền trọ' },
    { name: 'Trees', label: 'Quê nhà' },
    { name: 'BookOpen', label: 'Sổ tay' },
    { name: 'TrendingUp', label: 'Đầu tư' },
    { name: 'Sparkles', label: 'Dự án' },
  ];

  const availableColors = [
    '#a25832', // Leather da bò
    '#3d7a5a', // Xanh lá ấm
    '#3b6e8c', // Xanh xám
    '#b24c43', // Đỏ đất
    '#c28b38', // Vàng da
    '#6b21a8', // Tím cổ điển
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
              <BookMarked className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a]">
                Quản Lý Các Cuốn Sổ Chi Tiêu
              </h3>
              <p className="text-xs text-[#7a6a58]">
                Tạo sổ độc lập cho từng mục đích chi tiêu
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7a6a58]">
              Danh sách sổ ({ledgers.length})
            </span>
            {!isAdding && !editingLedger && (
              <button
                onClick={handleStartAdd}
                className="px-3 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm sổ mới</span>
              </button>
            )}
          </div>

          {/* Add / Edit Form */}
          {(isAdding || editingLedger) && (
            <form
              onSubmit={handleSave}
              className="p-4 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3e332a]">
                  {editingLedger ? `Chỉnh sửa sổ: ${editingLedger.name}` : 'Thêm Sổ Chi Tiêu mới'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingLedger(null);
                  }}
                  className="text-xs text-[#7a6a58] hover:underline"
                >
                  Hủy bỏ
                </button>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58]">
                  Tên sổ chi tiêu:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Quỹ du lịch, Đám cưới..."
                  required
                  className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58]">
                  Mô tả mục đích:
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="VD: Ghi chép chi tiêu riêng biệt"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs text-[#3e332a]"
                />
              </div>

              {/* Icon & Color selector */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#7a6a58]">
                    Biểu tượng sổ:
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
                    Màu bìa sổ:
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
                  <span>{editingLedger ? 'Lưu thay đổi' : 'Tạo sổ'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Ledgers List */}
          <div className="divide-y divide-[#ebdcc9] border border-[#ebdcc9] rounded-xl bg-[#fffdfa] overflow-hidden">
            {ledgers.map((ledger) => {
              const isActive = activeLedgerId === ledger.id;
              return (
                <div
                  key={ledger.id}
                  className={`p-3 flex items-center justify-between gap-3 transition ${
                    isActive ? 'bg-[#fbf5eb]' : 'hover:bg-[#fbf5eb]/50'
                  }`}
                >
                  <div
                    onClick={() => {
                      onSelectLedger(ledger.id);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: ledger.color }}
                    >
                      <DynamicIcon name={ledger.icon} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-[#3e332a] truncate">
                          {ledger.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#3e332a] text-[#fdf8f0]">
                            Đang mở
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#7a6a58] truncate">
                        {ledger.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(ledger)}
                      className="p-1.5 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition"
                      title="Chỉnh sửa sổ"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {ledgers.length > 1 && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Bạn có chắc muốn xóa sổ "${ledger.name}"?`)) {
                            onDeleteLedger(ledger.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-[#a89886] hover:text-[#b94a3b] hover:bg-[#f5ebe0] transition"
                        title="Xóa sổ"
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
