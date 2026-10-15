import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Tags,
  Check,
} from 'lucide-react';
import { Category } from '../types';
import { DynamicIcon } from './DynamicIcon';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAddCategory: (data: Omit<Category, 'id'>) => void;
  onUpdateCategory: (id: string, data: Partial<Category>) => void;
  onDeleteCategory: (id: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<'expense' | 'income' | 'both'>('expense');
  const [icon, setIcon] = useState<string>('Tag');
  const [color, setColor] = useState<string>('#d97706');

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingCategory(null);
    setName('');
    setType('expense');
    setIcon('Tag');
    setColor('#d97706');
    setIsAdding(true);
  };

  const handleStartEdit = (cat: Category) => {
    setIsAdding(false);
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon);
    setColor(cat.color);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên danh mục!');
      return;
    }

    if (editingCategory) {
      onUpdateCategory(editingCategory.id, {
        name: name.trim(),
        type,
        icon,
        color,
      });
      setEditingCategory(null);
    } else {
      onAddCategory({
        name: name.trim(),
        type,
        icon,
        color,
      });
      setIsAdding(false);
    }
  };

  const availableIcons = [
    'UtensilsCrossed',
    'Coffee',
    'ShoppingBag',
    'Scissors',
    'Laptop',
    'Armchair',
    'Fuel',
    'Receipt',
    'Briefcase',
    'Gift',
    'Tag',
    'Sparkles',
  ];

  const availableColors = [
    '#d97706',
    '#92400e',
    '#db2777',
    '#0284c7',
    '#4f46e5',
    '#059669',
    '#ea580c',
    '#4b5563',
    '#16a34a',
    '#ca8a04',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a]">
                Quản Lý Danh Mục Thu / Chi
              </h3>
              <p className="text-xs text-[#7a6a58]">
                Tùy chỉnh các hạng mục chi tiêu theo nhu cầu
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
              Danh mục ({categories.length})
            </span>
            {!isAdding && !editingCategory && (
              <button
                onClick={handleStartAdd}
                className="px-3 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm danh mục mới</span>
              </button>
            )}
          </div>

          {/* Add / Edit Form Modal (Hiển thị dạng Popup trực tiếp, không bắt cuộn lên đầu trang) */}
          {(isAdding || editingCategory) && (
            <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col max-h-[82dvh] sm:max-h-[90vh] animate-in zoom-in-95 duration-150">
                {/* Header cố định */}
                <div className="shrink-0 px-5 py-3.5 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between">
                  <span className="text-sm font-bold text-[#3e332a]">
                    {editingCategory ? `Chỉnh sửa: ${editingCategory.name}` : 'Thêm danh mục mới'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingCategory(null);
                    }}
                    className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form
                  onSubmit={handleSave}
                  className="flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                  {/* Thân form cuộn mượt mà */}
                  <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 overscroll-contain">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#7a6a58]">
                        Tên danh mục:
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="VD: Du lịch, Xem phim..."
                        required
                        autoFocus
                        className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[#7a6a58]">
                        Loại danh mục:
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                      >
                        <option value="expense">Khoản Chi tiêu</option>
                        <option value="income">Khoản Thu nhập</option>
                        <option value="both">Cả hai (Thu & Chi)</option>
                      </select>
                    </div>
                  </div>

                  {/* Icon selector */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#7a6a58]">
                      Biểu tượng:
                    </label>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {availableIcons.map((ic) => (
                        <button
                          type="button"
                          key={ic}
                          onClick={() => setIcon(ic)}
                          className={`p-1.5 rounded-md border transition cursor-pointer ${
                            icon === ic
                              ? 'bg-[#3e332a] text-white border-[#3e332a]'
                              : 'bg-[#fffdfa] text-[#7a6a58] border-[#ebdcc9]'
                          }`}
                        >
                          <DynamicIcon name={ic} className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color selector */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#7a6a58]">
                      Màu sắc:
                    </label>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {availableColors.map((cl) => (
                        <button
                          type="button"
                          key={cl}
                          onClick={() => setColor(cl)}
                          className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                            color === cl ? 'ring-2 ring-[#3e332a] scale-110' : ''
                          }`}
                          style={{ backgroundColor: cl }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer cố định: Luôn nhìn thấy trên bàn phím */}
                <div className="shrink-0 px-4 py-3 bg-[#fbf5eb] border-t border-[#f0e4d5] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingCategory(null);
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
                    <span>{editingCategory ? 'Lưu cập nhật' : 'Thêm'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-2.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] flex items-center justify-between gap-2 hover:bg-[#fbf5eb]/50 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: cat.color }}
                  >
                    <DynamicIcon name={cat.icon} className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-[#3e332a] truncate block">
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-[#7a6a58]">
                      {cat.type === 'expense'
                        ? 'Chi tiêu'
                        : cat.type === 'income'
                        ? 'Thu nhập'
                        : 'Thu & Chi'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(cat)}
                    className="p-1 rounded text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Xóa danh mục "${cat.name}"?`)) {
                        onDeleteCategory(cat.id);
                      }
                    }}
                    className="p-1 rounded text-[#a89886] hover:text-[#b94a3b] hover:bg-[#f5ebe0]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
