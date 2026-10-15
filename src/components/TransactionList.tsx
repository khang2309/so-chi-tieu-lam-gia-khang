import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Trash2,
  Edit3,
  Copy,
  ArrowRightLeft,
  Users,
  FileQuestion,
  Plus,
  Filter,
  Calendar,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Transaction, Ledger, Wallet, Category } from '../types';
import {
  formatCurrency,
  formatDateTimeDisplay,
  toLocalDateKey,
  toLocalMonthKey,
  parseLocalDateKey,
} from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';

export type FilterMode = 'month' | 'day' | 'week' | 'quarter' | 'year' | 'all' | 'custom';

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
  // Quản lý Filter Sheet thời gian từ Header hoặc nội bộ
  isFilterSheetOpen?: boolean;
  setIsFilterSheetOpen?: (open: boolean) => void;
  // Quản lý Bộ lọc Danh mục bằng Icon Phễu (CHỈ TẠI SỔ CÁI)
  selectedCategoryId?: string;
  onSelectCategory?: (categoryId: string) => void;
  isCategoryFilterSheetOpen?: boolean;
  setIsCategoryFilterSheetOpen?: (open: boolean) => void;
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
  selectedCategoryId: externalSelectedCategoryId,
  onSelectCategory: externalOnSelectCategory,
  isCategoryFilterSheetOpen: externalIsCategoryFilterSheetOpen,
  setIsCategoryFilterSheetOpen: externalSetIsCategoryFilterSheetOpen,
}) => {
  // Trạng thái mở Bottom Sheet Bộ lọc Thời gian
  const [internalFilterSheetOpen, setInternalFilterSheetOpen] = useState(false);
  const isFilterSheetOpen =
    externalIsFilterSheetOpen !== undefined
      ? externalIsFilterSheetOpen
      : internalFilterSheetOpen;
  const setIsFilterSheetOpen =
    externalSetIsFilterSheetOpen || setInternalFilterSheetOpen;

  // Trạng thái mở Bottom Sheet Bộ lọc Danh mục (Icon Phễu)
  const [internalCategoryFilterSheetOpen, setInternalCategoryFilterSheetOpen] = useState(false);
  const isCategoryFilterSheetOpen =
    externalIsCategoryFilterSheetOpen !== undefined
      ? externalIsCategoryFilterSheetOpen
      : internalCategoryFilterSheetOpen;
  const setIsCategoryFilterSheetOpen =
    externalSetIsCategoryFilterSheetOpen || setInternalCategoryFilterSheetOpen;

  const [internalSelectedCategoryId, setInternalSelectedCategoryId] = useState<string>('all');
  const selectedCategoryId =
    externalSelectedCategoryId !== undefined
      ? externalSelectedCategoryId
      : internalSelectedCategoryId;
  const setSelectedCategoryId =
    externalOnSelectCategory || setInternalSelectedCategoryId;

  // Chế độ bộ lọc thời gian: Mặc định là 'month' (Tháng)
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);

  // Khóa mốc thời gian đang chọn cho từng chế độ
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    return toLocalMonthKey(new Date());
  });

  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => {
    return toLocalDateKey(new Date());
  });

  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('week_0');

  const [selectedQuarterKey, setSelectedQuarterKey] = useState<string>(() => {
    return 'q_curr';
  });

  const [selectedYearKey, setSelectedYearKey] = useState<string>(() => {
    return 'year_curr';
  });

  // Cho chế độ Ngày cụ thể hoặc Tùy chỉnh khoảng thời gian
  const [specificDate, setSpecificDate] = useState<string>(
    toLocalDateKey(new Date())
  );
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  // Số năm lùi về quá khứ mở rộng linh hoạt, cuộn vô tận không giới hạn
  const [historyYearsBack, setHistoryYearsBack] = useState<number>(15);

  // Danh sách các tùy chọn khoảng thời gian (Money Lover UX)
  const periodModes: Array<{ key: FilterMode; label: string }> = [
    { key: 'day', label: 'Ngày' },
    { key: 'week', label: 'Tuần' },
    { key: 'month', label: 'Tháng' },
    { key: 'quarter', label: 'Quý' },
    { key: 'year', label: 'Năm' },
    { key: 'all', label: 'Tất cả' },
    { key: 'custom', label: 'Tuỳ chỉnh' },
  ];

  const periodModeLabel = useMemo(() => {
    switch (filterMode) {
      case 'day':
        return 'Ngày';
      case 'week':
        return 'Tuần';
      case 'month':
        return 'Tháng';
      case 'quarter':
        return 'Quý';
      case 'year':
        return 'Năm';
      case 'all':
        return 'Tất cả';
      case 'custom':
        return 'Tuỳ chỉnh';
      default:
        return 'Thời gian';
    }
  }, [filterMode]);

  const handleSelectPeriodMode = (mode: FilterMode) => {
    setFilterMode(mode);
    setIsPeriodMenuOpen(false);
    const now = new Date();
    if (mode === 'week') {
      setSelectedWeekKey('week_0');
    } else if (mode === 'month') {
      setSelectedMonthKey(toLocalMonthKey(now));
    } else if (mode === 'quarter') {
      setSelectedQuarterKey('q_curr');
    } else if (mode === 'year') {
      setSelectedYearKey('year_curr');
    } else if (mode === 'day') {
      setSelectedDayKey(toLocalDateKey(now));
    } else if (mode === 'custom') {
      if (!customStartDate) {
        const d = new Date();
        d.setDate(1);
        setCustomStartDate(toLocalDateKey(d));
      }
      if (!customEndDate) {
        setCustomEndDate(toLocalDateKey(new Date()));
      }
    }
  };

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
        ? parseLocalDateKey(selectedDayKey)
        : new Date();
    const safeBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const todayStr = toLocalDateKey(new Date());
    const tabs: Array<{ key: string; label: string; dateStr: string }> = [];

    // Sinh 10 ngày trượt động xoay quanh ngày đang chọn (-5 đến +4)
    for (let i = -5; i <= 4; i++) {
      const d = new Date(safeBase);
      d.setDate(d.getDate() + i);
      const isoDate = toLocalDateKey(d);
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

  // Tìm ngày giao dịch sớm nhất trong danh sách để tạo mốc thời gian không giới hạn
  const earliestTxDate = useMemo(() => {
    let earliest = new Date();
    transactions.forEach((tx) => {
      if (tx.date) {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime()) && d < earliest && d.getFullYear() >= 2000) {
          earliest = d;
        }
      }
    });
    return earliest;
  }, [transactions]);

  // Ref container và tab đang chọn để tự động căn giữa (Center active tab)
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  const centerActiveTab = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (activeTabRef.current && sliderContainerRef.current) {
      const container = sliderContainerRef.current;
      const tab = activeTabRef.current;
      const tabLeft = tab.offsetLeft;
      const tabWidth = tab.offsetWidth;
      const containerWidth = container.offsetWidth;
      const targetScrollLeft = tabLeft - containerWidth / 2 + tabWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior,
      });
    }
  }, []);

  useEffect(() => {
    // Tự động căn giữa tab đang chọn ngay khi mount hoặc khi đổi mốc thời gian
    centerActiveTab('auto');
    const timer = setTimeout(() => {
      centerActiveTab('smooth');
    }, 60);
    return () => clearTimeout(timer);
  }, [
    filterMode,
    selectedMonthKey,
    selectedWeekKey,
    selectedQuarterKey,
    selectedYearKey,
    selectedDayKey,
    centerActiveTab,
  ]);

  // 6. Tự động sinh danh sách Tabs trượt động (Trước / Hiện tại / Tương lai) - Động 100%, Không giới hạn
  const timelineSliderTabs = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    // -------------------------------------------------------------
    // CHẾ ĐỘ: THÁNG (Không giới hạn, quét từ năm sớm nhất đến hiện tại + tương lai)
    // -------------------------------------------------------------
    if (filterMode === 'month') {
      let startYear = Math.min(curYear - historyYearsBack, earliestTxDate.getFullYear() - 5);
      if (selectedMonthKey && selectedMonthKey !== 'month_future') {
        const parsedYear = parseInt(selectedMonthKey.split('-')[0], 10);
        if (!isNaN(parsedYear) && parsedYear < startYear) {
          startYear = parsedYear;
        }
      }

      const tabs: Array<{
        key: string;
        label: string;
        isActive: boolean;
        onSelect: () => void;
      }> = [];

      for (let y = startYear; y <= curYear; y++) {
        const maxM = y === curYear ? curMonth : 12;
        for (let m = 1; m <= maxM; m++) {
          const mKey = `${y}-${String(m).padStart(2, '0')}`;
          let label = `THÁNG ${m}/${y}`;

          if (y === curYear && m === curMonth) {
            label = 'THÁNG NÀY';
          } else {
            const isPrevMonth =
              (curMonth === 1 && y === curYear - 1 && m === 12) ||
              (curMonth > 1 && y === curYear && m === curMonth - 1);
            if (isPrevMonth) {
              label = 'THÁNG TRƯỚC';
            }
          }

          tabs.push({
            key: mKey,
            label,
            isActive: selectedMonthKey === mKey,
            onSelect: () => setSelectedMonthKey(mKey),
          });
        }
      }

      tabs.push({
        key: 'month_future',
        label: 'TƯƠNG LAI',
        isActive: selectedMonthKey === 'month_future',
        onSelect: () => setSelectedMonthKey('month_future'),
      });

      return tabs;
    }

    // -------------------------------------------------------------
    // CHẾ ĐỘ: TUẦN (Không giới hạn, quét từ các tuần trước về tuần này + tương lai)
    // -------------------------------------------------------------
    if (filterMode === 'week') {
      const tabs: Array<{
        key: string;
        label: string;
        isActive: boolean;
        onSelect: () => void;
      }> = [];

      const totalWeeks = Math.max(52, historyYearsBack * 26);
      for (let w = totalWeeks; w >= 0; w--) {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay() - w * 7);

        let label = `TUẦN ${start.getDate()}/${start.getMonth() + 1}`;
        if (w === 0) label = 'TUẦN NÀY';
        else if (w === 1) label = 'TUẦN TRƯỚC';
        else if (w === 2) label = '2 TUẦN TRƯỚC';

        tabs.push({
          key: `week_${w}`,
          label,
          isActive: selectedWeekKey === `week_${w}`,
          onSelect: () => setSelectedWeekKey(`week_${w}`),
        });
      }

      tabs.push({
        key: 'week_future',
        label: 'TƯƠNG LAI',
        isActive: selectedWeekKey === 'week_future',
        onSelect: () => setSelectedWeekKey('week_future'),
      });

      return tabs;
    }

    // -------------------------------------------------------------
    // CHẾ ĐỘ: NGÀY (Quét từ các ngày trước về hôm nay + tương lai + chọn ngày)
    // -------------------------------------------------------------
    if (filterMode === 'day') {
      const tabs: Array<{
        key: string;
        label: string;
        isActive: boolean;
        onSelect: () => void;
      }> = [];

      const totalDays = Math.max(90, Math.min(historyYearsBack * 90, 730));
      for (let i = -totalDays; i <= 0; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dStr = toLocalDateKey(d);

        let label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (i === 0) label = 'HÔM NAY';
        else if (i === -1) label = 'HÔM QUA';
        else if (i === -2) label = 'HÔM KIA';

        tabs.push({
          key: dStr,
          label,
          isActive: selectedDayKey === dStr,
          onSelect: () => setSelectedDayKey(dStr),
        });
      }

      tabs.push({
        key: 'day_future',
        label: 'TƯƠNG LAI',
        isActive: selectedDayKey === 'day_future',
        onSelect: () => setSelectedDayKey('day_future'),
      });

      tabs.push({
        key: 'picker',
        label: 'CHỌN NGÀY...',
        isActive: selectedDayKey === 'picker',
        onSelect: () => setSelectedDayKey('picker'),
      });

      return tabs;
    }

    // -------------------------------------------------------------
    // CHẾ ĐỘ: QUÝ (Quét các quý từ các năm trước đến quý này + tương lai)
    // -------------------------------------------------------------
    if (filterMode === 'quarter') {
      const curQ = Math.floor(now.getMonth() / 3) + 1;
      let startYear = Math.min(curYear - historyYearsBack, earliestTxDate.getFullYear() - 5);

      const tabs: Array<{
        key: string;
        label: string;
        isActive: boolean;
        onSelect: () => void;
      }> = [];

      for (let y = startYear; y <= curYear; y++) {
        const maxQ = y === curYear ? curQ : 4;
        for (let q = 1; q <= maxQ; q++) {
          const qKey = `q_${y}_${q}`;
          let label = `QUÝ ${q}/${y}`;

          if (y === curYear && q === curQ) {
            label = 'QUÝ NÀY';
          } else {
            const isPrevQ =
              (curQ === 1 && y === curYear - 1 && q === 4) ||
              (curQ > 1 && y === curYear && q === curQ - 1);
            if (isPrevQ) {
              label = 'QUÝ TRƯỚC';
            }
          }

          const isCurrentActive =
            selectedQuarterKey === qKey ||
            (label === 'QUÝ NÀY' && selectedQuarterKey === 'q_curr') ||
            (label === 'QUÝ TRƯỚC' && selectedQuarterKey === 'q_prev');

          tabs.push({
            key: qKey,
            label,
            isActive: isCurrentActive,
            onSelect: () => setSelectedQuarterKey(qKey),
          });
        }
      }

      tabs.push({
        key: 'q_future',
        label: 'TƯƠNG LAI',
        isActive: selectedQuarterKey === 'q_future',
        onSelect: () => setSelectedQuarterKey('q_future'),
      });

      return tabs;
    }

    // -------------------------------------------------------------
    // CHẾ ĐỘ: NĂM (Quét các năm từ sớm nhất đến năm nay + tương lai + tất cả)
    // -------------------------------------------------------------
    if (filterMode === 'year') {
      let startYear = Math.min(curYear - historyYearsBack, earliestTxDate.getFullYear() - 5);
      const tabs: Array<{
        key: string;
        label: string;
        isActive: boolean;
        onSelect: () => void;
      }> = [];

      for (let y = startYear; y <= curYear; y++) {
        let label = `NĂM ${y}`;
        if (y === curYear) label = 'NĂM NAY';
        else if (y === curYear - 1) label = 'NĂM NGOÁI';

        const isCurrentActive =
          selectedYearKey === String(y) ||
          (y === curYear && selectedYearKey === 'year_curr') ||
          (y === curYear - 1 && selectedYearKey === 'year_prev');

        tabs.push({
          key: String(y),
          label,
          isActive: isCurrentActive,
          onSelect: () => setSelectedYearKey(String(y)),
        });
      }

      tabs.push({
        key: 'year_future',
        label: 'TƯƠNG LAI',
        isActive: selectedYearKey === 'year_future',
        onSelect: () => setSelectedYearKey('year_future'),
      });

      tabs.push({
        key: 'all_years',
        label: 'TẤT CẢ',
        isActive: selectedYearKey === 'all_years',
        onSelect: () => setSelectedYearKey('all_years'),
      });

      return tabs;
    }

    if (filterMode === 'all') {
      return [
        {
          key: 'all',
          label: 'TẤT CẢ THỜI GIAN',
          isActive: true,
          onSelect: () => {},
        },
      ];
    }

    if (filterMode === 'custom') {
      return [
        {
          key: 'custom',
          label: 'KHOẢNG NGÀY TÙY CHỈNH',
          isActive: true,
          onSelect: () => {},
        },
      ];
    }

    return [];
  }, [
    filterMode,
    selectedWeekKey,
    selectedMonthKey,
    selectedQuarterKey,
    selectedYearKey,
    selectedDayKey,
    earliestTxDate,
    historyYearsBack,
  ]);

  // 7. Hàm kiểm tra giao dịch có thuộc mốc thời gian động đã chọn không
  const isTxInSelectedTimeline = (tx: Transaction): boolean => {
    const txDateStr = toLocalDateKey(tx.date);
    const txDate = new Date(tx.date);
    const now = new Date();

    switch (filterMode) {
      case 'all':
        return true;

      case 'month': {
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;
        if (selectedMonthKey === 'month_future') {
          return (
            txDate.getFullYear() > curYear ||
            (txDate.getFullYear() === curYear && txDate.getMonth() + 1 > curMonth)
          );
        }
        const txMonthKey = toLocalMonthKey(tx.date);
        return txMonthKey === selectedMonthKey;
      }

      case 'day': {
        const todayStr = toLocalDateKey(now);
        if (selectedDayKey === 'day_future') {
          return txDateStr > todayStr;
        }
        if (selectedDayKey === 'picker') {
          return txDateStr === specificDate;
        }
        return txDateStr === selectedDayKey;
      }

      case 'week': {
        const startOfCurWeek = new Date(now);
        startOfCurWeek.setDate(now.getDate() - now.getDay());
        startOfCurWeek.setHours(0, 0, 0, 0);

        const endOfCurWeek = new Date(startOfCurWeek);
        endOfCurWeek.setDate(startOfCurWeek.getDate() + 6);
        endOfCurWeek.setHours(23, 59, 59, 999);

        if (selectedWeekKey === 'week_future') {
          return txDate > endOfCurWeek;
        }

        const weekOffset = parseInt(selectedWeekKey.replace('week_', ''), 10) || 0;
        const startOfWeek = new Date(startOfCurWeek);
        startOfWeek.setDate(startOfCurWeek.getDate() - weekOffset * 7);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return txDate >= startOfWeek && txDate <= endOfWeek;
      }

      case 'quarter': {
        const curQuarter = Math.floor(now.getMonth() / 3) + 1;
        const curYear = now.getFullYear();
        const txQuarter = Math.floor(txDate.getMonth() / 3) + 1;
        const txYear = txDate.getFullYear();

        if (selectedQuarterKey === 'q_future') {
          return txYear > curYear || (txYear === curYear && txQuarter > curQuarter);
        }
        if (selectedQuarterKey === 'q_curr') {
          return txYear === curYear && txQuarter === curQuarter;
        }
        if (selectedQuarterKey === 'q_prev') {
          const prevQ = curQuarter === 1 ? 4 : curQuarter - 1;
          const prevY = curQuarter === 1 ? curYear - 1 : curYear;
          return txYear === prevY && txQuarter === prevQ;
        }
        if (selectedQuarterKey.startsWith('q_')) {
          const parts = selectedQuarterKey.split('_');
          const targetY = parseInt(parts[1], 10);
          const targetQ = parseInt(parts[2], 10);
          return txYear === targetY && txQuarter === targetQ;
        }
        const targetQuarter = parseInt(selectedQuarterKey.replace('q', ''), 10);
        return txYear === curYear && txQuarter === targetQuarter;
      }

      case 'year': {
        if (selectedYearKey === 'all_years') return true;
        const curYear = now.getFullYear();
        if (selectedYearKey === 'year_future') {
          return txDate.getFullYear() > curYear;
        }
        if (selectedYearKey === 'year_curr') {
          return txDate.getFullYear() === curYear;
        }
        if (selectedYearKey === 'year_prev') {
          return txDate.getFullYear() === curYear - 1;
        }
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

      // Lọc theo Danh mục (CHỈ TẠI SỔ CÁI)
      if (selectedCategoryId && selectedCategoryId !== 'all') {
        if (tx.categoryId !== selectedCategoryId) {
          return false;
        }
      }

      // Thời gian
      return isTxInSelectedTimeline(tx);
    });
  }, [
    ledgerFilteredTransactions,
    searchQuery,
    typeFilter,
    selectedCategoryId,
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

  // Gom nhóm giao dịch theo từng ngày (Daily Grouping) theo Múi giờ địa phương
  const groupedDays = useMemo(() => {
    const groups = filteredList.reduce<Record<string, Transaction[]>>((acc, tx) => {
      const dKey = toLocalDateKey(tx.date);
      if (!acc[dKey]) {
        acc[dKey] = [];
      }
      acc[dKey].push(tx);
      return acc;
    }, {});

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const today = new Date();
    const todayStr = toLocalDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalDateKey(yesterday);

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
      const d = parseLocalDateKey(dKey);
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



  return (
    <div className="space-y-3 pb-24 animate-in fade-in duration-200">
      {/* 1. HÀNG ĐIỀU KHIỂN BỘ LỌC THỜI GIAN: NÚT DROPDOWN & ĐẾM GIAO DỊCH */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPeriodMenuOpen(!isPeriodMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#ebdcc9] hover:border-[#a25832] text-[#3e332a] font-bold shadow-2xs hover:bg-[#fff9f4] transition cursor-pointer active:scale-95"
            title="Bấm để chọn khoảng thời gian"
          >
            <Calendar className="w-3.5 h-3.5 text-[#a25832]" />
            <span className="text-xs">{periodModeLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#7a6a58] transition-transform duration-200 ${
                isPeriodMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Menu Dropdown các chế độ thời gian */}
          {isPeriodMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsPeriodMenuOpen(false)}
              />
              <div className="absolute left-0 mt-1.5 w-44 rounded-2xl bg-white border border-[#d8c8b4] shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1 text-[10px] font-bold text-[#a89886] uppercase tracking-wider">
                  Khoảng thời gian
                </div>
                {periodModes.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectPeriodMode(item.key)}
                    className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold hover:bg-[#fbf5eb] text-[#3e332a] transition cursor-pointer text-left"
                  >
                    <span className={filterMode === item.key ? 'text-[#a25832] font-bold' : ''}>
                      {item.label}
                    </span>
                    {filterMode === item.key && (
                      <Check className="w-3.5 h-3.5 text-[#a25832]" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedCategoryId && selectedCategoryId !== 'all' && (
            <span className="text-[11px] font-semibold text-[#a25832] bg-[#fbf5eb] px-2 py-0.5 rounded-lg border border-[#ebdcc9]">
              {getCategory(selectedCategoryId)?.name || 'Danh mục'}
            </span>
          )}
          <span className="font-medium text-[#8c7b69]">
            {windowSummary.count} giao dịch
          </span>
        </div>
      </div>

      {/* 2. THANH TRƯỢT THỜI GIAN NGANG (TRƯỚC / HIỆN TẠI / TƯƠNG LAI) - CHUẨN MONEY LOVER, TỰ ĐỘNG CĂN GIỮA, CUỘN VÔ TẬN */}
      {timelineSliderTabs.length > 0 && (
        <div className="overflow-hidden border-b border-[#ebdcc9]/60">
          <div
            ref={sliderContainerRef}
            onScroll={(e) => {
              if (e.currentTarget.scrollLeft < 150) {
                setHistoryYearsBack((prev) => prev + 10);
              }
            }}
            className="flex items-center gap-7 overflow-x-auto no-scrollbar scroll-smooth py-2.5"
            style={{ paddingLeft: 'calc(50% - 60px)', paddingRight: 'calc(50% - 60px)' }}
          >
            {timelineSliderTabs.map((tab) => (
              <button
                key={tab.key}
                ref={tab.isActive ? activeTabRef : null}
                type="button"
                onClick={tab.onSelect}
                className={`py-1 text-xs uppercase whitespace-nowrap transition cursor-pointer shrink-0 relative flex flex-col items-center select-none ${
                  tab.isActive
                    ? 'font-bold text-[#1c1917]'
                    : 'font-semibold text-[#8c7b69] hover:text-[#1c1917]'
                }`}
              >
                <span className="leading-tight tracking-wide">{tab.label}</span>
                {tab.isActive && (
                  <span className="absolute -bottom-2 left-0 right-0 h-[2.5px] bg-[#1c1917] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ô chọn khoảng ngày nhanh khi ở chế độ Tuỳ chỉnh */}
      {filterMode === 'custom' && (
        <div className="flex items-center gap-2 p-2.5 bg-white rounded-2xl border border-[#ebdcc9]/70 shadow-xs text-xs animate-in fade-in duration-150">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-[#7a6a58] block mb-0.5">
              Từ ngày:
            </label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-[#7a6a58] block mb-0.5">
              Đến ngày:
            </label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
            />
          </div>
        </div>
      )}

      {/* Ô chọn ngày cụ thể nhanh khi ở chế độ Ngày -> Chọn ngày... */}
      {filterMode === 'day' && selectedDayKey === 'picker' && (
        <div className="flex items-center gap-2 p-2.5 bg-white rounded-2xl border border-[#ebdcc9]/70 shadow-xs text-xs animate-in fade-in duration-150">
          <label className="text-xs font-semibold text-[#7a6a58]">
            Chọn ngày xem chi tiêu:
          </label>
          <input
            type="date"
            value={specificDate}
            onChange={(e) => setSpecificDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#fffdfa] border border-[#ebdcc9] text-xs font-bold text-[#a25832]"
          />
        </div>
      )}

      {/* 3. THANH TÓM TẮT TÀI CHÍNH TINH GỌN (TIỀN VÀO / TIỀN RA / CHÊNH LỆCH) */}
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
                        value={specificDate || toLocalDateKey(new Date())}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSpecificDate(val && val.trim() ? val : toLocalDateKey(new Date()));
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

      {/* 4. BOTTOM SHEET LỌC THEO DANH MỤC (SLIDE UP TỪ DƯỚI LÊN - CHỈ TẠI SỔ CÁI, KHÔNG DÙNG CUỘN NGANG) */}
      {isCategoryFilterSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsCategoryFilterSheetOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#fffdfa] rounded-t-3xl sm:rounded-3xl border border-[#ebdcc9] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bottom Sheet */}
            <div className="p-4 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#3e332a]">
                    Lọc Theo Danh Mục
                  </h3>
                  <p className="text-[11px] text-[#7a6a58]">
                    Chọn danh mục để xem các giao dịch tương ứng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryFilterSheetOpen(false)}
                className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f0e4d5] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thân Bottom Sheet: Danh sách danh mục dạng lưới dọc sạch sẽ (TUYỆT ĐỐI KHÔNG DÀN TRẢI CUỘN NGANG) */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 max-h-[60vh]">
              {/* Tùy chọn [Tất cả danh mục] */}
              <button
                onClick={() => {
                  setSelectedCategoryId('all');
                  setIsCategoryFilterSheetOpen(false);
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition cursor-pointer text-left ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#a25832] text-white border-[#a25832] shadow-xs'
                    : 'bg-white text-[#3e332a] border-[#ebdcc9] hover:bg-[#faf7f2]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                      selectedCategoryId === 'all'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#f5ebe0] text-[#a25832]'
                    }`}
                  >
                    ★
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm">Tất cả danh mục</div>
                    <div
                      className={`text-[11px] ${
                        selectedCategoryId === 'all' ? 'text-white/80' : 'text-[#7a6a58]'
                      }`}
                    >
                      Hiển thị toàn bộ ({categories.length} danh mục)
                    </div>
                  </div>
                </div>
                {selectedCategoryId === 'all' && (
                  <span className="text-xs font-bold bg-white text-[#a25832] px-2 py-0.5 rounded-full">
                    Đang chọn
                  </span>
                )}
              </button>

              <div className="my-2 border-t border-[#f0e4d5]" />

              {/* Danh sách các danh mục cụ thể */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  // Đếm số giao dịch thuộc danh mục này trong khoảng thời gian hiện tại
                  const txCount = ledgerFilteredTransactions.filter(
                    (tx) => tx.categoryId === cat.id && isTxInSelectedTimeline(tx)
                  ).length;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setIsCategoryFilterSheetOpen(false);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#a25832] text-white border-[#a25832] shadow-xs'
                          : 'bg-white text-[#3e332a] border-[#ebdcc9] hover:bg-[#faf7f2]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: cat.color }}
                        >
                          <DynamicIcon name={cat.icon} className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-xs truncate">{cat.name}</div>
                          <div
                            className={`text-[10px] truncate ${
                              isSelected ? 'text-white/80' : 'text-[#7a6a58]'
                            }`}
                          >
                            {cat.type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2 text-right">
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded-md font-semibold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-[#f5ebe0] text-[#7a6a58]'
                          }`}
                        >
                          {txCount} món
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer Bottom Sheet */}
            <div className="p-3.5 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between gap-2.5">
              <button
                onClick={() => {
                  setSelectedCategoryId('all');
                  setIsCategoryFilterSheetOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl border border-[#ebdcc9] text-xs font-bold text-[#7a6a58] hover:bg-[#ebdcc9] transition cursor-pointer"
              >
                Xem tất cả
              </button>
              <button
                onClick={() => setIsCategoryFilterSheetOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#a25832] hover:bg-[#8c4623] text-white transition shadow-xs cursor-pointer active:scale-95 text-center"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
