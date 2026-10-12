import React, { useState } from 'react';
import {
  FolderPlus,
  Settings,
  ChevronDown,
  Search,
  BookOpen,
} from 'lucide-react';
import { Ledger } from '../types';
import { DynamicIcon } from './DynamicIcon';

interface HeaderProps {
  ledgers: Ledger[];
  activeLedgerId: string;
  onSelectLedger: (id: string) => void;
  onOpenLedgerManager: () => void;
  onOpenSettings: () => void;
  // Cụm công cụ Kính Lúp & Cài đặt
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  ledgers,
  activeLedgerId,
  onSelectLedger,
  onOpenLedgerManager,
  onOpenSettings,
  isSearchOpen = false,
  onToggleSearch,
  searchQuery = '',
  onSearchChange,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeLedger = ledgers.find((l) => l.id === activeLedgerId);

  return (
    <header className="sticky top-0 z-30 bg-[#fdf8f0]/95 backdrop-blur-md border-b border-[#ebdcc9] transition-all">
      <div className="max-w-4xl mx-auto px-4 py-2.5">
        {/* Hàng Header chính: Tên Sổ (trái) + Kính Lúp, Phễu, Bánh Răng (phải) */}
        <div className="flex items-center justify-between gap-3">
          {/* 1. BÊN TRÁI: Tên Sổ & Dropdown chuyển sổ */}
          <div className="relative min-w-0">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#fffdfa] border border-[#ebdcc9] hover:border-[#d8c8b4] transition text-xs sm:text-sm shadow-xs cursor-pointer max-w-full"
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 text-[10px]"
                style={{
                  backgroundColor:
                    activeLedgerId === 'all' ? '#a25832' : activeLedger?.color || '#a25832',
                }}
              >
                {activeLedgerId === 'all' ? (
                  <BookOpen className="w-3 h-3" />
                ) : (
                  <DynamicIcon name={activeLedger?.icon || 'BookMarked'} className="w-3 h-3" />
                )}
              </div>
              <span className="text-[#7a6a58] font-medium hidden sm:inline">Sổ:</span>
              <span className="font-bold text-[#3e332a] truncate max-w-[130px] sm:max-w-[200px]">
                {activeLedgerId === 'all'
                  ? 'Tất cả các sổ'
                  : activeLedger?.name || 'Chi tiêu cá nhân'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#7a6a58] shrink-0" />
            </button>

            {/* Dropdown Menu chọn sổ */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-1 w-64 rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-[#a89886] uppercase tracking-wider">
                    Chọn Sổ ghi chép
                  </div>

                  <button
                    onClick={() => {
                      onSelectLedger('all');
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center gap-2.5 transition cursor-pointer ${
                      activeLedgerId === 'all'
                        ? 'bg-[#f5ebe0] font-semibold text-[#3e332a]'
                        : 'text-[#3e332a] hover:bg-[#faf4ec]'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md bg-[#e6d8c3] flex items-center justify-center text-[#7a6a58]">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-medium">Tất cả các sổ</div>
                      <div className="text-[10px] text-[#7a6a58]">Xem tổng hợp giao dịch</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-[#f0e4d5]" />

                  {ledgers.map((ledger) => (
                    <button
                      key={ledger.id}
                      onClick={() => {
                        onSelectLedger(ledger.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center gap-2.5 transition cursor-pointer ${
                        activeLedgerId === ledger.id
                          ? 'bg-[#f5ebe0] font-semibold text-[#3e332a]'
                          : 'text-[#3e332a] hover:bg-[#faf4ec]'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: ledger.color }}
                      >
                        <DynamicIcon name={ledger.icon} className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{ledger.name}</div>
                        <div className="text-[10px] text-[#7a6a58] truncate">
                          {ledger.description}
                        </div>
                      </div>
                    </button>
                  ))}

                  <div className="my-1 border-t border-[#f0e4d5]" />

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenLedgerManager();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-[#a25832] font-semibold hover:bg-[#f5ebe0] flex items-center gap-2 transition cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Quản lý & Thêm sổ mới...</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 2. BÊN PHẢI: Cụm 3 icon [Kính Lúp], [Phễu], [Bánh Răng] */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Icon 1: Kính Lúp (Tìm kiếm) */}
            {onToggleSearch && (
              <button
                onClick={onToggleSearch}
                className={`p-2 rounded-xl transition cursor-pointer active:scale-95 ${
                  isSearchOpen || searchQuery
                    ? 'bg-[#a25832] text-white shadow-xs'
                    : 'bg-[#fffdfa] text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] border border-[#ebdcc9]'
                }`}
                title={isSearchOpen ? 'Đóng tìm kiếm' : 'Tìm kiếm giao dịch'}
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* Icon 2: Bánh Răng (Cài đặt & Sao lưu) */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-[#fffdfa] text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] border border-[#ebdcc9] transition cursor-pointer active:scale-95"
              title="Cài đặt & Sao lưu"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm trượt ra khi bấm Kính lúp */}
        {isSearchOpen && onSearchChange && (
          <div className="relative animate-in slide-in-from-top-2 duration-150 pt-2 mt-1">
            <Search className="w-4 h-4 text-[#a89886] absolute left-3 top-1/2 -translate-y-1/2 mt-1" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm theo ghi chú, danh mục, số tiền, ví..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-[#ebdcc9] text-xs sm:text-sm text-[#3e332a] placeholder-[#a89886] focus:outline-none focus:border-[#a25832] shadow-xs transition"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 text-xs text-[#a89886] hover:text-[#3e332a] p-1 cursor-pointer"
                title="Xóa từ khóa"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
