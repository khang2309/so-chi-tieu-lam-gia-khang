import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  PieChart,
} from 'lucide-react';
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
  stats,
  timeFilter,
  onChangeTimeFilter,
  categoryBreakdown,
}) => {
  return (
    <section className="space-y-4">
      {/* 1. Statistics Card (Tổng Thu Nhập, Tổng Chi Tiêu, Chênh Lệch) */}
      <div className="relative rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper overflow-hidden">
        {/* Decorative notebook top binder edge */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#a25832] via-[#c28b38] to-[#3d7a5a]" />

        {/* 2. Time Filter Bar */}
        <div className="bg-[#fbf5eb] px-4 py-2.5 flex items-center justify-between border-b border-[#ebdcc9]">
          <div className="flex items-center gap-1.5 text-xs text-[#7a6a58]">
            <Calendar className="w-3.5 h-3.5 text-[#a25832]" />
            <span className="font-medium hidden sm:inline">Kỳ thống kê:</span>
          </div>

          <div className="flex items-center bg-[#f5ebe0] p-0.5 rounded-lg border border-[#ebdcc9]">
            {(
              [
                { key: 'week', label: 'Tuần này' },
                { key: 'month', label: 'Tháng này' },
                { key: 'year', label: 'Năm nay' },
                { key: 'all', label: 'Tất cả' },
              ] as const
            ).map((item) => {
              const active = timeFilter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onChangeTimeFilter(item.key)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                    active
                      ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                      : 'text-[#7a6a58] hover:text-[#3e332a]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Income & Expense Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#ebdcc9] bg-[#fffdfa]">
          {/* Income */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#7a6a58]">Tổng Thu Nhập</span>
              <div className="w-7 h-7 rounded-lg bg-[#2e7d32]/10 text-[#2e7d32] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-1 text-lg sm:text-xl font-bold text-[#2e7d32]">
              +{formatCurrency(stats.income)}
            </div>
            <p className="text-[11px] text-[#a89886] mt-0.5">Tiền vào các ví</p>
          </div>

          {/* Expense */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#7a6a58]">Tổng Chi Tiêu</span>
              <div className="w-7 h-7 rounded-lg bg-[#b94a3b]/10 text-[#b94a3b] flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-1 text-lg sm:text-xl font-bold text-[#b94a3b]">
              -{formatCurrency(stats.expense)}
            </div>
            <p className="text-[11px] text-[#a89886] mt-0.5">Khoản đã chi</p>
          </div>

          {/* Net Saving */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#7a6a58]">Chênh Lệch / Dư</span>
              <div className="w-7 h-7 rounded-lg bg-[#3b6e8c]/10 text-[#3b6e8c] flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`mt-1 text-lg sm:text-xl font-bold ${
                stats.net >= 0 ? 'text-[#3e332a]' : 'text-[#b94a3b]'
              }`}
            >
              {stats.net >= 0 ? '+' : ''}
              {formatCurrency(stats.net)}
            </div>
            <p className="text-[11px] text-[#a89886] mt-0.5">
              {stats.net >= 0 ? 'Dư trong kỳ' : 'Bội chi trong kỳ'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Category Expense Breakdown Widget */}
      {categoryBreakdown.length > 0 && (
        <div className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0e4d5]">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#a25832]" />
              <h3 className="text-sm font-semibold text-[#3e332a]">
                Phân bổ chi tiêu theo danh mục
              </h3>
            </div>
            <span className="text-xs text-[#7a6a58]">
              {categoryBreakdown.length} hạng mục
            </span>
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
      )}
    </section>
  );
};
