import React from 'react';
import { PieChart } from 'lucide-react';
import { TimeFilter, Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';

interface DashboardProps {
  stats: {
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
}

export const Dashboard: React.FC<DashboardProps> = ({
  categoryBreakdown,
  timeFilter,
  onChangeTimeFilter,
}) => {
  if (!categoryBreakdown || categoryBreakdown.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Category Expense Breakdown Widget */}
      <div className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper p-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0e4d5]">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#a25832]" />
            <h3 className="text-sm font-semibold text-[#3e332a]">
              Phân bổ chi tiêu theo danh mục
            </h3>
          </div>
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
        </div>

          <div className="mt-3.5 space-y-3">
            {categoryBreakdown.slice(0, 5).map((item) => (
              <div key={item.categoryId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      <DynamicIcon name={item.icon} className="w-3 h-3" />
                    </span>
                    <span className="font-medium text-[#3e332a]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-[#7a6a58]">
                      {item.percentage.toFixed(1)}%
                    </span>
                    <span className="text-[#3e332a] font-semibold">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                </div>

                {/* Custom Warm Progress Bar */}
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
        </div>
    </section>
  );
};
