import React from 'react';
import {
  Search,
  Trash2,
  Edit3,
  Copy,
  ArrowRightLeft,
  Users,
  Receipt,
  FileQuestion,
  Plus,
} from 'lucide-react';
import { Transaction, Ledger, Wallet, Category } from '../types';
import { formatCurrency, formatDateTimeDisplay } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';

interface TransactionListProps {
  transactions: Transaction[];
  ledgers: Ledger[];
  wallets: Wallet[];
  categories: Category[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: 'all' | 'expense' | 'income';
  onTypeFilterChange: (type: 'all' | 'expense' | 'income') => void;
  onEditTransaction: (tx: Transaction) => void;
  onDuplicateTransaction?: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenNewTransaction: () => void;
  onOpenReceiptScan: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  ledgers,
  wallets,
  categories,
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
  onOpenReceiptScan,
}) => {
  const getCategory = (catId: string) => categories.find((c) => c.id === catId);
  const getWallet = (wId: string) => wallets.find((w) => w.id === wId);
  const getLedger = (lId: string) => ledgers.find((l) => l.id === lId);

  return (
    <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper overflow-hidden">
      {/* Header and Controls */}
      <div className="p-4 border-b border-[#f0e4d5] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#a25832]" />
            <h2 className="text-base font-bold text-[#3e332a]">
              Nhật Ký Giao Dịch
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ebe0] text-[#7a6a58] font-medium">
              {transactions.length}
            </span>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center bg-[#f5ebe0] p-0.5 rounded-lg border border-[#ebdcc9] self-start sm:self-auto">
            <button
              onClick={() => onTypeFilterChange('all')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                typeFilter === 'all'
                  ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => onTypeFilterChange('expense')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                typeFilter === 'expense'
                  ? 'bg-[#b94a3b] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Chi tiêu
            </button>
            <button
              onClick={() => onTypeFilterChange('income')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                typeFilter === 'income'
                  ? 'bg-[#2e7d32] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Thu nhập
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#a89886] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo ghi chú, danh mục, số tiền..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs sm:text-sm text-[#3e332a] placeholder-[#a89886] focus:outline-none focus:border-[#a25832] focus:bg-[#fffdfa] transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#a89886] hover:text-[#3e332a]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="divide-y divide-[#f0e4d5]">
        {transactions.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#f5ebe0] text-[#a89886] flex items-center justify-center mx-auto">
              <FileQuestion className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#3e332a]">
                Chưa có giao dịch nào phù hợp
              </p>
              <p className="text-xs text-[#7a6a58] mt-1">
                Hãy thử đổi bộ lọc hoặc thêm một khoản ghi chép mới vào sổ.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={onOpenNewTransaction}
                className="px-3.5 py-2 rounded-lg bg-[#a25832] text-white text-xs font-medium hover:bg-[#8c4623] transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm giao dịch ngay</span>
              </button>
              <button
                onClick={onOpenReceiptScan}
                className="px-3.5 py-2 rounded-lg bg-[#f5ebe0] text-[#7a6a58] border border-[#ebdcc9] text-xs font-medium hover:bg-[#ebdcc9] transition"
              >
                Quét hóa đơn
              </button>
            </div>
          </div>
        ) : (
          transactions.map((tx) => {
            const category = getCategory(tx.categoryId);
            const wallet = getWallet(tx.walletId);
            const toWallet = tx.toWalletId ? getWallet(tx.toWalletId) : null;
            const ledger = getLedger(tx.ledgerId);

            const isIncome = tx.type === 'income';
            const isTransfer = tx.type === 'transfer';

            return (
              <div
                key={tx.id}
                className="p-3 sm:p-4 hover:bg-[#fbf5eb]/60 transition flex items-start justify-between gap-3 group"
              >
                {/* Left: Icon & Details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Category / Transfer Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{
                      backgroundColor: isTransfer
                        ? '#3b6e8c'
                        : category?.color || '#a25832',
                    }}
                  >
                    {isTransfer ? (
                      <ArrowRightLeft className="w-5 h-5" />
                    ) : (
                      <DynamicIcon
                        name={category?.icon || 'Tag'}
                        className="w-5 h-5"
                      />
                    )}
                  </div>

                  {/* Text details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-xs sm:text-sm text-[#3e332a]">
                        {isTransfer ? 'Chuyển tiền nội bộ' : category?.name || 'Chi tiêu'}
                      </span>

                      {/* Ledger Tag */}
                      {ledger && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: `${ledger.color}15`,
                            color: ledger.color,
                          }}
                        >
                          {ledger.name}
                        </span>
                      )}

                      {/* Roommate split badge if available */}
                      {tx.splitInfo && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3d7a5a]/15 text-[#3d7a5a] font-medium flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>Chia 3 người ({formatCurrency(tx.splitInfo.perPersonAmount)}/người)</span>
                        </span>
                      )}
                    </div>

                    {/* Note */}
                    {tx.note && (
                      <p className="text-xs text-[#7a6a58] mt-0.5 truncate">
                        {tx.note}
                      </p>
                    )}

                    {/* Meta info: Date & Wallet */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#a89886]">
                      <span>{formatDateTimeDisplay(tx.date)}</span>
                      <span>•</span>
                      {isTransfer ? (
                        <span>
                          {wallet?.name || 'Ví nguồn'} ➜ {toWallet?.name || 'Ví đích'}
                        </span>
                      ) : (
                        <span>Ví: <strong className="text-[#7a6a58]">{wallet?.name || 'Tiền mặt'}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Quick Actions */}
                <div className="text-right shrink-0">
                  <div
                    className={`text-xs sm:text-base font-bold font-sans ${
                      isIncome
                        ? 'text-[#2e7d32]'
                        : isTransfer
                        ? 'text-[#3b6e8c]'
                        : 'text-[#b94a3b]'
                    }`}
                  >
                    {isIncome ? '+' : isTransfer ? '' : '-'}
                    {formatCurrency(tx.amount)}
                  </div>

                  {/* Actions (visible on hover / touch) */}
                  <div className="mt-1 flex items-center justify-end gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => onDuplicateTransaction?.(tx)}
                      title="Nhân bản giao dịch"
                      className="p-1 rounded text-[#7a6a58] hover:text-[#a25832] hover:bg-[#f5ebe0] transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onEditTransaction(tx)}
                      title="Chỉnh sửa"
                      className="p-1 rounded text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Bạn có muốn xóa khoản giao dịch này?')) {
                          onDeleteTransaction(tx.id);
                        }
                      }}
                      title="Xóa"
                      className="p-1 rounded text-[#a89886] hover:text-[#b94a3b] hover:bg-[#f5ebe0] transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
