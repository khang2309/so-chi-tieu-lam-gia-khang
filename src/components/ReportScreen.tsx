import React, { useState, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Filter,
  Sparkles,
  Award,
} from 'lucide-react';
import { Transaction, Category } from '../types';
import { formatCurrency } from '../utils/formatters';
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

interface ReportScreenProps {
  transactions: Transaction[];
  categories: Category[];
  activeLedgerId?: string;
  activeLedgerName?: string;
}

type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year';

// Helper hàm xử lý Date an toàn tuyệt đối, chống Null Pointer Exception & Invalid Date
const getSafeDate = (val?: string | null | Date): Date => {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

const formatDateToYMD = (d: Date): string => {
  const safe = getSafeDate(d);
  const year = safe?.getFullYear?.() || new Date().getFullYear();
  const month = String((safe?.getMonth?.() ?? 0) + 1).padStart(2, '0');
  const day = String(safe?.getDate?.() ?? 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  activeLedgerId = 'all',
  activeLedgerName = 'Tất cả các sổ',
}) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1; // 1-4

  // 1. Filter States với fallback an toàn
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(currentQuarter);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return formatDateToYMD(currentDate);
  });
  const [compareWithPrevious, setCompareWithPrevious] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [isYearPickerOpen, setIsYearPickerOpen] = useState<boolean>(false);

  // LOGIC ĐỘNG HOÀN TOÀN (TUYỆT ĐỐI KHÔNG HARDCODE)
  // 1. Tự động sinh danh sách NĂM từ currentYear - 5 đến currentYear + 2
  const availableYears = useMemo(() => {
    const curY = new Date().getFullYear();
    const startY = curY - 5;
    const endY = curY + 2;
    const years: number[] = [];
    for (let y = endY; y >= startY; y--) {
      years.push(y);
    }
    return years;
  }, []);

  // 2. Tự động sinh danh sách 12 THÁNG bằng Date Object (tự tính ngày nhuận tháng 2)
  const dynamicMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(selectedYear, i, 1);
      const m = d.getMonth() + 1;
      const daysInMonth = new Date(selectedYear, i + 1, 0).getDate();
      return {
        month: m,
        label: `Tháng ${m}`,
        shortLabel: `T${m}`,
        daysInMonth,
      };
    });
  }, [selectedYear]);

  // 3. Tự động sinh 4 QUÝ bằng Date Object (tính tháng bắt đầu và kết thúc)
  const dynamicQuarters = useMemo(() => {
    return [1, 2, 3, 4].map((q) => {
      const startM = (q - 1) * 3;
      const endM = startM + 2;
      const startDate = new Date(selectedYear, startM, 1);
      const endDate = new Date(selectedYear, endM + 1, 0);
      return {
        quarter: q,
        label: `Quý ${q}`,
        monthsText: `T${startDate.getMonth() + 1} - T${endDate.getMonth() + 1}`,
        startDate,
        endDate,
      };
    });
  }, [selectedYear]);

  // 4. Tự động sinh danh sách TUẦN gần đây bằng Date arithmetic
  const dynamicWeeks = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const { startOfWeek, endOfWeek } = getWeekRange(now, i);
      const startStr = `${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1}`;
      const endStr = `${endOfWeek.getDate()}/${endOfWeek.getMonth() + 1}`;
      return {
        offset: i,
        label: i === 0 ? 'Tuần này' : i === 1 ? 'Tuần trước' : `${i} tuần trước`,
        rangeText: `(${startStr} - ${endStr})`,
        startDate: startOfWeek,
        endDate: endOfWeek,
      };
    });
  }, []);

  // Safe Date Picker change handler (Fallback chống trắng màn hình khi người dùng bấm XOÁ)
  const handleDateChange = (val?: string | null) => {
    if (!val || val.trim() === '') {
      setSelectedDate(formatDateToYMD(new Date()));
    } else {
      setSelectedDate(val);
    }
  };

  // Quick navigation handlers cho cả 5 mốc thời gian
  const handlePrevPeriod = () => {
    if (periodType === 'day') {
      const d = getSafeDate(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(formatDateToYMD(d));
    } else if (periodType === 'week') {
      setSelectedWeekOffset((prev) => prev + 1);
    } else if (periodType === 'month') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedMonth((m) => m - 1);
      }
    } else if (periodType === 'quarter') {
      if (selectedQuarter === 1) {
        setSelectedQuarter(4);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedQuarter((q) => q - 1);
      }
    } else if (periodType === 'year') {
      setSelectedYear((y) => y - 1);
    }
  };

  const handleNextPeriod = () => {
    if (periodType === 'day') {
      const d = getSafeDate(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(formatDateToYMD(d));
    } else if (periodType === 'week') {
      setSelectedWeekOffset((prev) => prev - 1);
    } else if (periodType === 'month') {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedMonth((m) => m + 1);
      }
    } else if (periodType === 'quarter') {
      if (selectedQuarter === 4) {
        setSelectedQuarter(1);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedQuarter((q) => q + 1);
      }
    } else if (periodType === 'year') {
      setSelectedYear((y) => y + 1);
    }
  };

  // 2. Base transactions filtered by active Ledger
  const ledgerTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => !tx.isDeleted && (activeLedgerId === 'all' || tx.ledgerId === activeLedgerId)
    );
  }, [transactions, activeLedgerId]);

  // 3. Current Period Transactions
  const currentPeriodTransactions = useMemo(() => {
    return ledgerTransactions.filter((tx) => {
      if (!tx.date) return false;
      const txDate = getSafeDate(tx.date);

      if (periodType === 'day') {
        const safeD = getSafeDate(selectedDate);
        const targetStr = formatDateToYMD(safeD);
        if (tx.date.slice(0, 10) !== targetStr) return false;
      } else if (periodType === 'week') {
        const { startOfWeek, endOfWeek } = getWeekRange(new Date(), selectedWeekOffset);
        if (txDate < startOfWeek || txDate > endOfWeek) return false;
      } else if (periodType === 'month') {
        if (
          txDate?.getFullYear?.() !== selectedYear ||
          (txDate?.getMonth?.() ?? -1) + 1 !== selectedMonth
        ) {
          return false;
        }
      } else if (periodType === 'quarter') {
        if (txDate?.getFullYear?.() !== selectedYear) return false;
        const txQuarter = Math.floor((txDate?.getMonth?.() ?? 0) / 3) + 1;
        if (txQuarter !== selectedQuarter) return false;
      } else if (periodType === 'year') {
        if (txDate?.getFullYear?.() !== selectedYear) return false;
      }

      // Filter by category if selected
      if (selectedCategoryId !== 'all' && tx.categoryId !== selectedCategoryId) {
        return false;
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
    selectedDate,
    selectedWeekOffset,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    selectedCategoryId,
    selectedType,
  ]);

  // 4. Previous Period Transactions (for Comparison)
  const previousPeriodTransactions = useMemo(() => {
    if (!compareWithPrevious) return [];

    return ledgerTransactions.filter((tx) => {
      if (!tx.date) return false;
      const txDate = getSafeDate(tx.date);

      if (periodType === 'day') {
        const safeD = getSafeDate(selectedDate);
        const prevD = new Date(safeD);
        prevD.setDate((prevD?.getDate?.() ?? 1) - 1);
        const prevDateStr = formatDateToYMD(prevD);
        if (tx.date.slice(0, 10) !== prevDateStr) return false;
      } else if (periodType === 'week') {
        const { startOfWeek, endOfWeek } = getWeekRange(new Date(), selectedWeekOffset + 1);
        if (txDate < startOfWeek || txDate > endOfWeek) return false;
      } else if (periodType === 'month') {
        const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
        const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
        if (
          txDate?.getFullYear?.() !== prevYear ||
          (txDate?.getMonth?.() ?? -1) + 1 !== prevMonth
        ) {
          return false;
        }
      } else if (periodType === 'quarter') {
        const prevYear = selectedQuarter === 1 ? selectedYear - 1 : selectedYear;
        const prevQuarter = selectedQuarter === 1 ? 4 : selectedQuarter - 1;
        if (txDate?.getFullYear?.() !== prevYear) return false;
        const txQuarter = Math.floor((txDate?.getMonth?.() ?? 0) / 3) + 1;
        if (txQuarter !== prevQuarter) return false;
      } else if (periodType === 'year') {
        if (txDate?.getFullYear?.() !== selectedYear - 1) return false;
      }

      if (selectedCategoryId !== 'all' && tx.categoryId !== selectedCategoryId) {
        return false;
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
    selectedDate,
    selectedWeekOffset,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    selectedCategoryId,
    selectedType,
  ]);

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
      const startM = (selectedQuarter - 1) * 3;
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
  }, [currentPeriodTransactions, periodType, selectedQuarter]);

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

  // Title display hỗ trợ đủ 5 mốc
  const periodTitle = useMemo(() => {
    if (periodType === 'day') {
      const d = getSafeDate(selectedDate);
      return `Ngày ${d?.getDate?.()}/${(d?.getMonth?.() ?? 0) + 1}/${d?.getFullYear?.()}`;
    }
    if (periodType === 'week') {
      const { startOfWeek, endOfWeek } = getWeekRange(new Date(), selectedWeekOffset);
      const prefix = selectedWeekOffset === 0 ? 'Tuần này' : selectedWeekOffset === 1 ? 'Tuần trước' : `${selectedWeekOffset} tuần trước`;
      return `${prefix} (${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1} - ${endOfWeek.getDate()}/${endOfWeek.getMonth() + 1}/${endOfWeek.getFullYear()})`;
    }
    if (periodType === 'month') {
      return `Tháng ${selectedMonth}/${selectedYear}`;
    }
    if (periodType === 'quarter') {
      const startM = (selectedQuarter - 1) * 3 + 1;
      const endM = selectedQuarter * 3;
      return `Quý ${selectedQuarter}/${selectedYear} (Tháng ${startM} - ${endM})`;
    }
    return `Năm ${selectedYear}`;
  }, [periodType, selectedDate, selectedWeekOffset, selectedMonth, selectedQuarter, selectedYear]);

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* 1. HEADER & CHỌN MỐC THỜI GIAN */}
      <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper p-4 space-y-3.5">
        {/* Tiêu đề & Chọn Sổ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#f0e4d5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#a25832]/10 text-[#a25832] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#3e332a]">
                Báo Cáo & Thống Kê Chuyên Sâu
              </h2>
              <p className="text-xs text-[#7a6a58]">
                {activeLedgerId === 'all'
                  ? 'Tổng hợp toàn bộ các sổ'
                  : `Đang lọc theo sổ: ${activeLedgerName}`}
              </p>
            </div>
          </div>

          {/* Nút chuyển chế độ ĐỦ 5 MỐC: ['Ngày', 'Tuần', 'Tháng', 'Quý', 'Năm'] */}
          <div className="flex items-center bg-[#f5ebe0] p-1 rounded-xl border border-[#ebdcc9] self-start sm:self-auto overflow-x-auto scrollbar-none">
            {(
              [
                { type: 'day', label: 'Ngày' },
                { type: 'week', label: 'Tuần' },
                { type: 'month', label: 'Tháng' },
                { type: 'quarter', label: 'Quý' },
                { type: 'year', label: 'Năm' },
              ] as const
            ).map((item) => (
              <button
                key={item.type}
                onClick={() => setPeriodType(item.type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  periodType === item.type
                    ? 'bg-[#a25832] text-white shadow-xs'
                    : 'text-[#7a6a58] hover:text-[#3e332a]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Thanh Điều Hướng Thời Gian (Prev, Label, Next, Year Picker) */}
        <div className="flex items-center justify-between gap-2 bg-[#fcf8f2] p-2.5 rounded-xl border border-[#ebdcc9]">
          <button
            onClick={handlePrevPeriod}
            className="p-1.5 rounded-lg bg-white border border-[#ebdcc9] text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition cursor-pointer active:scale-95"
            title="Kỳ trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Middle: Period Label + Quick Picker */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#a25832]" />
            <span className="text-xs sm:text-sm font-bold text-[#3e332a] truncate max-w-[200px] sm:max-w-none">
              {periodTitle}
            </span>

            {/* Nút mở nhanh Year Picker */}
            <button
              onClick={() => setIsYearPickerOpen((prev) => !prev)}
              className="px-2 py-0.5 rounded-md bg-white border border-[#ebdcc9] text-[11px] font-semibold text-[#a25832] hover:bg-[#f5ebe0] transition cursor-pointer shrink-0"
              title="Đổi năm nhanh"
            >
              Năm {selectedYear} ▼
            </button>
          </div>

          <button
            onClick={handleNextPeriod}
            className="p-1.5 rounded-lg bg-white border border-[#ebdcc9] text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition cursor-pointer active:scale-95"
            title="Kỳ sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Year Picker Dropdown (Cuộn chọn năm bất kỳ - Sinh động 100%) */}
        {isYearPickerOpen && (
          <div className="p-3 bg-[#fbf5eb] rounded-xl border border-[#ebdcc9] space-y-2 animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between text-xs font-bold text-[#7a6a58]">
              <span>Chọn năm báo cáo:</span>
              <button
                onClick={() => setIsYearPickerOpen(false)}
                className="text-[#a25832] hover:underline cursor-pointer"
              >
                Đóng ✕
              </button>
            </div>
            {/* Lưới cuộn các năm */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1">
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setSelectedYear(y);
                    setIsYearPickerOpen(false);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
                    selectedYear === y
                      ? 'bg-[#a25832] text-white shadow-xs'
                      : 'bg-white text-[#7a6a58] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GIAO DIỆN CHỌN THỜI GIAN TƯƠNG ỨNG TỪNG CHẾ ĐỘ (ĐỘNG 100%) */}

        {/* 1. Nếu chọn Ngày: DatePicker với Fallback an toàn + Quick Chips */}
        {periodType === 'day' && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#7a6a58] font-semibold">Chọn ngày:</span>
              <input
                type="date"
                value={selectedDate || formatDateToYMD(new Date())}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
              />
              {/* Quick chips */}
              <button
                onClick={() => setSelectedDate(formatDateToYMD(new Date()))}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#ebdcc9] text-xs font-semibold text-[#a25832] hover:bg-[#f5ebe0] transition cursor-pointer"
              >
                Hôm nay
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSelectedDate(formatDateToYMD(yesterday));
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#f5ebe0] transition cursor-pointer"
              >
                Hôm qua
              </button>
            </div>
          </div>
        )}

        {/* 2. Nếu chọn Tuần: Lưới các tuần gần đây */}
        {periodType === 'week' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
            {dynamicWeeks.map((w) => (
              <button
                key={w.offset}
                onClick={() => setSelectedWeekOffset(w.offset)}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition text-left cursor-pointer border ${
                  selectedWeekOffset === w.offset
                    ? 'bg-[#3e332a] text-white border-[#3e332a] shadow-xs'
                    : 'bg-[#fbf5eb] text-[#7a6a58] hover:bg-[#ebdcc9] border-[#ebdcc9]'
                }`}
              >
                <div className="font-bold">{w.label}</div>
                <div className={`text-[10px] ${selectedWeekOffset === w.offset ? 'text-[#ebdcc9]' : 'text-[#a89886]'}`}>
                  {w.rangeText}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 3. Nếu chọn Tháng: 12 tháng sinh động bằng Date Object */}
        {periodType === 'month' && (
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 pt-1">
            {dynamicMonths.map((m) => (
              <button
                key={m.month}
                onClick={() => setSelectedMonth(m.month)}
                className={`py-1 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  selectedMonth === m.month
                    ? 'bg-[#3e332a] text-white shadow-xs'
                    : 'bg-[#fbf5eb] text-[#7a6a58] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
                }`}
                title={`Tháng ${m.month} (${m.daysInMonth} ngày)`}
              >
                {m.shortLabel}
              </button>
            ))}
          </div>
        )}

        {/* 4. Nếu chọn Quý: 4 Quý sinh động bằng Date Object */}
        {periodType === 'quarter' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
            {dynamicQuarters.map((q) => (
              <button
                key={q.quarter}
                onClick={() => setSelectedQuarter(q.quarter)}
                className={`p-2.5 rounded-xl text-xs font-bold transition text-center cursor-pointer border ${
                  selectedQuarter === q.quarter
                    ? 'bg-[#3e332a] text-white border-[#3e332a] shadow-xs'
                    : 'bg-[#fbf5eb] text-[#7a6a58] hover:bg-[#ebdcc9] border-[#ebdcc9]'
                }`}
              >
                <div className="text-sm">{q.label}</div>
                <div className={`text-[10px] font-normal mt-0.5 ${selectedQuarter === q.quarter ? 'text-[#ebdcc9]' : 'text-[#a89886]'}`}>
                  {q.monthsText}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 5. Nếu chọn Năm: Danh sách năm */}
        {periodType === 'year' && (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  selectedYear === y
                    ? 'bg-[#3e332a] text-white shadow-xs'
                    : 'bg-[#fbf5eb] text-[#7a6a58] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
                }`}
              >
                {y}
              </button>
            ))}
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

        {/* Lọc đích danh Danh mục (Scrollable Chips) */}
        <div className="pt-2 border-t border-[#f0e4d5] space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#7a6a58]">
            <span className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#a25832]" />
              Lọc theo danh mục:
            </span>
            {selectedCategoryId !== 'all' && (
              <button
                onClick={() => setSelectedCategoryId('all')}
                className="text-[#a25832] hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                selectedCategoryId === 'all'
                  ? 'bg-[#3e332a] text-white shadow-xs'
                  : 'bg-[#fbf5eb] text-[#7a6a58] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
              }`}
            >
              Tất cả ({categories.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setSelectedCategoryId(
                    selectedCategoryId === cat.id ? 'all' : cat.id
                  )
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  selectedCategoryId === cat.id
                    ? 'bg-[#a25832] text-white shadow-xs'
                    : 'bg-[#fbf5eb] text-[#7a6a58] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.name}</span>
              </button>
            ))}
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

            {/* Danh sách phân bổ chi tiết có thanh Progress Bar */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {categoryBreakdown.map((item) => (
                <div key={item.categoryId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: item.color }}
                      >
                        <DynamicIcon name={item.icon} className="w-3 h-3" />
                      </div>
                      <span className="font-semibold text-[#3e332a] truncate">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-[#a89886]">
                        ({item.count} món)
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-[#3e332a]">
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="ml-1 text-[11px] font-semibold text-[#7a6a58]">
                        ({item.percentage.toFixed(1)}%)
                      </span>
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
    </div>
  );
};
