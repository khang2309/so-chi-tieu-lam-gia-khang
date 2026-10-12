import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Edit3,
  Copy,
  ArrowRightLeft,
  Users,
  FileQuestion,
  Plus,
  Filter,
  X,
} from 'lucide-react';
import { Transaction, Ledger, Wallet, Category } from '../types';
import { formatCurrency, formatDateTimeDisplay } from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';

export type FilterMode = 'month' | 'day' | 'week' | 'quarter' | 'year' | 'custom';

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
  // Quản lý Filter Sheet từ Header hoặc nội bộ
  isFilterSheetOpen?: boolean;
  setIsFilterSheetOpen?: (open: boolean) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  ledgers,
  wallets,
  categories,
  searchQuery,
  typeFilter,
  onTypeFilterChange,
  onEditTransaction,
  onDuplicateTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
  onOpenReceiptScan,
  activeLedgerId,
  activeLedgerName,
  isFilterSheetOpen: externalIsFilterSheetOpen,
  setIsFilterSheetOpen: externalSetIsFilterSheetOpen,
}) => {
  // Trạng thái mở Bottom Sheet Bộ lọc (hỗ trợ cả internal lẫn external từ Header)
  const [internalFilterSheetOpen, setInternalFilterSheetOpen] = useState(false);
  const isFilterSheetOpen =
    externalIsFilterSheetOpen !== undefined
      ? externalIsFilterSheetOpen
      : internalFilterSheetOpen;
  const setIsFilterSheetOpen =
    externalSetIsFilterSheetOpen || setInternalFilterSheetOpen;

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
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `q${q}`;
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

  // Xác thực khoảng thời gian tùy chỉnh (Từ ngày > Đến ngày)
  const isInvalidCustomDateRange = useMemo(() => {
    if (filterMode !== 'custom') return false;
    if (!customStartDate || !customEndDate) return false;
    return customStartDate > customEndDate;
  }, [filterMode, customStartDate, customEndDate]);

  const handleSwapCustomDates = () => {
    const temp = customStartDate;
    setCustomStartDate(customEndDate);
    setCustomEndDate(temp);
  };

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

  // =========================================================================
  // LOGIC THỜI GIAN ĐỘNG (DYNAMIC TIME FILTERS) - TỰ ĐỘNG SINH DỰA TRÊN DỮ LIỆU
  // TUYỆT ĐỐI KHÔNG HARDCODE MẢNG THỜI GIAN
  // =========================================================================

  // 1. Tự động sinh danh sách NĂM từ dữ liệu giao dịch thực tế + xoay quanh selectedYearKey
  // CHỈ CÓ BỘ LỌC NĂM MỚI CÓ TÙY CHỌN "TẤT CẢ" ĐỂ XEM TOÀN BỘ LỊCH SỬ
  const yearTabs = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const targetYear =
      selectedYearKey && selectedYearKey !== 'all_years'
        ? parseInt(selectedYearKey, 10)
        : currentYear;
    const yearSet = new Set<number>();
    
    // Sinh mảng động xoay quanh targetYear: 4 năm trước đến 3 năm sau
    for (let y = targetYear - 4; y <= targetYear + 3; y++) {
      yearSet.add(y);
    }

    // Quét bổ sung các năm từ giao dịch thực tế nếu có
    transactions.forEach((tx) => {
      if (tx.date) {
        const y = new Date(tx.date).getFullYear();
        if (!isNaN(y) && y >= 1990 && y <= 2100) {
          yearSet.add(y);
        }
      }
    });

    const sortedYears = Array.from(yearSet).sort((a, b) => b - a);
    const tabs: Array<{ key: string; label: string }> = sortedYears.map((y) => ({
      key: String(y),
      label: `Năm ${y}`,
    }));

    // CHỈ DUY NHẤT BỘ LỌC NĂM CÓ TÙY CHỌN "TẤT CẢ" (để xem toàn bộ lịch sử)
    tabs.push({ key: 'all_years', label: 'Tất cả các năm (Toàn bộ)' });
    return tabs;
  }, [selectedYearKey, transactions]);

  // 2. Tự động sinh danh sách THÁNG động dựa trên năm đang chọn hoặc năm hiện tại
  // (XÓA BỎ "TẤT CẢ THÁNG" theo yêu cầu)
  const monthTabs = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Xác định năm mục tiêu (nếu selectedYearKey hợp lệ thì lấy, không thì lấy currentYear)
    const targetYear =
      selectedYearKey && selectedYearKey !== 'all_years'
        ? parseInt(selectedYearKey, 10)
        : currentYear;

    const tabs: Array<{
      key: string;
      label: string;
      year: number;
      month: number;
      isCurrent?: boolean;
    }> = [];

    // Sinh 12 tháng của năm mục tiêu
    for (let m = 1; m <= 12; m++) {
      const mStr = String(m).padStart(2, '0');
      const isCur = targetYear === currentYear && m === currentMonth;
      tabs.push({
        key: `${targetYear}-${mStr}`,
        label: isCur ? `Tháng ${mStr} (Hiện tại)` : `Tháng ${mStr}/${targetYear}`,
        year: targetYear,
        month: m,
        isCurrent: isCur,
      });
    }

    // TUYỆT ĐỐI KHÔNG CÓ "all_months"
    return tabs;
  }, [selectedYearKey]);

  // 3. Tự động sinh danh sách QUÝ động dựa trên năm mục tiêu
  // (XÓA BỎ "TẤT CẢ QUÝ" theo yêu cầu)
  const quarterTabs = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const targetYear =
      selectedYearKey && selectedYearKey !== 'all_years'
        ? parseInt(selectedYearKey, 10)
        : currentYear;

    return [
      { key: 'q1', label: `Quý 1/${targetYear} (T1 - T3)` },
      { key: 'q2', label: `Quý 2/${targetYear} (T4 - T6)` },
      { key: 'q3', label: `Quý 3/${targetYear} (T7 - T9)` },
      { key: 'q4', label: `Quý 4/${targetYear} (T10 - T12)` },
    ];
    // TUYỆT ĐỐI KHÔNG CÓ "all_quarters"
  }, [selectedYearKey]);

  // 4. Tự động sinh danh sách TUẦN động xoay quanh selectedWeekKey (Dynamic Shift 2 chiều)
  // (XÓA BỎ "TẤT CẢ TUẦN" theo yêu cầu)
  const weekTabs = useMemo(() => {
    const now = new Date();
    const currOffset = parseInt(selectedWeekKey.replace('week_', ''), 10) || 0;
    const tabs: Array<{ key: string; label: string; rangeText: string }> = [];

    // Sinh 6 tuần trượt động xoay quanh currOffset (từ currOffset - 2 đến currOffset + 3)
    for (let w = currOffset - 2; w <= currOffset + 3; w++) {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() - w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startStr = `${start.getDate()}/${start.getMonth() + 1}`;
      const endStr = `${end.getDate()}/${end.getMonth() + 1}`;

      let label = '';
      if (w === 0) label = 'Tuần này';
      else if (w === 1) label = 'Tuần trước';
      else if (w === -1) label = 'Tuần sau';
      else if (w > 1) label = `${w} tuần trước`;
      else label = `${Math.abs(w)} tuần sau`;

      tabs.push({
        key: `week_${w}`,
        label,
        rangeText: `(${startStr} - ${endStr})`,
      });
    }

    // TUYỆT ĐỐI KHÔNG CÓ "all_weeks"
    return tabs;
  }, [selectedWeekKey]);

  // 5. Tự động sinh danh sách NGÀY động xoay quanh selectedDayKey (Dynamic Shift 2 chiều)
  // (XÓA BỎ "TẤT CẢ NGÀY" theo yêu cầu)
  const dayTabs = useMemo(() => {
    const baseDate =
      selectedDayKey && selectedDayKey !== 'picker'
        ? new Date(selectedDayKey)
        : new Date();
    const safeBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const todayStr = new Date().toISOString().slice(0, 10);
    const tabs: Array<{ key: string; label: string; dateStr: string }> = [];

    // Sinh 10 ngày trượt động xoay quanh ngày đang chọn (-5 đến +4)
    for (let i = -5; i <= 4; i++) {
      const d = new Date(safeBase);
      d.setDate(d.getDate() + i);
      const isoDate = d.toISOString().slice(0, 10);
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');

      let label = `${dayNum}/${monthNum}`;
      if (isoDate === todayStr) label = `Hôm nay (${label})`;

      tabs.push({
        key: isoDate,
        label,
        dateStr: isoDate,
      });
    }

    tabs.push({
      key: 'picker',
      label: 'Chọn ngày bất kỳ...',
      dateStr: specificDate,
    });

    // TUYỆT ĐỐI KHÔNG CÓ "all_days"
    return tabs;
  }, [selectedDayKey, specificDate]);

  // 6. Hàm kiểm tra giao dịch có thuộc mốc thời gian động đã chọn không
  const isTxInSelectedTimeline = (tx: Transaction): boolean => {
    const txDateStr = tx.date.slice(0, 10);
    const txDate = new Date(tx.date);

    switch (filterMode) {
      case 'month': {
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
        const targetYear =
          selectedYearKey && selectedYearKey !== 'all_years'
            ? parseInt(selectedYearKey, 10)
            : new Date().getFullYear();

        if (txDate.getFullYear() !== targetYear) return false;
        const txQuarter = Math.floor(txDate.getMonth() / 3) + 1;
        const targetQuarter = parseInt(selectedQuarterKey.replace('q', ''), 10);
        return txQuarter === targetQuarter;
      }
      case 'year': {
        // CHỈ NĂM MỚI CÓ 'all_years' ĐỂ XEM TOÀN BỘ LỊCH SỬ
        if (selectedYearKey === 'all_years') return true;
        return String(txDate.getFullYear()) === selectedYearKey;
      }
      case 'custom': {
        if (!customStartDate && !customEndDate) return true;
        const start = customStartDate
          ? new Date(customStartDate + 'T00:00:00')
          : new Date('1970-01-01');
        const end = customEndDate
          ? new Date(customEndDate + 'T23:59:59')
          : new Date('2099-12-31');
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

    return sortedDates.map((dKey) => {
      const d = new Date(dKey);
      const isToday = dKey === todayStr;
      const isYesterday = dKey === yesterdayStr;
      const dayOfWeek = daysOfWeekVi[d.getDay()] || 'Thứ...';
      const dayNumber = String(d.getDate()).padStart(2, '0');
      const monthYearString = `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;

      const dayTxs = groups[dKey].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      let dayIncome = 0;
      let dayExpense = 0;
      dayTxs.forEach((t) => {
        if (t.type === 'income') dayIncome += t.amount;
        else if (t.type === 'expense') dayExpense += t.amount;
      });

      return {
        dateKey: dKey,
        dayNumber,
        dayLabel: isToday ? 'Hôm nay' : isYesterday ? 'Hôm qua' : dayOfWeek,
        monthYearString,
        isToday,
        isYesterday,
        totalIncome: dayIncome,
        totalExpense: dayExpense,
        transactions: dayTxs,
      };
    });
  }, [filteredList]);

  // Nhãn badge tóm tắt bộ lọc
  const filterBadgeLabel = useMemo(() => {
    let modeText = '';
    if (filterMode === 'month') {
      const [y, m] = selectedMonthKey.split('-');
      modeText = `Tháng ${m}/${y}`;
    } else if (filterMode === 'day') {
      if (selectedDayKey === 'picker') {
        const [y, m, d] = specificDate.split('-');
        modeText = `${d}/${m}/${y}`;
      } else {
        const [y, m, d] = selectedDayKey.split('-');
        const todayStr = new Date().toISOString().slice(0, 10);
        modeText = selectedDayKey === todayStr ? 'Hôm nay' : `${d}/${m}/${y}`;
      }
    } else if (filterMode === 'week') {
      const tab = weekTabs.find((w) => w.key === selectedWeekKey);
      modeText = tab ? tab.label : 'Tuần';
    } else if (filterMode === 'quarter') {
      modeText = `Quý ${selectedQuarterKey.replace('q', '')}`;
    } else if (filterMode === 'year') {
      modeText = selectedYearKey === 'all_years' ? 'Tất cả các năm' : `Năm ${selectedYearKey}`;
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
    weekTabs,
  ]);

  return (
    <div className="space-y-3 pb-24 animate-in fade-in duration-200">
      {/* 1. THANH TÓM TẮT TÀI CHÍNH TINH GỌN (TIỀN VÀO / TIỀN RA / CHÊNH LỆCH) */}
      <div className="bg-white p-3 rounded-2xl border border-[#ebdcc9]/70 shadow-xs grid grid-cols-3 divide-x divide-[#f0ece5] text-center">
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

      {/* Thanh chip hiển thị mốc lọc hiện tại & số lượng giao dịch */}
      <div className="flex items-center justify-between px-1 text-xs">
        <button
          onClick={() => setIsFilterSheetOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#ebdcc9] hover:border-[#a25832] text-[#a25832] font-bold shadow-2xs hover:bg-[#fff9f4] transition cursor-pointer active:scale-95"
          title="Bấm để mở Bộ lọc"
        >
          <Filter className="w-3.5 h-3.5 text-[#a25832]" />
          <span>{filterBadgeLabel}</span>
          <span className="text-[10px] text-[#7a6a58] font-normal">▼</span>
        </button>
        <span className="font-medium text-[#8c7b69]">
          {windowSummary.count} giao dịch
        </span>
      </div>

      {/* 2. DANH SÁCH GIAO DỊCH (MODERN CARD STYLE)
          - XÓA BỎ HOÀN TOÀN ĐƯỜNG KẺ DỌC
          - MỖI NGÀY LÀ MỘT THẺ NỀN TRẮNG (#FFFFFF), BO GÓC 16px, ĐỔ BÓNG CỰC NHẸ
          - PHÂN CÁCH BẰNG ĐƯỜNG GẠCH NGANG MỜ (1px solid #F0F0F0), GIAO DỊCH CUỐI THẺ KHÔNG CÓ GẠCH */}
      <div>
        {groupedDays.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-[#ebdcc9]/70 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#f5ebe0] text-[#a89886] flex items-center justify-center mx-auto">
              <FileQuestion className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#3e332a]">
                Chưa có giao dịch nào trong khoảng thời gian này
              </p>
              <p className="text-xs text-[#7a6a58] mt-1 max-w-sm mx-auto">
                {activeLedgerId && activeLedgerId !== 'all'
                  ? `Đang lọc theo sổ "${activeLedgerName || 'đang chọn'}". Bạn có thể ghi thêm khoản mới.`
                  : 'Hãy thử đổi mốc thời gian bộ lọc hoặc ghi chép khoản chi mới.'}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={onOpenNewTransaction}
                className="px-3.5 py-2 rounded-xl bg-[#a25832] text-white text-xs font-bold hover:bg-[#8c4623] transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm giao dịch ngay</span>
              </button>
              <button
                onClick={onOpenReceiptScan}
                className="px-3.5 py-2 rounded-xl bg-[#f5ebe0] text-[#7a6a58] border border-[#ebdcc9] text-xs font-semibold hover:bg-[#ebdcc9] transition cursor-pointer"
              >
                Quét hóa đơn
              </button>
            </div>
          </div>
        ) : (
          groupedDays.map((dayGroup) => (
            <div
              key={dayGroup.dateKey}
              className="bg-white rounded-[16px] border border-[#f0ece5] shadow-xs overflow-hidden mb-3.5 transition-all"
            >
              {/* Tiêu đề ngày nằm trên cùng của thẻ */}
              <div className="px-4 py-2.5 bg-[#faf7f2]/80 border-b border-[#f0f0f0] flex items-center justify-between">
                {/* Góc trái: Ngày số lớn + Thứ/Hôm nay + Tháng năm */}
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

              {/* Các khoản giao dịch bên trong thẻ - phân cách bằng đường gạch ngang mờ (1px solid #F0F0F0), giao dịch cuối thẻ không có đường gạch */}
              <div>
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
                      className="p-3.5 hover:bg-[#faf7f2]/50 transition flex items-start justify-between gap-3 group border-b border-[#f0f0f0] last:border-b-0"
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
                            <span className="font-bold text-xs sm:text-sm text-[#3e332a]">
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
                                {wallet?.name || 'Ví nguồn'} →{' '}
                                {toWallet?.name || 'Ví đích'}
                              </span>
                            ) : (
                              <span>Ví: {wallet?.name || 'Tiền mặt'}</span>
                            )}
                            <span>•</span>
                            <span>{formatDateTimeDisplay(tx.date)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Số tiền & Nút sửa/xóa */}
                      <div className="text-right flex flex-col items-end gap-1 shrink-0">
                        <div
                          className={`text-xs sm:text-sm font-bold ${
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

      {/* 3. BOTTOM SHEET BỘ LỌC ĐỘNG (SLIDE UP TỪ DƯỚI LÊN) */}
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
              {/* Mục 1: Loại giao dịch (Thu / Chi) */}
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
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                        filterMode === item.mode
                          ? 'bg-[#a25832] text-white shadow-xs'
                          : 'bg-[#fbf5eb] text-[#7a6a58] hover:bg-[#f5ebe0] border border-[#ebdcc9]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mục 3: Tùy chọn chi tiết sinh ĐỘNG (Dynamic Filters) */}
              <div>
                <label className="text-xs font-bold text-[#7a6a58] block mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span>Mốc thời gian cụ thể</span>
                  {filterMode === 'year' && (
                    <span className="text-[10px] text-[#ea580c] font-semibold lowercase">
                      *Chọn "Tất cả các năm" để xem toàn bộ
                    </span>
                  )}
                </label>

                {/* Nếu chọn Tháng */}
                {filterMode === 'month' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-1 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9]">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-1 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9]">
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
                        value={specificDate || new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSpecificDate(val && val.trim() ? val : new Date().toISOString().slice(0, 10));
                        }}
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
                        <div>{tab.label}</div>
                        <div className="text-[10px] text-[#a89886] font-normal">
                          {tab.rangeText}
                        </div>
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

                {/* Nếu chọn Năm: CÓ TÙY CHỌN "TẤT CẢ CÁC NĂM" ĐỂ XEM TOÀN BỘ LỊCH SỬ */}
                {filterMode === 'year' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1.5 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9]">
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
                        className={`w-full px-3 py-2 rounded-lg bg-white border font-medium ${
                          isInvalidCustomDateRange ? 'border-[#b94a3b]' : 'border-[#ebdcc9]'
                        }`}
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
                        className={`w-full px-3 py-2 rounded-lg bg-white border font-medium ${
                          isInvalidCustomDateRange ? 'border-[#b94a3b]' : 'border-[#ebdcc9]'
                        }`}
                      />
                    </div>

                    {/* Dòng cảnh báo lỗi màu đỏ & nút hoán đổi */}
                    {isInvalidCustomDateRange && (
                      <div className="p-2.5 rounded-lg bg-[#fee2e2] border border-[#fca5a5] text-[#b94a3b] text-xs flex items-center justify-between gap-2 animate-in fade-in">
                        <span className="font-semibold">
                          ⚠️ "Từ ngày" không thể lớn hơn "Đến ngày"!
                        </span>
                        <button
                          type="button"
                          onClick={handleSwapCustomDates}
                          className="px-2 py-0.5 rounded bg-white border border-[#fca5a5] text-[11px] font-bold text-[#b94a3b] hover:bg-[#fff5f5] transition cursor-pointer shrink-0 shadow-2xs"
                        >
                          Hoán đổi ⇄
                        </button>
                      </div>
                    )}
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
                disabled={isInvalidCustomDateRange}
                onClick={() => setIsFilterSheetOpen(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 ${
                  isInvalidCustomDateRange
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-[#a25832] hover:bg-[#8c4623] text-white cursor-pointer active:scale-95'
                }`}
              >
                <span>
                  {isInvalidCustomDateRange
                    ? 'Khoảng ngày không hợp lệ'
                    : `Xem ${windowSummary.count} giao dịch`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
