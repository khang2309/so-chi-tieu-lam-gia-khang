import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Sparkles,
  Award,
  X,
  Users,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Transaction, Category, Wallet, Ledger } from '../types';
import {
  formatCurrency,
  formatDateTimeDisplay,
  toLocalDateKey,
  toLocalMonthKey,
  parseLocalDateKey,
} from '../utils/formatters';
import { DynamicIcon } from './DynamicIcon';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  count: number;
  percentage: number;
}

interface ReportScreenProps {
  transactions: Transaction[];
  categories: Category[];
  wallets?: Wallet[];
  ledgers?: Ledger[];
  activeLedgerId?: string;
  activeLedgerName?: string;
}

type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

// Helper hàm xử lý Date an toàn tuyệt đối, chống Null Pointer Exception & Invalid Date
const getSafeDate = (val?: string | null | Date): Date => {
  if (!val) return new Date();
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    const [y, m, d] = val.trim().split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

// Tính khoảng ngày Thứ 2 đến Chủ nhật của 1 tuần bằng Date object
const getWeekRange = (baseDate: Date, offsetWeeks: number = 0) => {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0: CN, 1: T2...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday - offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(d);
  const endOfWeek = new Date(d);
  endOfWeek.setDate(d.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
};

export const ReportScreen: React.FC<ReportScreenProps> = ({
  transactions,
  categories,
  wallets = [],
  ledgers = [],
  activeLedgerId = 'all',
  activeLedgerName = 'Tất cả các sổ',
}) => {
  const currentDate = new Date();

  // 1. Filter States với fallback an toàn
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState<boolean>(false);
  const [historyYearsBack, setHistoryYearsBack] = useState<number>(15);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    return toLocalMonthKey(currentDate);
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => {
    return toLocalDateKey(currentDate);
  });
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('week_0');
  const [selectedQuarterKey, setSelectedQuarterKey] = useState<string>('q_curr');
  const [selectedYearKey, setSelectedYearKey] = useState<string>('year_curr');
  const [specificDate, setSpecificDate] = useState<string>(() => {
    return toLocalDateKey(currentDate);
  });

  const [compareWithPrevious, setCompareWithPrevious] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');

  // Trạng thái xem chi tiết giao dịch của 1 danh mục (Bottom Sheet / Popup TẠI BÁO CÁO)
  const [selectedDetailCategory, setSelectedDetailCategory] = useState<CategoryBreakdownItem | null>(null);

  const getWallet = (wId: string) => wallets.find((w) => w.id === wId);
  const getLedger = (lId: string) => ledgers.find((l) => l.id === lId);

  // Danh sách các tùy chọn khoảng thời gian (Đồng bộ chuẩn Money Lover)
  const periodModes: Array<{ key: PeriodType; label: string }> = [
    { key: 'day', label: 'Ngày' },
    { key: 'week', label: 'Tuần' },
    { key: 'month', label: 'Tháng' },
    { key: 'quarter', label: 'Quý' },
    { key: 'year', label: 'Năm' },
    { key: 'all', label: 'Tất cả' },
  ];

  const periodModeLabel = useMemo(() => {
    switch (periodType) {
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
      default:
        return 'Thời gian';
    }
  }, [periodType]);

  const handleSelectPeriodMode = (mode: PeriodType) => {
    setPeriodType(mode);
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
    }
  };

  // Tìm ngày giao dịch sớm nhất để hỗ trợ cuộn quá khứ vô tận
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
    centerActiveTab('auto');
    const timer = setTimeout(() => {
      centerActiveTab('smooth');
    }, 60);
    return () => clearTimeout(timer);
  }, [
    periodType,
    selectedMonthKey,
    selectedWeekKey,
    selectedQuarterKey,
    selectedYearKey,
    selectedDayKey,
    centerActiveTab,
  ]);

  // Tự động sinh danh sách Tabs trượt động (Trước / Hiện tại / Tương lai) - Động 100%, Không hardcode
  const timelineSliderTabs = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    // THÁNG
    if (periodType === 'month') {
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

    // TUẦN
    if (periodType === 'week') {
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

    // NGÀY
    if (periodType === 'day') {
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

    // QUÝ
    if (periodType === 'quarter') {
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

    // NĂM
    if (periodType === 'year') {
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

    if (periodType === 'all') {
      return [
        {
          key: 'all',
          label: 'TẤT CẢ THỜI GIAN',
          isActive: true,
          onSelect: () => {},
        },
      ];
    }

    return [];
  }, [
    periodType,
    selectedWeekKey,
    selectedMonthKey,
    selectedQuarterKey,
    selectedYearKey,
    selectedDayKey,
    earliestTxDate,
    historyYearsBack,
  ]);

  // 2. Base transactions filtered by active Ledger
  const ledgerTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => !tx.isDeleted && (activeLedgerId === 'all' || tx.ledgerId === activeLedgerId)
    );
  }, [transactions, activeLedgerId]);

  // 3. Current Period Transactions
  const currentPeriodTransactions = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const curQ = Math.floor(now.getMonth() / 3) + 1;

    return ledgerTransactions.filter((tx) => {
      if (!tx.date) return false;
      const txDate = getSafeDate(tx.date);
      const txDateStr = toLocalDateKey(tx.date);

      if (periodType === 'all') {
        // Lấy tất cả
      } else if (periodType === 'month') {
        if (selectedMonthKey === 'month_future') {
          const isFuture =
            txDate.getFullYear() > curYear ||
            (txDate.getFullYear() === curYear && txDate.getMonth() + 1 > curMonth);
          if (!isFuture) return false;
        } else {
          const txMonthKey = toLocalMonthKey(tx.date);
          if (txMonthKey !== selectedMonthKey) return false;
        }
      } else if (periodType === 'week') {
        if (selectedWeekKey === 'week_future') {
          const { endOfWeek } = getWeekRange(now, 0);
          if (txDate <= endOfWeek) return false;
        } else {
          const offset = parseInt(selectedWeekKey.replace('week_', ''), 10) || 0;
          const { startOfWeek, endOfWeek } = getWeekRange(now, offset);
          if (txDate < startOfWeek || txDate > endOfWeek) return false;
        }
      } else if (periodType === 'day') {
        if (selectedDayKey === 'day_future') {
          const todayStr = toLocalDateKey(now);
          if (txDateStr <= todayStr) return false;
        } else if (selectedDayKey === 'picker') {
          if (txDateStr !== specificDate) return false;
        } else {
          if (txDateStr !== selectedDayKey) return false;
        }
      } else if (periodType === 'quarter') {
        if (selectedQuarterKey === 'q_future') {
          const isFuture =
            txDate.getFullYear() > curYear ||
            (txDate.getFullYear() === curYear && Math.floor(txDate.getMonth() / 3) + 1 > curQ);
          if (!isFuture) return false;
        } else {
          let targetYear = curYear;
          let targetQ = curQ;
          if (selectedQuarterKey === 'q_curr') {
            targetYear = curYear;
            targetQ = curQ;
          } else if (selectedQuarterKey === 'q_prev') {
            targetYear = curQ === 1 ? curYear - 1 : curYear;
            targetQ = curQ === 1 ? 4 : curQ - 1;
          } else if (selectedQuarterKey.startsWith('q_')) {
            const parts = selectedQuarterKey.split('_');
            targetYear = parseInt(parts[1], 10);
            targetQ = parseInt(parts[2], 10);
          }
          const txQ = Math.floor(txDate.getMonth() / 3) + 1;
          if (txDate.getFullYear() !== targetYear || txQ !== targetQ) return false;
        }
      } else if (periodType === 'year') {
        if (selectedYearKey === 'all_years') {
          // Lấy tất cả
        } else if (selectedYearKey === 'year_future') {
          if (txDate.getFullYear() <= curYear) return false;
        } else {
          let targetYear = curYear;
          if (selectedYearKey === 'year_curr') targetYear = curYear;
          else if (selectedYearKey === 'year_prev') targetYear = curYear - 1;
          else targetYear = parseInt(selectedYearKey, 10);

          if (txDate.getFullYear() !== targetYear) return false;
        }
      }

      // Filter by type if selected
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [
    ledgerTransactions,
    periodType,
    selectedMonthKey,
    selectedWeekKey,
    selectedDayKey,
    specificDate,
    selectedQuarterKey,
    selectedYearKey,
    selectedType,
  ]);

  // 4. Previous Period Transactions (for Comparison)
  const previousPeriodTransactions = useMemo(() => {
    if (!compareWithPrevious || periodType === 'all') return [];

    const now = new Date();
    const curYear = now.getFullYear();
    const curQ = Math.floor(now.getMonth() / 3) + 1;

    if (
      selectedMonthKey === 'month_future' ||
      selectedWeekKey === 'week_future' ||
      selectedDayKey === 'day_future' ||
      selectedQuarterKey === 'q_future' ||
      selectedYearKey === 'year_future' ||
      selectedYearKey === 'all_years'
    ) {
      return [];
    }

    return ledgerTransactions.filter((tx) => {
      if (!tx.date) return false;
      const txDate = getSafeDate(tx.date);
      const txDateStr = toLocalDateKey(tx.date);

      if (periodType === 'month') {
        const [selY, selM] = selectedMonthKey.split('-').map(Number);
        const prevYear = selM === 1 ? selY - 1 : selY;
        const prevMonth = selM === 1 ? 12 : selM - 1;
        if (
          txDate.getFullYear() !== prevYear ||
          txDate.getMonth() + 1 !== prevMonth
        ) {
          return false;
        }
      } else if (periodType === 'week') {
        const offset = parseInt(selectedWeekKey.replace('week_', ''), 10) || 0;
        const { startOfWeek, endOfWeek } = getWeekRange(now, offset + 1);
        if (txDate < startOfWeek || txDate > endOfWeek) return false;
      } else if (periodType === 'day') {
        const baseDate =
          selectedDayKey === 'picker'
            ? parseLocalDateKey(specificDate)
            : parseLocalDateKey(selectedDayKey);
        const prevD = new Date(baseDate);
        prevD.setDate(prevD.getDate() - 1);
        if (txDateStr !== toLocalDateKey(prevD)) return false;
      } else if (periodType === 'quarter') {
        let targetYear = curYear;
        let targetQ = curQ;
        if (selectedQuarterKey === 'q_curr') {
          targetYear = curYear;
          targetQ = curQ;
        } else if (selectedQuarterKey === 'q_prev') {
          targetYear = curQ === 1 ? curYear - 1 : curYear;
          targetQ = curQ === 1 ? 4 : curQ - 1;
        } else if (selectedQuarterKey.startsWith('q_')) {
          const parts = selectedQuarterKey.split('_');
          targetYear = parseInt(parts[1], 10);
          targetQ = parseInt(parts[2], 10);
        }
        const prevYear = targetQ === 1 ? targetYear - 1 : targetYear;
        const prevQ = targetQ === 1 ? 4 : targetQ - 1;
        const txQ = Math.floor(txDate.getMonth() / 3) + 1;
        if (txDate.getFullYear() !== prevYear || txQ !== prevQ) return false;
      } else if (periodType === 'year') {
        let targetYear = curYear;
        if (selectedYearKey === 'year_curr') targetYear = curYear;
        else if (selectedYearKey === 'year_prev') targetYear = curYear - 1;
        else targetYear = parseInt(selectedYearKey, 10);

        if (txDate.getFullYear() !== targetYear - 1) return false;
      }

      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [
    ledgerTransactions,
    compareWithPrevious,
    periodType,
    selectedMonthKey,
    selectedWeekKey,
    selectedDayKey,
    specificDate,
    selectedQuarterKey,
    selectedYearKey,
  ]);

  // Danh sách giao dịch chi tiết cho danh mục đang xem popup (TẠI BÁO CÁO)
  const categoryDetailTransactions = useMemo(() => {
    if (!selectedDetailCategory) return [];
    const isIncomeView = selectedType === 'income';
    const targetType = isIncomeView ? 'income' : 'expense';

    return currentPeriodTransactions
      .filter(
        (tx) =>
          tx.categoryId === selectedDetailCategory.categoryId &&
          tx.type === targetType
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedDetailCategory, currentPeriodTransactions, selectedType]);

  // 5. Current Summary Numbers
  const currentSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    currentPeriodTransactions.forEach((tx) => {
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    });
    const net = income - expense;
    const savingsRate = income > 0 ? Math.max(0, (net / income) * 100) : 0;
    return {
      income,
      expense,
      net,
      savingsRate,
      count: currentPeriodTransactions.length,
    };
  }, [currentPeriodTransactions]);

  // Previous Summary Numbers
  const prevSummary = useMemo(() => {
    if (!compareWithPrevious) return null;
    let income = 0;
    let expense = 0;
    previousPeriodTransactions.forEach((tx) => {
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    });
    const net = income - expense;
    return { income, expense, net };
  }, [previousPeriodTransactions, compareWithPrevious]);

  // Calculate Deltas (% change)
  const deltas = useMemo(() => {
    if (!prevSummary) return null;

    const calcDelta = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    return {
      expenseDelta: calcDelta(currentSummary.expense, prevSummary.expense),
      incomeDelta: calcDelta(currentSummary.income, prevSummary.income),
      netDelta: calcDelta(currentSummary.net, prevSummary.net),
    };
  }, [currentSummary, prevSummary]);

  // 6. Category Breakdown for Expenses (and Income if viewing income only)
  const categoryBreakdown = useMemo(() => {
    const isIncomeView = selectedType === 'income';
    const targetType = isIncomeView ? 'income' : 'expense';

    const map: Record<string, { amount: number; count: number }> = {};
    let total = 0;

    currentPeriodTransactions.forEach((tx) => {
      if (tx.type === targetType) {
        total += tx.amount;
        if (!map[tx.categoryId]) {
          map[tx.categoryId] = { amount: 0, count: 0 };
        }
        map[tx.categoryId].amount += tx.amount;
        map[tx.categoryId].count += 1;
      }
    });

    return Object.entries(map)
      .map(([catId, data]) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          categoryId: catId,
          name: cat?.name || 'Khác',
          color: cat?.color || '#a25832',
          icon: cat?.icon || 'Tag',
          amount: data.amount,
          count: data.count,
          percentage: total > 0 ? (data.amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [currentPeriodTransactions, categories, selectedType]);

  // Total for donut chart
  const donutTotal = useMemo(() => {
    return categoryBreakdown.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryBreakdown]);

  // 7. Donut Chart Data
  const donutChartData = useMemo(() => {
    if (categoryBreakdown.length === 0) {
      return {
        labels: ['Chưa có dữ liệu'],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#ebdcc9'],
            borderColor: ['#fffdfa'],
            borderWidth: 2,
          },
        ],
      };
    }

    return {
      labels: categoryBreakdown.map((c) => c.name),
      datasets: [
        {
          data: categoryBreakdown.map((c) => c.amount),
          backgroundColor: categoryBreakdown.map((c) => c.color),
          borderColor: '#fffdfa',
          borderWidth: 2.5,
          hoverOffset: 6,
        },
      ],
    };
  }, [categoryBreakdown]);

  const donutChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // We render a custom rich legend below
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const val = context.raw || 0;
              const pct = donutTotal > 0 ? ((val / donutTotal) * 100).toFixed(1) : '0';
              return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
            },
          },
          backgroundColor: '#3e332a',
          titleFont: { size: 12, weight: 'bold' as const },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
        },
      },
      cutout: '68%',
    };
  }, [donutTotal]);

  // 8. Bar Chart Data (Tương quan Thu / Chi theo trục thời gian cho cả 5 mốc)
  const barChartData = useMemo(() => {
    if (periodType === 'day') {
      const parts = [
        { label: 'Sáng (0h-11h)', income: 0, expense: 0 },
        { label: 'Chiều (12h-17h)', income: 0, expense: 0 },
        { label: 'Tối (18h-23h)', income: 0, expense: 0 },
      ];

      currentPeriodTransactions.forEach((tx) => {
        const d = getSafeDate(tx.date);
        const h = d?.getHours?.() ?? 12;
        let pIndex = 0;
        if (h >= 12 && h < 18) pIndex = 1;
        else if (h >= 18) pIndex = 2;

        if (tx.type === 'income') parts[pIndex].income += tx.amount;
        if (tx.type === 'expense') parts[pIndex].expense += tx.amount;
      });

      return {
        labels: parts.map((p) => p.label),
        datasets: [
          {
            label: 'Thu nhập (+)',
            data: parts.map((p) => p.income),
            backgroundColor: '#10b981',
            borderRadius: 8,
            maxBarThickness: 32,
          },
          {
            label: 'Chi tiêu (-)',
            data: parts.map((p) => p.expense),
            backgroundColor: '#ea580c',
            borderRadius: 8,
            maxBarThickness: 32,
          },
        ],
      };
    } else if (periodType === 'week') {
      // 7 ngày trong tuần
      const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map((label) => ({
        label,
        income: 0,
        expense: 0,
      }));

      currentPeriodTransactions.forEach((tx) => {
        const d = getSafeDate(tx.date);
        const dayIdx = d?.getDay?.() ?? 0; // 0 is Sun, 1 is Mon...
        const arrayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
        if (tx.type === 'income') days[arrayIdx].income += tx.amount;
        if (tx.type === 'expense') days[arrayIdx].expense += tx.amount;
      });

      return {
        labels: days.map((d) => d.label),
        datasets: [
          {
            label: 'Thu nhập (+)',
            data: days.map((d) => d.income),
            backgroundColor: '#10b981',
            borderRadius: 6,
            maxBarThickness: 24,
          },
          {
            label: 'Chi tiêu (-)',
            data: days.map((d) => d.expense),
            backgroundColor: '#ea580c',
            borderRadius: 6,
            maxBarThickness: 24,
          },
        ],
      };
    } else if (periodType === 'month') {
      // Nhóm theo 5 tuần trong tháng
      const weeks = [
        { label: 'T.1 (1-7)', income: 0, expense: 0 },
        { label: 'T.2 (8-14)', income: 0, expense: 0 },
        { label: 'T.3 (15-21)', income: 0, expense: 0 },
        { label: 'T.4 (22-28)', income: 0, expense: 0 },
        { label: 'T.5 (29+)', income: 0, expense: 0 },
      ];

      currentPeriodTransactions.forEach((tx) => {
        const d = getSafeDate(tx.date);
        const day = d?.getDate?.() ?? 1;
        let weekIndex = 0;
        if (day <= 7) weekIndex = 0;
        else if (day <= 14) weekIndex = 1;
        else if (day <= 21) weekIndex = 2;
        else if (day <= 28) weekIndex = 3;
        else weekIndex = 4;

        if (tx.type === 'income') weeks[weekIndex].income += tx.amount;
        if (tx.type === 'expense') weeks[weekIndex].expense += tx.amount;
      });

      return {
        labels: weeks.map((w) => w.label),
        datasets: [
          {
            label: 'Thu nhập (+)',
            data: weeks.map((w) => w.income),
            backgroundColor: '#10b981',
            borderRadius: 6,
            maxBarThickness: 24,
          },
          {
            label: 'Chi tiêu (-)',
            data: weeks.map((w) => w.expense),
            backgroundColor: '#ea580c',
            borderRadius: 6,
            maxBarThickness: 24,
          },
        ],
      };
    } else if (periodType === 'quarter') {
      // 3 tháng của quý được tính động
      let qNum = Math.floor(new Date().getMonth() / 3) + 1;
      if (selectedQuarterKey === 'q_prev') {
        qNum = qNum === 1 ? 4 : qNum - 1;
      } else if (selectedQuarterKey.startsWith('q_')) {
        const parts = selectedQuarterKey.split('_');
        qNum = parseInt(parts[2], 10) || qNum;
      }
      const startM = (qNum - 1) * 3;
      const quarterMonths = [0, 1, 2].map((offset) => {
        const m = startM + offset + 1;
        return {
          month: m,
          label: `Tháng ${m}`,
          income: 0,
          expense: 0,
        };
      });

      currentPeriodTransactions.forEach((tx) => {
        const d = getSafeDate(tx.date);
        const m = (d?.getMonth?.() ?? 0) + 1;
        const target = quarterMonths.find((item) => item.month === m);
        if (target) {
          if (tx.type === 'income') target.income += tx.amount;
          if (tx.type === 'expense') target.expense += tx.amount;
        }
      });

      return {
        labels: quarterMonths.map((m) => m.label),
        datasets: [
          {
            label: 'Thu nhập (+)',
            data: quarterMonths.map((m) => m.income),
            backgroundColor: '#10b981',
            borderRadius: 6,
            maxBarThickness: 28,
          },
          {
            label: 'Chi tiêu (-)',
            data: quarterMonths.map((m) => m.expense),
            backgroundColor: '#ea580c',
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      };
    } else {
      // 12 tháng trong năm
      const months = Array.from({ length: 12 }, (_, i) => ({
        label: `T${i + 1}`,
        income: 0,
        expense: 0,
      }));

      currentPeriodTransactions.forEach((tx) => {
        const d = getSafeDate(tx.date);
        const m = d?.getMonth?.() ?? 0;
        if (m >= 0 && m < 12) {
          if (tx.type === 'income') months[m].income += tx.amount;
          if (tx.type === 'expense') months[m].expense += tx.amount;
        }
      });

      return {
        labels: months.map((m) => m.label),
        datasets: [
          {
            label: 'Thu nhập (+)',
            data: months.map((m) => m.income),
            backgroundColor: '#10b981',
            borderRadius: 4,
            maxBarThickness: 16,
          },
          {
            label: 'Chi tiêu (-)',
            data: months.map((m) => m.expense),
            backgroundColor: '#ea580c',
            borderRadius: 4,
            maxBarThickness: 16,
          },
        ],
      };
    }
  }, [currentPeriodTransactions, periodType, selectedQuarterKey]);

  const barChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            boxWidth: 12,
            font: { size: 11, weight: 'bold' as const },
            color: '#3e332a',
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              return ` ${context.dataset.label}: ${formatCurrency(context.raw || 0)}`;
            },
          },
          backgroundColor: '#3e332a',
          titleFont: { size: 12, weight: 'bold' as const },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#7a6a58', font: { size: 10 } },
        },
        y: {
          grid: { color: '#f0e4d5' },
          ticks: {
            color: '#7a6a58',
            font: { size: 10 },
            callback: (value: any) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
              return value;
            },
          },
        },
      },
    };
  }, []);

  // 9. Top 5 khoản chi tiêu lớn nhất
  const topExpenses = useMemo(() => {
    return [...currentPeriodTransactions]
      .filter((tx) => tx.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [currentPeriodTransactions]);

  // Title display hỗ trợ đủ các mốc
  const periodTitle = useMemo(() => {
    if (periodType === 'all') return 'Tất cả thời gian';

    if (periodType === 'day') {
      if (selectedDayKey === 'day_future') return 'Giao dịch tương lai';
      const d =
        selectedDayKey === 'picker'
          ? parseLocalDateKey(specificDate)
          : parseLocalDateKey(selectedDayKey);
      return `Ngày ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }
    if (periodType === 'week') {
      if (selectedWeekKey === 'week_future') return 'Giao dịch tương lai';
      const offset = parseInt(selectedWeekKey.replace('week_', ''), 10) || 0;
      const { startOfWeek, endOfWeek } = getWeekRange(new Date(), offset);
      const prefix =
        offset === 0
          ? 'Tuần này'
          : offset === 1
          ? 'Tuần trước'
          : `${offset} tuần trước`;
      return `${prefix} (${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1} - ${endOfWeek.getDate()}/${endOfWeek.getMonth() + 1}/${endOfWeek.getFullYear()})`;
    }
    if (periodType === 'month') {
      if (selectedMonthKey === 'month_future') return 'Giao dịch tương lai';
      const [y, m] = selectedMonthKey.split('-').map(Number);
      return `Tháng ${m}/${y}`;
    }
    if (periodType === 'quarter') {
      if (selectedQuarterKey === 'q_future') return 'Giao dịch tương lai';
      const now = new Date();
      let targetYear = now.getFullYear();
      let targetQ = Math.floor(now.getMonth() / 3) + 1;
      if (selectedQuarterKey === 'q_prev') {
        targetYear = targetQ === 1 ? targetYear - 1 : targetYear;
        targetQ = targetQ === 1 ? 4 : targetQ - 1;
      } else if (selectedQuarterKey.startsWith('q_')) {
        const parts = selectedQuarterKey.split('_');
        targetYear = parseInt(parts[1], 10);
        targetQ = parseInt(parts[2], 10);
      }
      const startM = (targetQ - 1) * 3 + 1;
      const endM = targetQ * 3;
      return `Quý ${targetQ}/${targetYear} (Tháng ${startM} - ${endM})`;
    }
    if (periodType === 'year') {
      if (selectedYearKey === 'all_years') return 'Tất cả các năm';
      if (selectedYearKey === 'year_future') return 'Giao dịch tương lai';
      if (selectedYearKey === 'year_curr') return `Năm ${new Date().getFullYear()}`;
      if (selectedYearKey === 'year_prev') return `Năm ${new Date().getFullYear() - 1}`;
      return `Năm ${selectedYearKey}`;
    }
    return 'Báo cáo';
  }, [
    periodType,
    selectedDayKey,
    specificDate,
    selectedWeekKey,
    selectedMonthKey,
    selectedQuarterKey,
    selectedYearKey,
  ]);

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* 1. HEADER & CHỌN MỐC THỜI GIAN */}
      <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper p-4 space-y-3.5">
        {/* Tiêu đề & Chọn Khoảng Thời Gian (1 nút Dropdown duy nhất) */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#f0e4d5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#a25832]/10 text-[#a25832] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#3e332a]">
                Báo Cáo & Thống Kê
              </h2>
              <p className="text-xs text-[#7a6a58] flex items-center gap-1.5 font-medium">
                <span className="text-[#a25832] font-bold">{periodTitle}</span>
                <span>•</span>
                <span>
                  {activeLedgerId === 'all'
                    ? 'Tổng hợp tất cả sổ'
                    : `Sổ: ${activeLedgerName}`}
                </span>
              </p>
            </div>
          </div>

          {/* Nút Dropdown thời gian duy nhất (Gọn gàng, không trùng lặp) */}
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

            {isPeriodMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsPeriodMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-44 rounded-2xl bg-white border border-[#d8c8b4] shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
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
                      <span
                        className={
                          periodType === item.key ? 'text-[#a25832] font-bold' : ''
                        }
                      >
                        {item.label}
                      </span>
                      {periodType === item.key && (
                        <Check className="w-3.5 h-3.5 text-[#a25832]" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
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
              style={{
                paddingLeft: 'calc(50% - 60px)',
                paddingRight: 'calc(50% - 60px)',
              }}
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

        {/* Ô chọn ngày khi ở tab Chọn ngày... */}
        {periodType === 'day' && selectedDayKey === 'picker' && (
          <div className="flex items-center gap-2 pt-1 px-1">
            <span className="text-xs text-[#7a6a58] font-semibold">Chọn ngày:</span>
            <input
              type="date"
              value={specificDate || toLocalDateKey(new Date())}
              onChange={(e) => {
                if (e.target.value) {
                  setSpecificDate(e.target.value);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
            />
          </div>
        )}

        {/* Tùy chọn nâng cao: So sánh kỳ trước & Lọc Thu/Chi & Lọc Danh mục */}
        <div className="pt-2 border-t border-[#f0e4d5] flex flex-wrap items-center justify-between gap-2.5">
          {/* Toggle So sánh */}
          <label className="flex items-center gap-2 text-xs font-semibold text-[#3e332a] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={compareWithPrevious}
              onChange={(e) => setCompareWithPrevious(e.target.checked)}
              className="w-4 h-4 rounded text-[#a25832] focus:ring-[#a25832] border-[#ebdcc9]"
            />
            <span>
              So sánh với{' '}
              {periodType === 'year'
                ? 'năm trước'
                : periodType === 'quarter'
                ? 'quý trước'
                : periodType === 'month'
                ? 'tháng trước'
                : periodType === 'week'
                ? 'tuần trước'
                : 'hôm qua'}
            </span>
          </label>

          {/* Lọc Thu / Chi */}
          <div className="flex items-center bg-[#f5ebe0] p-0.5 rounded-lg border border-[#ebdcc9] text-xs font-semibold">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-white text-[#3e332a] shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setSelectedType('expense')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                selectedType === 'expense'
                  ? 'bg-[#ea580c] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Chi tiêu
            </button>
            <button
              onClick={() => setSelectedType('income')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                selectedType === 'income'
                  ? 'bg-[#10b981] text-white shadow-xs'
                  : 'text-[#7a6a58] hover:text-[#3e332a]'
              }`}
            >
              Thu nhập
            </button>
          </div>
        </div>
      </section>

      {/* 2. CHỈ SỐ TÀI CHÍNH TỔNG QUAN (KPI CARDS) */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Tổng Chi */}
        <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ebdcc9] shadow-paper space-y-1">
          <div className="text-[11px] font-bold text-[#7a6a58] uppercase tracking-wider flex items-center justify-between">
            <span>Tổng Chi Tiêu</span>
            <TrendingDown className="w-4 h-4 text-[#ea580c]" />
          </div>
          <div className="text-base sm:text-lg font-bold text-[#ea580c] truncate">
            {formatCurrency(currentSummary.expense)}
          </div>
          {deltas && (
            <div className="text-[10px] flex items-center gap-1 font-semibold">
              <span
                className={
                  deltas.expenseDelta > 0
                    ? 'text-[#ea580c]'
                    : 'text-[#10b981]'
                }
              >
                {deltas.expenseDelta > 0 ? '+' : ''}
                {deltas.expenseDelta.toFixed(1)}%
              </span>
              <span className="text-[#a89886]">so với kỳ trước</span>
            </div>
          )}
        </div>

        {/* Tổng Thu */}
        <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ebdcc9] shadow-paper space-y-1">
          <div className="text-[11px] font-bold text-[#7a6a58] uppercase tracking-wider flex items-center justify-between">
            <span>Tổng Thu Nhập</span>
            <TrendingUp className="w-4 h-4 text-[#10b981]" />
          </div>
          <div className="text-base sm:text-lg font-bold text-[#10b981] truncate">
            {formatCurrency(currentSummary.income)}
          </div>
          {deltas && (
            <div className="text-[10px] flex items-center gap-1 font-semibold">
              <span
                className={
                  deltas.incomeDelta >= 0
                    ? 'text-[#10b981]'
                    : 'text-[#ea580c]'
                }
              >
                {deltas.incomeDelta > 0 ? '+' : ''}
                {deltas.incomeDelta.toFixed(1)}%
              </span>
              <span className="text-[#a89886]">so với kỳ trước</span>
            </div>
          )}
        </div>

        {/* Ròng / Thặng dư */}
        <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ebdcc9] shadow-paper space-y-1">
          <div className="text-[11px] font-bold text-[#7a6a58] uppercase tracking-wider flex items-center justify-between">
            <span>Ròng (Thu - Chi)</span>
            <ArrowUpDown className="w-4 h-4 text-[#3e332a]" />
          </div>
          <div
            className={`text-base sm:text-lg font-bold truncate ${
              currentSummary.net >= 0 ? 'text-[#3e332a]' : 'text-[#ea580c]'
            }`}
          >
            {currentSummary.net >= 0 ? '+' : ''}
            {formatCurrency(currentSummary.net)}
          </div>
          <div className="text-[10px] text-[#7a6a58] font-medium">
            {currentSummary.net >= 0 ? 'Dư dả tài chính' : 'Thâm hụt tài chính'}
          </div>
        </div>

        {/* Tỷ lệ tiết kiệm */}
        <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ebdcc9] shadow-paper space-y-1">
          <div className="text-[11px] font-bold text-[#7a6a58] uppercase tracking-wider flex items-center justify-between">
            <span>Tỷ Lệ Tiết Kiệm</span>
            <Award className="w-4 h-4 text-[#c28b38]" />
          </div>
          <div className="text-base sm:text-lg font-bold text-[#3e332a] truncate">
            {currentSummary.savingsRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-[#7a6a58] font-medium">
            {currentSummary.count} giao dịch ghi nhận
          </div>
        </div>
      </section>

      {/* 3. BIỂU ĐỒ CỘT (BAR CHART): SO SÁNH TƯƠNG QUAN THU / CHI THEO TRỤC THỜI GIAN */}
      <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#f0e4d5]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#a25832]" />
            <h3 className="text-sm font-bold text-[#3e332a]">
              Tương Quan Thu & Chi Theo Trục Thời Gian
            </h3>
          </div>
          <span className="text-[11px] text-[#7a6a58] italic">
            {periodType === 'month'
              ? 'Theo 5 tuần trong tháng'
              : periodType === 'year'
              ? 'Theo 12 tháng trong năm'
              : 'Theo các buổi trong ngày'}
          </span>
        </div>

        {/* Chart Container */}
        <div className="h-64 sm:h-72 w-full pt-1">
          <Bar data={barChartData} options={barChartOptions} />
        </div>
      </section>

      {/* 4. BIỂU ĐỒ TRÒN / DONUT (DOUGHNUT CHART): PHÂN BỔ THEO DANH MỤC */}
      <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper p-4 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#f0e4d5]">
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-[#a25832]" />
            <h3 className="text-sm font-bold text-[#3e332a]">
              Phân Bổ {selectedType === 'income' ? 'Thu Nhập' : 'Chi Tiêu'} Theo Danh Mục
            </h3>
          </div>
          <span className="text-xs font-bold text-[#a25832]">
            {formatCurrency(donutTotal)}
          </span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#7a6a58]">
            Chưa có giao dịch {selectedType === 'income' ? 'thu nhập' : 'chi tiêu'} nào trong khoảng thời gian này.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Vòng tròn Donut Chart */}
            <div className="relative h-60 sm:h-64 flex items-center justify-center">
              <Doughnut data={donutChartData} options={donutChartOptions} />
              {/* Tổng tiền ở giữa vòng tròn */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] font-semibold text-[#7a6a58] uppercase tracking-wider">
                  Tổng {selectedType === 'income' ? 'Thu' : 'Chi'}
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#3e332a] max-w-[110px] truncate">
                  {formatCurrency(donutTotal)}
                </span>
              </div>
            </div>

            {/* Danh sách phân bổ chi tiết có thanh Progress Bar - BẤM VÀO ĐỂ XEM CHI TIẾT GIAO DỊCH */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {categoryBreakdown.map((item) => (
                <div
                  key={item.categoryId}
                  onClick={() => setSelectedDetailCategory(item)}
                  className="p-2 -mx-2 rounded-xl hover:bg-[#fbf5eb] active:scale-[0.99] transition cursor-pointer space-y-1 group border border-transparent hover:border-[#ebdcc9]"
                  title={`Bấm để xem chi tiết ${item.count} giao dịch ${item.name}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition shadow-xs"
                        style={{ backgroundColor: item.color }}
                      >
                        <DynamicIcon name={item.icon} className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-[#3e332a] truncate group-hover:text-[#a25832] transition">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-[#a89886] bg-[#f5ebe0] px-1.5 py-0.2 rounded-md">
                        {item.count} món
                      </span>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-1.5">
                      <div>
                        <span className="font-bold text-[#3e332a]">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="ml-1 text-[11px] font-semibold text-[#7a6a58]">
                          ({item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#a89886] group-hover:text-[#a25832] group-hover:translate-x-0.5 transition" />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full bg-[#f5ebe0] rounded-full overflow-hidden">
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

      {/* 5. TOP 5 KHOẢN CHI TIÊU LỚN NHẤT TRONG KỲ */}
      {topExpenses.length > 0 && (
        <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#f0e4d5]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c28b38]" />
              <h3 className="text-sm font-bold text-[#3e332a]">
                Top Khoản Chi Tiêu Lớn Nhất Trong Kỳ
              </h3>
            </div>
            <span className="text-[11px] text-[#7a6a58]">5 khoản chi cao nhất</span>
          </div>

          <div className="divide-y divide-[#f0e4d5]">
            {topExpenses.map((tx, idx) => {
              const cat = categories.find((c) => c.id === tx.categoryId);
              return (
                <div
                  key={tx.id}
                  className="py-2.5 flex items-center justify-between gap-3 first:pt-1 last:pb-1"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-[#f5ebe0] text-[#7a6a58] text-[10px] font-bold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: cat?.color || '#a25832' }}
                    >
                      <DynamicIcon name={cat?.icon || 'Tag'} className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#3e332a] truncate">
                        {tx.note || cat?.name || 'Chi tiêu'}
                      </div>
                      <div className="text-[10px] text-[#7a6a58]">
                        {new Date(tx.date).toLocaleDateString('vi-VN')} • {cat?.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-[#ea580c] shrink-0">
                    -{formatCurrency(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. BOTTOM SHEET / POPUP XEM CHI TIẾT GIAO DỊCH THEO DANH MỤC */}
      {selectedDetailCategory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#fffdfa] rounded-t-3xl sm:rounded-3xl border border-[#ebdcc9] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Header Popup */}
            <div className="p-4 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: selectedDetailCategory.color }}
                >
                  <DynamicIcon name={selectedDetailCategory.icon} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#3e332a] truncate">
                    {selectedDetailCategory.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#7a6a58]">
                    <span>{categoryDetailTransactions.length} giao dịch</span>
                    <span>•</span>
                    <span className="font-bold text-[#a25832]">
                      {formatCurrency(selectedDetailCategory.amount)}
                    </span>
                    <span>({selectedDetailCategory.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailCategory(null)}
                className="p-1.5 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f0e4d5] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Danh sách giao dịch chi tiết - Tái sử dụng chuẩn thiết kế Card của Sổ cái */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 max-h-[60vh]">
              {categoryDetailTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#7a6a58]">
                  Không có giao dịch nào trong danh mục này ở kỳ đã chọn.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#f0ece5] shadow-xs overflow-hidden divide-y divide-[#f0f0f0]">
                  {categoryDetailTransactions.map((tx) => {
                    const wallet = getWallet(tx.walletId);
                    const toWallet = tx.toWalletId ? getWallet(tx.toWalletId) : null;
                    const ledger = getLedger(tx.ledgerId);
                    const isIncome = tx.type === 'income';
                    const isTransfer = tx.type === 'transfer';

                    return (
                      <div
                        key={tx.id}
                        className="p-3.5 hover:bg-[#faf7f2]/50 transition flex items-start justify-between gap-3"
                      >
                        {/* Cột trái: Icon & Nội dung */}
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5"
                            style={{
                              backgroundColor: isTransfer
                                ? '#3b6e8c'
                                : selectedDetailCategory.color,
                            }}
                          >
                            <DynamicIcon
                              name={selectedDetailCategory.icon || 'Tag'}
                              className="w-4 h-4"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-xs sm:text-sm text-[#3e332a]">
                                {selectedDetailCategory.name}
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
                              {tx.note || 'Không có ghi chú'}
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

                        {/* Cột phải: Số tiền */}
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div
                            className={`text-xs sm:text-sm font-bold ${
                              isIncome ? 'text-[#2e7d32]' : 'text-[#b94a3b]'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {formatCurrency(tx.amount)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Popup */}
            <div className="p-3.5 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between gap-3">
              <div className="text-xs text-[#7a6a58]">
                Tổng cộng:{' '}
                <strong className="text-[#3e332a]">
                  {formatCurrency(selectedDetailCategory.amount)}
                </strong>
              </div>
              <button
                onClick={() => setSelectedDetailCategory(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#a25832] hover:bg-[#8c4623] text-white transition shadow-xs cursor-pointer active:scale-95"
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
