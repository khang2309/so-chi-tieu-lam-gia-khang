import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  BookMarked,
  Check,
  Star,
  GripVertical,
  ChevronUp,
  ChevronDown,
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
  onSetDefaultLedger?: (id: string) => void;
  onReorderLedgers?: (reordered: Ledger[]) => void;
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
  onSetDefaultLedger,
  onReorderLedgers,
  onDeleteLedger,
}) => {
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [icon, setIcon] = useState<string>('BookOpen');
  const [color, setColor] = useState<string>('#a25832');
  const [isDefault, setIsDefault] = useState<boolean>(false);

  if (!isOpen) return null;

  const moveLedger = (fromIndex: number, toIndex: number) => {
    if (!onReorderLedgers) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= ledgers.length || toIndex >= ledgers.length) return;
    if (fromIndex === toIndex) return;
    const updated = [...ledgers];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onReorderLedgers(updated);
  };

  const handleStartAdd = () => {
    setEditingLedger(null);
    setName('');
    setDescription('');
    setIcon('BookOpen');
    setColor('#a25832');
    setIsDefault(ledgers.length === 0);
    setIsAdding(true);
  };

  const handleStartEdit = (l: Ledger) => {
    setIsAdding(false);
    setEditingLedger(l);
    setName(l.name);
    setDescription(l.description || '');
    setIcon(l.icon);
    setColor(l.color);
    setIsDefault(Boolean(l.isDefault));
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
        isDefault,
      });
      setEditingLedger(null);
    } else {
      onAddLedger({
        name: name.trim(),
        description: description.trim(),
        icon,
        color,
        isDefault,
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
                Chọn sổ mặc định khi mở ứng dụng hoặc tạo sổ mới
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

          {/* Add / Edit Form Modal (Hiển thị dạng Popup trực tiếp, không bắt cuộn lên đầu trang) */}
          {(isAdding || editingLedger) && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between">
                  <span className="text-sm font-bold text-[#3e332a]">
                    {editingLedger ? `Chỉnh sửa sổ: ${editingLedger.name}` : 'Thêm Sổ Chi Tiêu mới'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingLedger(null);
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
                      autoFocus
                      className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
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
                      className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs text-[#3e332a]"
                    />
                  </div>

                  {/* Icon & Color selector */}
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="text-[11px] font-semibold text-[#7a6a58] block mb-1">
                        Biểu tượng sổ:
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
                        Màu bìa sổ:
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
                      <span>Đặt làm sổ mặc định khi mở ứng dụng</span>
                    </span>
                  </label>

                  <div className="pt-2 flex justify-end gap-2 border-t border-[#f0e4d5]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdding(false);
                        setEditingLedger(null);
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#f5ebe0] transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingLedger ? 'Lưu thay đổi' : 'Tạo sổ'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Ledgers List */}
          {ledgers.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-[#d8c8b4] bg-[#fffdfa] text-center space-y-1.5">
              <div className="text-xs sm:text-sm font-bold text-[#3e332a]">
                Chưa có cuốn sổ nào (0 sổ)
              </div>
              <p className="text-xs text-[#7a6a58]">
                Bấm "Thêm sổ mới" ở trên hoặc đăng nhập để đồng bộ sổ của bạn.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {ledgers.length > 1 && (
                <div className="text-[11px] text-[#7a6a58] flex items-center gap-1 px-1">
                  <GripVertical className="w-3.5 h-3.5 text-[#a25832]" />
                  <span>Giữ biểu tượng kéo thả hoặc bấm ↑↓ để đổi thứ tự các sổ</span>
                </div>
              )}
              <div className="divide-y divide-[#ebdcc9] border border-[#ebdcc9] rounded-xl bg-[#fffdfa] overflow-hidden">
                {ledgers.map((ledger, idx) => {
                  const isActive = activeLedgerId === ledger.id;
                  const isDragging = draggingId === ledger.id;
                  return (
                    <div
                      key={ledger.id}
                      data-ledger-index={idx}
                      draggable={ledgers.length > 1}
                      onDragStart={() => {
                        dragIndexRef.current = idx;
                        setDraggingId(ledger.id);
                      }}
                      onDragEnter={() => {
                        const fromIdx = dragIndexRef.current;
                        if (fromIdx !== null && fromIdx !== idx) {
                          moveLedger(fromIdx, idx);
                          dragIndexRef.current = idx;
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={() => {
                        dragIndexRef.current = null;
                        setDraggingId(null);
                      }}
                      className={`p-2.5 sm:p-3 flex items-center justify-between gap-2 transition select-none ${
                        isDragging
                          ? 'bg-[#f5ebe0] ring-2 ring-[#a25832] z-10'
                          : isActive
                          ? 'bg-[#fbf5eb]'
                          : 'hover:bg-[#fbf5eb]/50'
                      }`}
                    >
                      {/* Drag Handle (Touch + Mouse) */}
                      {ledgers.length > 1 && (
                        <div
                          onTouchStart={() => {
                            dragIndexRef.current = idx;
                            setDraggingId(ledger.id);
                          }}
                          onTouchMove={(e) => {
                            if (dragIndexRef.current === null) return;
                            const touch = e.touches[0];
                            if (!touch) return;
                            const el = document.elementFromPoint(touch.clientX, touch.clientY);
                            const row = el?.closest('[data-ledger-index]');
                            if (row) {
                              const targetIdx = Number(row.getAttribute('data-ledger-index'));
                              if (!isNaN(targetIdx) && targetIdx !== dragIndexRef.current) {
                                moveLedger(dragIndexRef.current, targetIdx);
                                dragIndexRef.current = targetIdx;
                              }
                            }
                          }}
                          onTouchEnd={() => {
                            dragIndexRef.current = null;
                            setDraggingId(null);
                          }}
                          className="p-1.5 -ml-1 rounded-lg text-[#a89886] hover:text-[#3e332a] active:text-[#a25832] cursor-grab active:cursor-grabbing touch-none shrink-0"
                          title="Giữ và kéo để đổi vị trí sổ"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}

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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs sm:text-sm text-[#3e332a] truncate">
                              {ledger.name}
                            </span>
                            {ledger.isDefault && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                <span>Mặc định</span>
                              </span>
                            )}
                            {isActive && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3e332a] text-[#fdf8f0]">
                                Đang mở
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#7a6a58] truncate mt-0.5">
                            {ledger.description}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        {ledgers.length > 1 && onReorderLedgers && (
                          <div className="flex flex-col mr-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveLedger(idx, idx - 1)}
                              className="p-0.5 rounded text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] disabled:opacity-25 disabled:pointer-events-none transition"
                              title="Chuyển lên trên"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === ledgers.length - 1}
                              onClick={() => moveLedger(idx, idx + 1)}
                              className="p-0.5 rounded text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] disabled:opacity-25 disabled:pointer-events-none transition"
                              title="Chuyển xuống dưới"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {!ledger.isDefault && onSetDefaultLedger && (
                          <button
                            type="button"
                            onClick={() => onSetDefaultLedger(ledger.id)}
                            className="px-2 py-1 rounded-lg border border-[#ebdcc9] bg-[#fffdfa] hover:bg-amber-50 hover:border-amber-300 text-[11px] font-semibold text-[#7a6a58] hover:text-amber-800 transition flex items-center gap-1 cursor-pointer"
                            title="Đặt làm sổ mặc định"
                          >
                            <Star className="w-3 h-3 text-amber-500" />
                            <span className="hidden sm:inline">Đặt mặc định</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(ledger)}
                          className="p-1.5 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition"
                          title="Chỉnh sửa sổ"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
