import React, { useState } from 'react';
import {
  BookMarked,
  FolderPlus,
  Settings,
  ChevronDown,
  Sparkles,
  BookOpen,
  Cloud,
  WifiOff,
  Users,
} from 'lucide-react';
import { Ledger } from '../types';
import { DynamicIcon } from './DynamicIcon';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  ledgers: Ledger[];
  activeLedgerId: string;
  onSelectLedger: (id: string) => void;
  onOpenLedgerManager: () => void;
  onOpenSettings: () => void;
  onOpenRoommateSplit?: () => void;
  isAutoSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  ledgers,
  activeLedgerId,
  onSelectLedger,
  onOpenLedgerManager,
  onOpenSettings,
  onOpenRoommateSplit,
  isAutoSyncing = false,
}) => {
  const { user, isOnline, isOfflineMode, openAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeLedger = ledgers.find((l) => l.id === activeLedgerId);

  return (
    <header className="sticky top-0 z-30 bg-[#fdf8f0]/95 backdrop-blur-md border-b border-[#ebdcc9] transition-all">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Top bar with Branding and Actions */}
        <div className="flex items-center justify-between gap-3">
          {/* Logo & App Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#ebdcc9] border border-[#d8c8b4] flex items-center justify-center text-[#a25832] shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#3e332a] tracking-tight leading-tight flex items-center gap-1.5">
                Sổ Chi Tiêu của Lâm Gia Khang
                <Sparkles className="w-3.5 h-3.5 text-[#c28b38] hidden sm:inline" />
              </h1>
              <p className="text-xs text-[#7a6a58] font-serif italic">
                Sổ tay tài chính đương đại • Ghi chép mỗi ngày
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Account / Cloud Sync / Offline Status Button */}
            <button
              onClick={openAuthModal}
              title={
                user
                  ? `Tài khoản: ${user.email} (Đã đồng bộ Đám mây)`
                  : !isOnline
                  ? 'Thiết bị đang mất mạng (Chế độ Ngoại tuyến)'
                  : 'Tài khoản & Đồng bộ Đám mây (Đang dùng Ngoại tuyến)'
              }
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 shadow-xs ${
                user
                  ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#15803d]'
                  : !isOnline || isOfflineMode
                  ? 'bg-[#fef3c7] border-[#fde68a] text-[#92400e]'
                  : 'bg-[#fbf5eb] border-[#ebdcc9] text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              {user ? (
                <>
                  <Cloud className={`w-3.5 h-3.5 text-[#15803d] ${isAutoSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {isAutoSyncing ? 'Đang đồng bộ...' : (user.displayName || user.email?.split('@')[0] || 'Đã đồng bộ')}
                  </span>
                </>
              ) : !isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-[#b45309]" />
                  <span className="hidden sm:inline">Ngoại tuyến</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[#a25832]" />
                  <span className="hidden sm:inline">Tài khoản</span>
                </>
              )}
            </button>

            {/* Chia tiền phòng / trọ */}
            {onOpenRoommateSplit && (
              <button
                onClick={onOpenRoommateSplit}
                title="Chia tiền phòng / trọ"
                className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-[#3d7a5a] hover:text-[#2d5c43] hover:bg-[#eef8f2] transition flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Users className="w-3.5 h-3.5 text-[#3d7a5a]" />
                <span className="hidden sm:inline">Chia trọ</span>
              </button>
            )}

            {/* Settings & Backup */}
            <button
              onClick={onOpenSettings}
              title="Cài đặt & Sao lưu dữ liệu"
              className="p-1.5 sm:p-2 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition flex items-center gap-1.5 text-xs font-medium"
            >
              <Settings className="w-4 h-4 text-[#7a6a58]" />
              <span className="hidden sm:inline">Cài đặt</span>
            </button>
          </div>
        </div>

        {/* Ledger Selector Bar */}
        <div className="mt-2.5 pt-2 border-t border-[#f0e4d5] flex items-center justify-between gap-2">
          {/* Active Ledger Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] hover:border-[#d8c8b4] transition text-xs sm:text-sm shadow-xs"
            >
              <BookMarked className="w-4 h-4 text-[#a25832]" />
              <span className="text-[#7a6a58]">Sổ:</span>
              <span className="font-semibold text-[#3e332a]">
                {activeLedgerId === 'all'
                  ? 'Tất cả các sổ'
                  : activeLedger?.name || 'Chi tiêu cá nhân'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#7a6a58]" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-1 w-64 rounded-xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-[#a89886] uppercase tracking-wider">
                    Chọn Sổ ghi chép
                  </div>

                  <button
                    onClick={() => {
                      onSelectLedger('all');
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center gap-2.5 transition ${
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
                      className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center gap-2.5 transition ${
                        activeLedgerId === ledger.id
                          ? 'bg-[#f5ebe0] font-semibold text-[#3e332a]'
                          : 'text-[#3e332a] hover:bg-[#faf4ec]'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white"
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
                    className="w-full px-3 py-2 text-left text-xs text-[#a25832] font-medium hover:bg-[#f5ebe0] flex items-center gap-2 transition"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Quản lý & Thêm sổ mới...</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick pills for ledgers on tablet/desktop */}
          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto">
            {ledgers.map((ledger) => {
              const isSelected = activeLedgerId === ledger.id;
              return (
                <button
                  key={ledger.id}
                  onClick={() => onSelectLedger(ledger.id)}
                  className={`px-2.5 py-1 rounded-full text-xs transition flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-[#3e332a] text-[#fdf8f0] border-[#3e332a]'
                      : 'bg-[#fffdfa] text-[#7a6a58] border-[#ebdcc9] hover:border-[#d8c8b4]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ledger.color }}
                  />
                  <span>{ledger.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
