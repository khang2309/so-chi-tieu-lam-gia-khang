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

type PeriodType = 'month' | 'year' | 'day';

export const ReportScreen: React.FC<ReportScreenProps> = ({
  transactions,
  categories,
  activeLedgerId = 'all',
  activeLedgerName = 'Tất cả các sổ',
}) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12

  // 1. Filter States
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return currentDate.toISOString().slice(0, 10);
  });
  const [compareWithPrevious, setCompareWithPrevious] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [isYearPickerOpen, setIsYearPickerOpen] = useState<boolean>(false);

  // Available years for Year Picker (e.g., from 2022 to currentYear + 2)
  const availableYears = useMemo(() => {
    const years: number[] = [];
    const minYear = 2022;
    const maxYear = Math.max(currentYear + 2, 2028);
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Quick navigation handlers
  const handlePrevPeriod = () => {
    if (periodType === 'month') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedMonth((m) => m - 1);
      }
    } else if (periodType === 'year') {
      setSelectedYear((y) => y - 1);
    } else if (periodType === 'day') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d.toISOString().slice(0, 10));
    }
  };

  const handleNextPeriod = () => {
    if (periodType === 'month') {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedMonth((m) => m + 1);
      }
    } else if (periodType === 'year') {
      setSelectedYear((y) => y + 1);
    } else if (periodType === 'day') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d.toISOString().slice(0, 10));
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
      const txDate = new Date(tx.date);
      if (periodType === 'day') {
        const txDateStr = tx.date.slice(0, 10);
        if (txDateStr !== selectedDate) return false;
      } else if (periodType === 'month') {
        if (
          txDate.getFullYear() !== selectedYear ||
          txDate.getMonth() + 1 !== selectedMonth
        ) {
          return false;
        }
      } else if (periodType === 'year') {
        if (txDate.getFullYear() !== selectedYear) {
          return false;
        }
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
    selectedYear,
    selectedMonth,
    selectedCategoryId,
    selectedType,
  ]);

  // 4. Previous Period Transactions (for Comparison)
  const previousPeriodTransactions = useMemo(() => {
    if (!compareWithPrevious) return [];

    return ledgerTransactions.filter((tx) => {
      const txDate = new Date(tx.date);

      if (periodType === 'day') {
        const currentD = new Date(selectedDate);
        currentD.setDate(currentD.getDate() - 1);
        const prevDateStr = currentD.toISOString().slice(0, 10);
        if (tx.date.slice(0, 10) !== prevDateStr) return false;
      } else if (periodType === 'month') {
        // Compare with same month of previous year (hoặc tháng trước)
        const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
        const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
        if (
          txDate.getFullYear() !== prevYear ||
          txDate.getMonth() + 1 !== prevMonth
        ) {
          return false;
        }
      } else if (periodType === 'year') {
        if (txDate.getFullYear() !== selectedYear - 1) {
          return false;
        }
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
    selectedYear,
    selectedMonth,
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

  // 8. Bar Chart Data (Tương quan Thu / Chi theo trục thời gian)
  const barChartData = useMemo(() => {
    if (periodType === 'month') {
      // Nhóm theo 5 tuần trong tháng: Tuần 1 (1-7), Tuần 2 (8-14), Tuần 3 (15-21), Tuần 4 (22-28), Tuần 5 (29-cuối)
      const weeks = [
        { label: 'T.1 (1-7)', income: 0, expense: 0 },
        { label: 'T.2 (8-14)', income: 0, expense: 0 },
        { label: 'T.3 (15-21)', income: 0, expense: 0 },
        { label: 'T.4 (22-28)', income: 0, expense: 0 },
        { label: 'T.5 (29+)', income: 0, expense: 0 },
      ];

      currentPeriodTransactions.forEach((tx) => {
        const day = new Date(tx.date).getDate();
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
    } else if (periodType === 'year') {
      // 12 tháng trong năm
      const months = Array.from({ length: 12 }, (_, i) => ({
        label: `T${i + 1}`,
        income: 0,
        expense: 0,
      }));

      currentPeriodTransactions.forEach((tx) => {
        const m = new Date(tx.date).getMonth(); // 0-11
        if (tx.type === 'income') months[m].income += tx.amount;
        if (tx.type === 'expense') months[m].expense += tx.amount;
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
    } else {
      // Theo Ngày: Các buổi trong ngày (Sáng, Trưa/Chiều, Tối/Đêm)
      const parts = [
        { label: 'Sáng (0h-11h)', income: 0, expense: 0 },
        { label: 'Chiều (12h-17h)', income: 0, expense: 0 },
        { label: 'Tối (18h-23h)', income: 0, expense: 0 },
      ];

      currentPeriodTransactions.forEach((tx) => {
        const h = new Date(tx.date).getHours();
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
    }
  }, [currentPeriodTransactions, periodType]);

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

  // Title display
  const periodTitle = useMemo(() => {
    if (periodType === 'day') {
      const d = new Date(selectedDate);
      return `Ngày ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }
    if (periodType === 'month') {
      return `Tháng ${selectedMonth}/${selectedYear}`;
    }
    return `Năm ${selectedYear}`;
  }, [periodType, selectedDate, selectedMonth, selectedYear]);

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

          {/* Nút chuyển chế độ Ngày / Tháng / Năm */}
          <div className="flex items-center bg-[#f5ebe0] p-1 rounded-xl border border-[#ebdcc9] self-start sm:self-auto">
            {(
              [
                { type: 'day', label: 'Ngày' },
                { type: 'month', label: 'Tháng' },
                { type: 'year', label: 'Năm' },
              ] as const
            ).map((item) => (
              <button
                key={item.type}
                onClick={() => setPeriodType(item.type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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
            <span className="text-sm font-bold text-[#3e332a]">
              {periodTitle}
            </span>

            {/* Nút mở nhanh Year Picker */}
            <button
              onClick={() => setIsYearPickerOpen((prev) => !prev)}
              className="px-2 py-0.5 rounded-md bg-white border border-[#ebdcc9] text-[11px] font-semibold text-[#a25832] hover:bg-[#f5ebe0] transition cursor-pointer"
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

        {/* Year Picker Dropdown (Cuộn chọn năm bất kỳ) */}
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

        {/* Bộ chọn tháng (khi ở chế độ Tháng) */}
        {periodType === 'month' && (
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 pt-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`py-1 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  selectedMonth === m
                    ? 'bg-[#3e332a] text-white shadow-xs'
                    : 'bg-[#fbf5eb] text-[#7a6a58] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
                }`}
              >
                T{m}
              </button>
            ))}
          </div>
        )}

        {/* Chọn ngày cụ thể (khi ở chế độ Ngày) */}
        {periodType === 'day' && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-[#7a6a58] font-semibold">Chọn ngày:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
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
            <span>So sánh với {periodType === 'year' ? 'năm trước' : periodType === 'month' ? 'tháng trước' : 'hôm qua'}</span>
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
