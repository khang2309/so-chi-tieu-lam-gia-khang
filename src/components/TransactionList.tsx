import React, { useState, useMemo } from 'react';
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
  FileSpreadsheet,
  Filter,
  ChevronDown,
  X,
  PieChart,
} from 'lucide-react';
import { Transaction, Ledger, Wallet, Category } from '../types';
import { formatCurrency, formatDateTimeDisplay } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';
import { exportTransactionsToExcel } from '../utils/excelExporter';

export type FilterMode = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

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
  activeLedgerId?: string;
  activeLedgerName?: string;
  onOpenCategoryReport?: () => void;
  categoryBreakdown?: Array<{
    categoryId: string;
    name: string;
    color: string;
    icon: string;
    amount: number;
    percentage: number;
  }>;
}

interface DayGroup {
  dateKey: string;
  dayNumber: string;
  dayLabel: string;
  monthYearString: string;
  isToday: boolean;
  isYesterday: boolean;
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
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
  activeLedgerId,
  activeLedgerName,
  onOpenCategoryReport,
  categoryBreakdown = [],
}) => {
  // 1. Quản lý trạng thái Tìm kiếm (Kính lúp thu gọn)
  const [isSearchOpen, setIsSearchOpen] = useState(() => searchQuery.trim().length > 0);

  // 2. Quản lý trạng thái Bottom Sheet Bộ lọc
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Chế độ bộ lọc thời gian: Mặc định là 'month' (Tháng)
  const [filterMode, setFilterMode] = useState<FilterMode>('month');

  // Khóa mốc thời gian đang chọn cho từng chế độ
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('week_0');
  const [selectedQuarterKey, setSelectedQuarterKey] = useState<string>(() => {
    return 'q' + (Math.floor(new Date().getMonth() / 3) + 1);
  });
  const [selectedYearKey, setSelectedYearKey] = useState<string>(() => {
    return String(new Date().getFullYear());
  });

  // Cho chế độ Ngày cụ thể hoặc Tùy chỉnh khoảng thời gian
  const [specificDate, setSpecificDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const getCategory = (catId: string) => categories.find((c) => c.id === catId);
  const getWallet = (wId: string) => wallets.find((w) => w.id === wId);
  const getLedger = (lId: string) => ledgers.find((l) => l.id === lId);

  // Lọc theo Sổ đang chọn (loại bỏ giao dịch đã xóa mềm)
  const ledgerFilteredTransactions = useMemo(() => {
    const nonDeleted = transactions.filter((t) => !t.isDeleted);
    if (activeLedgerId && activeLedgerId !== 'all') {
      return nonDeleted.filter((t) => t.ledgerId === activeLedgerId);
    }
    return nonDeleted;
  }, [transactions, activeLedgerId]);

  // Sinh danh sách các tabs cho Tháng (12 tháng trong năm + Tất cả)
  const monthTabs = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const tabs: Array<{
      key: string;
      label: string;
      year: number;
      month: number;
      isCurrent?: boolean;
    }> = [];

    for (let m = 1; m <= 12; m++) {
      const mStr = String(m).padStart(2, '0');
      const isCur = m === currentMonth;
      tabs.push({
        key: `${currentYear}-${mStr}`,
        label: isCur ? `Tháng ${mStr} (Hiện tại)` : `Tháng ${mStr}/${currentYear}`,
        year: currentYear,
        month: m,
        isCurrent: isCur,
      });
    }

    tabs.push({
      key: 'all_months',
      label: 'TẤT CẢ THÁNG',
      year: currentYear,
      month: currentMonth,
    });

    return tabs;
  }, []);

  // Sinh danh sách các tabs cho Ngày (14 ngày gần nhất)
  const dayTabs = useMemo(() => {
    const now = new Date();
    const tabs: Array<{ key: string; label: string; dateStr: string }> = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().slice(0, 10);
      let label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (i === 0) label = `Hôm nay (${label})`;
      else if (i === 1) label = `Hôm qua (${label})`;

      tabs.push({
        key: isoDate,
        label,
        dateStr: isoDate,
      });
    }

    tabs.push({
      key: 'picker',
      label: 'Chọn ngày khác...',
      dateStr: specificDate,
    });

    return tabs;
  }, [specificDate]);

  // Sinh danh sách các tabs cho Tuần (4 tuần gần đây)
  const weekTabs = useMemo(() => {
    const tabs = [
      { key: 'week_0', label: 'Tuần này' },
      { key: 'week_1', label: '1 tuần trước' },
      { key: 'week_2', label: '2 tuần trước' },
      { key: 'week_3', label: '3 tuần trước' },
      { key: 'all_weeks', label: 'TẤT CẢ TUẦN' },
    ];
    return tabs;
  }, []);

  // Sinh danh sách các tabs cho Quý
  const quarterTabs = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    return [
      { key: 'q1', label: `Quý 1/${currentYear}` },
      { key: 'q2', label: `Quý 2/${currentYear}` },
      { key: 'q3', label: `Quý 3/${currentYear}` },
      { key: 'q4', label: `Quý 4/${currentYear}` },
      { key: 'all_quarters', label: 'TẤT CẢ QUÝ' },
    ];
  }, []);

  // Sinh danh sách các tabs cho Năm
  const yearTabs = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const tabs = [];
    for (let y = currentYear; y >= currentYear - 3; y--) {
      tabs.push({ key: String(y), label: `Năm ${y}` });
    }
    tabs.push({ key: 'all_years', label: 'TẤT CẢ NĂM' });
    return tabs;
  }, []);

  // Hàm kiểm tra giao dịch có thuộc mốc thời gian đã chọn không
  const isTxInSelectedTimeline = (tx: Transaction): boolean => {
    const txDateStr = tx.date.slice(0, 10);
    const txDate = new Date(tx.date);

    switch (filterMode) {
      case 'month': {
        if (selectedMonthKey === 'all_months') return true;
        const txMonthKey = tx.date.slice(0, 7);
        return txMonthKey === selectedMonthKey;
      }
      case 'day': {
        if (selectedDayKey === 'picker') {
          return txDateStr === specificDate;
        }
        return txDateStr === selectedDayKey;
      }
      case 'week': {
        if (selectedWeekKey === 'all_weeks') return true;
        const now = new Date();
        const weekOffset = parseInt(selectedWeekKey.replace('week_', ''), 10) || 0;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() - weekOffset * 7);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return txDate >= startOfWeek && txDate <= endOfWeek;
      }
      case 'quarter': {
        if (selectedQuarterKey === 'all_quarters') return true;
        const txYear = txDate.getFullYear();
        const nowYear = new Date().getFullYear();
        if (txYear !== nowYear) return false;
        const txQuarter = Math.floor(txDate.getMonth() / 3) + 1;
        const targetQuarter = parseInt(selectedQuarterKey.replace('q', ''), 10);
        return txQuarter === targetQuarter;
      }
      case 'year': {
        if (selectedYearKey === 'all_years') return true;
        return String(txDate.getFullYear()) === selectedYearKey;
      }
      case 'custom': {
        if (!customStartDate && !customEndDate) return true;
        const start = customStartDate ? new Date(customStartDate + 'T00:00:00') : new Date('1970-01-01');
        const end = customEndDate ? new Date(customEndDate + 'T23:59:59') : new Date('2099-12-31');
        return txDate >= start && txDate <= end;
      }
      default:
        return true;
    }
  };

  // Danh sách giao dịch sau khi áp dụng toàn bộ bộ lọc
  const filteredList = useMemo(() => {
    return ledgerFilteredTransactions.filter((tx) => {
      // Tìm kiếm văn bản
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const noteMatch = (tx.note || '').toLowerCase().includes(q);
        const cat = getCategory(tx.categoryId);
        const catMatch = cat ? cat.name.toLowerCase().includes(q) : false;
        const amountMatch = String(tx.amount).includes(q);
        const wallet = getWallet(tx.walletId);
        const walletMatch = wallet ? wallet.name.toLowerCase().includes(q) : false;

        if (!noteMatch && !catMatch && !amountMatch && !walletMatch) {
          return false;
        }
      }

      // Loại giao dịch
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // Thời gian
      return isTxInSelectedTimeline(tx);
    });
  }, [
    ledgerFilteredTransactions,
    searchQuery,
    typeFilter,
    filterMode,
    selectedMonthKey,
    selectedDayKey,
    selectedWeekKey,
    selectedQuarterKey,
    selectedYearKey,
    specificDate,
    customStartDate,
    customEndDate,
  ]);

  // Thống kê tổng quan cho khoảng thời gian lọc (Thu / Chi / Ròng)
  const windowSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredList.forEach((tx) => {
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expense += tx.amount;
    });
    return {
      income,
      expense,
      net: income - expense,
      count: filteredList.length,
    };
  }, [filteredList]);

  // Gom nhóm giao dịch theo từng ngày (Daily Grouping)
  const groupedDays = useMemo(() => {
    const groups = filteredList.reduce<Record<string, Transaction[]>>((acc, tx) => {
      const dKey = tx.date.slice(0, 10);
      if (!acc[dKey]) {
        acc[dKey] = [];
      }
      acc[dKey].push(tx);
      return acc;
    }, {});

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const daysOfWeekVi = [
      'Chủ Nhật',
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
    ];

    return sortedDates.map((dateKey) => {
      const rawTxList = groups[dateKey];

      // Giao dịch mới hơn nằm trên
      const sortedTx = [...rawTxList].sort((a, b) => {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      let totalIncome = 0;
      let totalExpense = 0;
      sortedTx.forEach((tx) => {
        if (tx.type === 'income') totalIncome += tx.amount;
        else if (tx.type === 'expense') totalExpense += tx.amount;
      });

      const parsedDate = new Date(dateKey + 'T12:00:00');
      const dayNumber = String(parsedDate.getDate()).padStart(2, '0');
      const dayOfWeek = daysOfWeekVi[parsedDate.getDay()] || 'Thứ';
      const isToday = dateKey === todayStr;
      const isYesterday = dateKey === yesterdayStr;
      const dayLabel = isToday ? 'Hôm nay' : isYesterday ? 'Hôm qua' : dayOfWeek;
      const monthYearString = `tháng ${parsedDate.getMonth() + 1} ${parsedDate.getFullYear()}`;

      return {
        dateKey,
        dayNumber,
        dayLabel,
        monthYearString,
        isToday,
        isYesterday,
        totalIncome,
        totalExpense,
        transactions: sortedTx,
      } as DayGroup;
    });
  }, [filteredList]);

  // Nhãn hiển thị trên nút Chip Bộ Lọc ngoài màn hình chính
  const filterBadgeLabel = useMemo(() => {
    let modeText = '';
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (filterMode === 'month') {
      if (selectedMonthKey === 'all_months') {
        modeText = 'Tất cả tháng';
      } else {
        const parts = selectedMonthKey.split('-');
        if (parts.length === 2) {
          modeText = `Tháng ${parts[1]}/${parts[0]}`;
        } else {
          modeText = 'Tháng này';
        }
      }
    } else if (filterMode === 'day') {
      if (selectedDayKey === todayStr) {
        modeText = 'Hôm nay';
      } else if (selectedDayKey === yesterdayStr) {
        modeText = 'Hôm qua';
      } else if (selectedDayKey === 'picker') {
        modeText = specificDate
          ? `Ngày ${specificDate.slice(8, 10)}/${specificDate.slice(5, 7)}`
          : 'Ngày chọn';
      } else {
        modeText = `Ngày ${selectedDayKey.slice(8, 10)}/${selectedDayKey.slice(5, 7)}`;
      }
    } else if (filterMode === 'week') {
      modeText =
        selectedWeekKey === 'week_0'
          ? 'Tuần này'
          : selectedWeekKey === 'all_weeks'
          ? 'Tất cả tuần'
          : 'Tuần chọn';
    } else if (filterMode === 'quarter') {
      modeText = `Quý ${selectedQuarterKey.replace('q', '')}`;
    } else if (filterMode === 'year') {
      modeText = selectedYearKey === 'all_years' ? 'Tất cả năm' : `Năm ${selectedYearKey}`;
    } else if (filterMode === 'custom') {
      modeText = 'Tùy chỉnh';
    }

    if (typeFilter === 'expense') {
      return `${modeText} • Chi`;
    }
    if (typeFilter === 'income') {
      return `${modeText} • Thu`;
    }
    return modeText;
  }, [
    filterMode,
    selectedMonthKey,
    selectedDayKey,
    specificDate,
    selectedWeekKey,
    selectedQuarterKey,
    selectedYearKey,
    typeFilter,
  ]);

  // Xuất danh sách giao dịch đang hiển thị ra file Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredList.length === 0) {
      alert('Không có giao dịch nào trong khoảng thời gian đang chọn để xuất Excel!');
      return;
    }
    const cleanLedger = (activeLedgerName || 'Tat_Ca').replace(/\s+/g, '_');
    const filename = `Chi_Tieu_${cleanLedger}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportTransactionsToExcel(filteredList, categories, ledgers, wallets, filename);
  };

  return (
    <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper overflow-hidden">
      {/* 1. TOP HEADER TINH GỌN (CHỈ CÒN TIÊU ĐỀ + KÍNH LÚP + CHIP BỘ LỌC + NÚT EXCEL) */}
      <div className="p-3.5 sm:p-4 border-b border-[#f0e4d5] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Tiêu đề & Thông tin sổ */}
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="w-5 h-5 text-[#a25832] shrink-0" />
            <h2 className="text-base font-bold text-[#3e332a] truncate">
              Nhật Ký Giao Dịch
            </h2>
            {activeLedgerId && activeLedgerId !== 'all' && (
              <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-[#f5ebe0] text-[#a25832] font-semibold border border-[#ebdcc9] shrink-0 truncate max-w-[120px]">
                {activeLedgerName || ledgers.find((l) => l.id === activeLedgerId)?.name}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ebe0] text-[#7a6a58] font-medium shrink-0">
              {windowSummary.count}
            </span>
          </div>

          {/* Cụm công cụ bên phải: Kính lúp, Chip Bộ lọc, Xuất Excel */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Nút 1: Kính lúp Tìm kiếm (Thu gọn search bar) */}
            <button
              onClick={() => {
                setIsSearchOpen((prev) => !prev);
                if (isSearchOpen && searchQuery) {
                  onSearchChange('');
                }
              }}
              className={`p-2 rounded-xl transition cursor-pointer active:scale-95 ${
                isSearchOpen || searchQuery
                  ? 'bg-[#a25832] text-white shadow-xs'
                  : 'bg-[#fbf5eb] text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] border border-[#ebdcc9]'
              }`}
              title={isSearchOpen ? 'Đóng tìm kiếm' : 'Tìm kiếm giao dịch'}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Nút 2: Chip Bộ Lọc mở Bottom Sheet */}
            <button
              onClick={() => setIsFilterSheetOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#fbf5eb] hover:bg-[#f5ebe0] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
              title="Mở bộ lọc thời gian & thu chi"
            >
              <Filter className="w-3.5 h-3.5 text-[#a25832]" />
              <span className="max-w-[100px] sm:max-w-[130px] truncate">
                {filterBadgeLabel}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#7a6a58]" />
            </button>

            {/* Nút 3: Xuất Excel (.xlsx) */}
            <button
              onClick={handleExportExcel}
              className="p-2 rounded-xl bg-[#107c41]/10 text-[#107c41] hover:bg-[#107c41] hover:text-white border border-[#107c41]/30 transition shadow-xs cursor-pointer active:scale-95"
              title="Xuất Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm trượt ra khi bấm Kính lúp */}
        {isSearchOpen && (
          <div className="relative animate-in slide-in-from-top-2 duration-150 pt-1">
            <Search className="w-4 h-4 text-[#a89886] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm theo ghi chú, danh mục, số tiền, ví..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs sm:text-sm text-[#3e332a] placeholder-[#a89886] focus:outline-none focus:border-[#a25832] focus:bg-[#fffdfa] transition"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#a89886] hover:text-[#3e332a] p-1"
                title="Xóa từ khóa"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Thanh Tóm tắt tài chính nhỏ gọn (Tiền vào / Tiền ra / Chênh lệch) */}
        <div className="bg-[#fbf5eb] p-2.5 rounded-xl border border-[#ebdcc9] grid grid-cols-3 divide-x divide-[#ebdcc9] text-center shadow-xs">
          <div className="px-1">
            <div className="text-[10px] text-[#7a6a58] font-semibold uppercase tracking-wider">
              Tiền vào
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#2e7d32] mt-0.5 truncate">
              +{formatCurrency(windowSummary.income)}
            </div>
          </div>
          <div className="px-1">
            <div className="text-[10px] text-[#7a6a58] font-semibold uppercase tracking-wider">
              Tiền ra
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#b94a3b] mt-0.5 truncate">
              -{formatCurrency(windowSummary.expense)}
            </div>
          </div>
          <div className="px-1">
            <div className="text-[10px] text-[#7a6a58] font-semibold uppercase tracking-wider">
              Chênh lệch
            </div>
            <div
              className={`text-xs sm:text-sm font-bold mt-0.5 truncate ${
                windowSummary.net >= 0 ? 'text-[#3e332a]' : 'text-[#b94a3b]'
              }`}
            >
              {windowSummary.net >= 0 ? '+' : ''}
              {formatCurrency(windowSummary.net)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. DANH SÁCH GIAO DỊCH GOM NHÓM THEO NGÀY (DAILY GROUPING) */}
      <div>
        {groupedDays.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#f5ebe0] text-[#a89886] flex items-center justify-center mx-auto">
              <FileQuestion className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#3e332a]">
                Chưa có giao dịch nào trong khoảng thời gian này
              </p>
              <p className="text-xs text-[#7a6a58] mt-1">
                {activeLedgerId && activeLedgerId !== 'all'
                  ? `Đang lọc riêng cho sổ "${activeLedgerName || 'đang chọn'}". Bạn có thể ghi thêm khoản mới.`
                  : 'Hãy thử đổi mốc thời gian hoặc thêm một khoản ghi chép mới vào sổ.'}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={onOpenNewTransaction}
                className="px-3.5 py-2 rounded-lg bg-[#a25832] text-white text-xs font-medium hover:bg-[#8c4623] transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm giao dịch ngay</span>
              </button>
              <button
                onClick={onOpenReceiptScan}
                className="px-3.5 py-2 rounded-lg bg-[#f5ebe0] text-[#7a6a58] border border-[#ebdcc9] text-xs font-medium hover:bg-[#ebdcc9] transition cursor-pointer"
              >
                Quét hóa đơn
              </button>
            </div>
          </div>
        ) : (
          groupedDays.map((dayGroup) => (
            <div
              key={dayGroup.dateKey}
              className="border-b border-[#ebdcc9]/60 last:border-b-0"
            >
              {/* Header Cụm Ngày Nổi Bật (Chuẩn UX: Số ngày to, Thứ/Hôm nay, Tháng năm, Tổng tiền ngày căn phải) */}
              <div className="bg-[#fcf8f2] px-3.5 sm:px-4 py-2 border-y border-[#ebdcc9] flex items-center justify-between sticky top-0 z-10 shadow-xs">
                {/* Góc trái: Ngày (số lớn) + Nhãn (Hôm nay/Hôm qua/Thứ) + Tháng năm */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div
                    className={`text-2xl sm:text-3xl font-extrabold font-sans tracking-tight leading-none ${
                      dayGroup.isToday ? 'text-[#a25832]' : 'text-[#3e332a]'
                    }`}
                  >
                    {dayGroup.dayNumber}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#3e332a]">
                        {dayGroup.dayLabel}
                      </span>
                      {dayGroup.isToday && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#a25832] text-white font-bold">
                          Hôm nay
                        </span>
                      )}
                      {dayGroup.isYesterday && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#7a6a58] text-white font-semibold">
                          Hôm qua
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#7a6a58] capitalize">
                      {dayGroup.monthYearString}
                    </span>
                  </div>
                </div>

                {/* Góc phải: Tổng số tiền thu/chi riêng của ngày hôm đó (căn phải) */}
                <div className="text-right flex flex-col items-end">
                  {dayGroup.totalIncome > 0 && dayGroup.totalExpense > 0 ? (
                    <>
                      <div className="text-xs font-bold text-[#2e7d32]">
                        +{formatCurrency(dayGroup.totalIncome)}
                      </div>
                      <div className="text-xs font-bold text-[#b94a3b]">
                        -{formatCurrency(dayGroup.totalExpense)}
                      </div>
                    </>
                  ) : dayGroup.totalIncome > 0 ? (
                    <div className="text-xs sm:text-sm font-bold text-[#2e7d32]">
                      +{formatCurrency(dayGroup.totalIncome)}
                    </div>
                  ) : dayGroup.totalExpense > 0 ? (
                    <div className="text-xs sm:text-sm font-bold text-[#b94a3b]">
                      -{formatCurrency(dayGroup.totalExpense)}
                    </div>
                  ) : (
                    <div className="text-xs text-[#7a6a58] font-medium">0 đ</div>
                  )}
                </div>
              </div>

              {/* Các giao dịch nằm THỤT LỀ ngay bên dưới Header */}
              <div className="pl-3 sm:pl-4 ml-3 sm:ml-4 border-l-2 border-[#ebdcc9] divide-y divide-[#f7ede2] my-1">
                {dayGroup.transactions.map((tx) => {
                  const category = getCategory(tx.categoryId);
                  const wallet = getWallet(tx.walletId);
                  const toWallet = tx.toWalletId ? getWallet(tx.toWalletId) : null;
                  const ledger = getLedger(tx.ledgerId);

                  const isIncome = tx.type === 'income';
                  const isTransfer = tx.type === 'transfer';

                  return (
                    <div
                      key={tx.id}
                      className="p-2.5 sm:p-3 hover:bg-[#fbf5eb]/60 transition flex items-start justify-between gap-3 group"
                    >
                      {/* Left: Icon & Details */}
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {/* Icon Danh mục / Chuyển khoản */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5"
                          style={{
                            backgroundColor: isTransfer
                              ? '#3b6e8c'
                              : category?.color || '#a25832',
                          }}
                        >
                          {isTransfer ? (
                            <ArrowRightLeft className="w-4 h-4" />
                          ) : (
                            <DynamicIcon
                              name={category?.icon || 'Tag'}
                              className="w-4 h-4"
                            />
                          )}
                        </div>

                        {/* Chi tiết nội dung */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-xs sm:text-sm text-[#3e332a]">
                              {isTransfer
                                ? 'Chuyển tiền nội bộ'
                                : category?.name || 'Chi tiêu'}
                            </span>

                            {ledger && (
                              <span
                                className="text-[10px] px-1.5 py-0.2 rounded-md font-medium"
                                style={{
                                  backgroundColor: `${ledger.color}15`,
                                  color: ledger.color,
                                }}
                              >
                                {ledger.name}
                              </span>
                            )}
                          </div>

                          {/* Ghi chú */}
                          <p className="text-xs text-[#524438] mt-0.5 break-words line-clamp-2 whitespace-pre-line">
                            {tx.note ||
                              (isTransfer ? 'Chuyển khoản' : 'Không có ghi chú')}
                          </p>

                          {/* Split info */}
                          {tx.splitInfo && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-[#3d7a5a] bg-[#3d7a5a]/10 px-2 py-0.5 rounded-md self-start">
                              <Users className="w-3 h-3" />
                              <span>{tx.splitInfo.details}</span>
                            </div>
                          )}

                          {/* Thông tin Ví & Giờ */}
                          <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#8c7b69] mt-0.5">
                            {isTransfer ? (
                              <span>
                                {wallet?.name} → {toWallet?.name}
                              </span>
                            ) : (
                              <span>Ví: {wallet?.name || 'Không rõ'}</span>
                            )}
                            <span>•</span>
                            <span>{formatDateTimeDisplay(tx.date)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Số tiền & Nút thao tác */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div
                          className={`font-bold text-sm sm:text-base font-sans ${
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

                        {/* Nút hành động */}
                        <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition">
                          {onDuplicateTransaction && (
                            <button
                              onClick={() => onDuplicateTransaction(tx)}
                              className="p-1 rounded-md hover:bg-[#ebdcc9] text-[#7a6a58] hover:text-[#3e332a] transition cursor-pointer"
                              title="Nhân bản giao dịch này"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1 rounded-md hover:bg-[#ebdcc9] text-[#7a6a58] hover:text-[#3e332a] transition cursor-pointer"
                            title="Sửa giao dịch"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-1 rounded-md hover:bg-[#fee2e2] text-[#a89886] hover:text-[#b94a3b] transition cursor-pointer"
                            title="Xóa giao dịch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. DỜI KHỐI "PHÂN BỔ CHI TIÊU" XUỐNG DƯỚI CÙNG DANH SÁCH GIAO DỊCH */}
      <div className="p-3.5 sm:p-4 border-t border-[#f0e4d5] bg-[#fdfaf5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center shrink-0">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#3e332a]">
              Phân Bổ Chi Tiêu Theo Danh Mục
            </h4>
            <p className="text-[11px] text-[#7a6a58]">
              {categoryBreakdown.length > 0
                ? `Đã phân loại ${categoryBreakdown.length} danh mục chi tiêu`
                : 'Thống kê tỷ lệ phần trăm theo danh mục'}
            </p>
          </div>
        </div>

        {onOpenCategoryReport && (
          <button
            onClick={onOpenCategoryReport}
            className="px-3.5 py-2 rounded-xl bg-[#a25832] hover:bg-[#8c4623] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer active:scale-95"
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Xem báo cáo</span>
          </button>
        )}
      </div>

      {/* 4. BOTTOM SHEET BỘ LỌC (SLIDE UP TỪ DƯỚI LÊN) */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#fffdfa] rounded-t-3xl sm:rounded-3xl border border-[#ebdcc9] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Header Bottom Sheet */}
            <div className="p-4 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#a25832]" />
                <h3 className="text-sm font-bold text-[#3e332a]">
                  Bộ Lọc Giao Dịch
                </h3>
              </div>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f0e4d5] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thân Bottom Sheet */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Mục 1: Loại giao dịch */}
              <div>
                <label className="text-xs font-bold text-[#7a6a58] block mb-1.5 uppercase tracking-wider">
                  Loại giao dịch
                </label>
                <div className="grid grid-cols-3 p-1 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] text-xs font-semibold">
                  <button
                    onClick={() => onTypeFilterChange('all')}
                    className={`py-2 rounded-lg transition cursor-pointer ${
                      typeFilter === 'all'
                        ? 'bg-white text-[#3e332a] shadow-xs'
                        : 'text-[#7a6a58] hover:text-[#3e332a]'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => onTypeFilterChange('expense')}
                    className={`py-2 rounded-lg transition cursor-pointer ${
                      typeFilter === 'expense'
                        ? 'bg-[#b94a3b] text-white shadow-xs'
                        : 'text-[#7a6a58] hover:text-[#3e332a]'
                    }`}
                  >
                    Chi tiêu (-)
                  </button>
                  <button
                    onClick={() => onTypeFilterChange('income')}
                    className={`py-2 rounded-lg transition cursor-pointer ${
                      typeFilter === 'income'
                        ? 'bg-[#2e7d32] text-white shadow-xs'
                        : 'text-[#7a6a58] hover:text-[#3e332a]'
                    }`}
                  >
                    Thu nhập (+)
                  </button>
                </div>
              </div>

              {/* Mục 2: Chế độ thời gian */}
              <div>
                <label className="text-xs font-bold text-[#7a6a58] block mb-1.5 uppercase tracking-wider">
                  Khoảng thời gian
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { mode: 'month', label: 'Tháng' },
                      { mode: 'day', label: 'Ngày' },
                      { mode: 'week', label: 'Tuần' },
                      { mode: 'quarter', label: 'Quý' },
                      { mode: 'year', label: 'Năm' },
                      { mode: 'custom', label: 'Tùy chỉnh' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.mode}
                      onClick={() => setFilterMode(item.mode)}
                      className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        filterMode === item.mode
                          ? 'bg-[#a25832] text-white border-[#a25832] shadow-xs'
                          : 'bg-[#fbf5eb] text-[#7a6a58] border-[#ebdcc9] hover:bg-[#f5ebe0]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mục 3: Mốc thời gian cụ thể */}
              <div>
                <label className="text-xs font-bold text-[#7a6a58] block mb-1.5 uppercase tracking-wider">
                  Mốc thời gian chi tiết
                </label>

                {/* Nếu chọn Tháng */}
                {filterMode === 'month' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9]">
                    {monthTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedMonthKey(tab.key)}
                        className={`p-2 rounded-lg text-xs font-semibold transition text-center cursor-pointer ${
                          selectedMonthKey === tab.key
                            ? 'bg-[#3e332a] text-[#fdf8f0] shadow-xs'
                            : 'bg-white text-[#7a6a58] hover:text-[#3e332a] border border-[#ebdcc9]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Nếu chọn Ngày */}
                {filterMode === 'day' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9]">
                      {dayTabs.map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setSelectedDayKey(tab.key)}
                          className={`p-2 rounded-lg text-xs font-semibold transition text-center cursor-pointer ${
                            selectedDayKey === tab.key
                              ? 'bg-[#3e332a] text-[#fdf8f0] shadow-xs'
                              : 'bg-white text-[#7a6a58] hover:text-[#3e332a] border border-[#ebdcc9]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {selectedDayKey === 'picker' && (
                      <input
                        type="date"
                        value={specificDate}
                        onChange={(e) => setSpecificDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
                      />
                    )}
                  </div>
                )}

                {/* Nếu chọn Tuần */}
                {filterMode === 'week' && (
                  <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9]">
                    {weekTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedWeekKey(tab.key)}
                        className={`p-2 rounded-lg text-xs font-semibold transition text-center cursor-pointer ${
                          selectedWeekKey === tab.key
                            ? 'bg-[#3e332a] text-[#fdf8f0] shadow-xs'
                            : 'bg-white text-[#7a6a58] hover:text-[#3e332a] border border-[#ebdcc9]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Nếu chọn Quý */}
                {filterMode === 'quarter' && (
                  <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9]">
                    {quarterTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedQuarterKey(tab.key)}
                        className={`p-2 rounded-lg text-xs font-semibold transition text-center cursor-pointer ${
                          selectedQuarterKey === tab.key
                            ? 'bg-[#3e332a] text-[#fdf8f0] shadow-xs'
                            : 'bg-white text-[#7a6a58] hover:text-[#3e332a] border border-[#ebdcc9]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Nếu chọn Năm */}
                {filterMode === 'year' && (
                  <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9]">
                    {yearTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedYearKey(tab.key)}
                        className={`p-2 rounded-lg text-xs font-semibold transition text-center cursor-pointer ${
                          selectedYearKey === tab.key
                            ? 'bg-[#3e332a] text-[#fdf8f0] shadow-xs'
                            : 'bg-white text-[#7a6a58] hover:text-[#3e332a] border border-[#ebdcc9]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Nếu chọn Tùy chỉnh */}
                {filterMode === 'custom' && (
                  <div className="p-3 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9] space-y-2 text-xs">
                    <div>
                      <span className="text-[#7a6a58] font-semibold block mb-1">
                        Từ ngày:
                      </span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-[#ebdcc9] font-medium"
                      />
                    </div>
                    <div>
                      <span className="text-[#7a6a58] font-semibold block mb-1">
                        Đến ngày:
                      </span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-[#ebdcc9] font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Bottom Sheet */}
            <div className="p-4 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setFilterMode('month');
                  const now = new Date();
                  setSelectedMonthKey(
                    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                  );
                  onTypeFilterChange('all');
                }}
                className="px-4 py-2.5 rounded-xl border border-[#ebdcc9] text-xs font-bold text-[#7a6a58] hover:bg-[#ebdcc9] transition cursor-pointer"
              >
                Mặc định
              </button>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#a25832] hover:bg-[#8c4623] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>Xem {windowSummary.count} giao dịch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
