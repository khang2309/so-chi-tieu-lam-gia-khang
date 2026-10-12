import React from 'react';
import { PieChart, X } from 'lucide-react';
import { TimeFilter, Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';

interface DashboardProps {
  stats?: {
    income: number;
    expense: number;
    net: number;
    balance: number;
  };
  timeFilter: TimeFilter;
  onChangeTimeFilter: (filter: TimeFilter) => void;
  wallets?: Wallet[];
  walletBalances?: Record<string, number>;
  activeWalletId?: string;
  onSelectWallet?: (id: string) => void;
  includeAllWallets?: boolean;
  onToggleIncludeAllWallets?: (value: boolean) => void;
  categoryBreakdown: Array<{
    categoryId: string;
    name: string;
    color: string;
    icon: string;
    amount: number;
    percentage: number;
  }>;
  onOpenTransferModal?: () => void;
  onOpenWalletManager?: () => void;
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  categoryBreakdown,
  timeFilter,
  onChangeTimeFilter,
  isModal = false,
  isOpen = false,
  onClose,
}) => {
  if (isModal && !isOpen) return null;
  if (!isModal && (!categoryBreakdown || categoryBreakdown.length === 0)) return null;

  const content = (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#f0e4d5]">
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-[#a25832]" />
          <h3 className="text-sm font-bold text-[#3e332a]">
            Phân bổ chi tiêu theo danh mục
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Filter Tabs */}
          <div className="flex items-center bg-[#f5ebe0] p-0.5 rounded-lg border border-[#ebdcc9]">
            {(
              [
                { key: 'week', label: 'Tuần' },
                { key: 'month', label: 'Tháng' },
                { key: 'year', label: 'Năm' },
                { key: 'all', label: 'Tất cả' },
              ] as const
            ).map((item) => {
              const active = timeFilter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onChangeTimeFilter(item.key)}
                  className={`px-2 py-0.5 text-[11px] rounded font-medium transition ${
                    active
                      ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs font-bold'
                      : 'text-[#7a6a58] hover:text-[#3e332a]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Close button if Modal */}
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Category List */}
      {categoryBreakdown && categoryBreakdown.length > 0 ? (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {categoryBreakdown.map((item) => (
            <div key={item.categoryId} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: item.color }}
                  >
                    <DynamicIcon name={item.icon} className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-semibold text-[#3e332a]">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-[#7a6a58] font-bold">
                    {item.percentage.toFixed(1)}%
                  </span>
                  <span className="text-[#3e332a] font-bold">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full rounded-full bg-[#f5ebe0] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-[#7a6a58]">
          Chưa có chi tiêu nào trong khoảng thời gian này để phân bổ.
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-[#fffdfa] rounded-t-3xl sm:rounded-3xl border border-[#ebdcc9] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
          {content}
          <div className="p-3 bg-[#fbf5eb] border-t border-[#f0e4d5] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#a25832] text-white text-xs font-bold hover:bg-[#8c4623] transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper overflow-hidden">
      {content}
    </section>
  );
};
