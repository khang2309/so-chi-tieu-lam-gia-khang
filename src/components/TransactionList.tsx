import React, { useState, useMemo, useRef, useEffect } from 'react';
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
}

interface DayGroup {
  dateKey: string;
  dayNumber: string;
  dayOfWeek: string;
  monthYearString: string;
  isToday: boolean;
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
}) => {
  // Chế độ bộ lọc thời gian: Mặc định là 'month' (Tháng)
  const [filterMode, setFilterMode] = useState<FilterMode>('month');

  // Khóa mốc thời gian đang chọn cho từng chế độ (Mặc định chọn đúng tháng hiện tại YYYY-MM)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string>('today');
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('this_week');
  const [selectedQuarterKey, setSelectedQuarterKey] = useState<string>('current_q');
  const [selectedYearKey, setSelectedYearKey] = useState<string>('current_year');

  // Cho chế độ Ngày cụ thể hoặc Tùy chỉnh khoảng thời gian
  const [specificDate, setSpecificDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getCategory = (catId: string) => categories.find((c) => c.id === catId);
  const getWallet = (wId: string) => wallets.find((w) => w.id === wId);
  const getLedger = (lId: string) => ledgers.find((l) => l.id === lId);

  // 1. Chỉ hiển thị giao dịch của Sổ đang chọn
  const ledgerFilteredTransactions = useMemo(() => {
    if (activeLedgerId && activeLedgerId !== 'all') {
      return transactions.filter((t) => t.ledgerId === activeLedgerId);
    }
    return transactions;
  }, [transactions, activeLedgerId]);

  // Sinh danh sách các tabs cuộn ngang cho Tháng (Tự động sinh đủ 12 tháng từ 01/YYYY đến 12/YYYY)
  const monthTabs = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1 - 12

    const tabs: Array<{
      key: string;
      label: string;
      year: number;
      month: number;
      isCurrent?: boolean;
    }> = [];

    // Tự động sinh mảng đủ 12 tháng của năm (từ tháng 01 đến tháng 12)
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

    // Tab Xem tất cả các tháng
    tabs.push({
      key: 'all_months',
      label: 'TẤT CẢ THÁNG',
      year: currentYear,
      month: currentMonth,
    });

    return tabs;
  }, []);

  // Sinh danh sách các tabs cuộn ngang cho Ngày
  const dayTabs = useMemo(() => {
    const now = new Date();
    const makeDateKey = (offsetDays: number) => {
      const d = new Date(now);
      d.setDate(now.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };

    const dMinus2 = makeDateKey(-2);
    const dMinus1 = makeDateKey(-1);
    const dToday = makeDateKey(0);
    const dPlus1 = makeDateKey(1);

    return [
      { key: dMinus2, label: `Hôm kia (${dMinus2.slice(8, 10)}/${dMinus2.slice(5, 7)})` },
      { key: dMinus1, label: `Hôm qua (${dMinus1.slice(8, 10)}/${dMinus1.slice(5, 7)})` },
      { key: 'today', label: `HÔM NAY (${dToday.slice(8, 10)}/${dToday.slice(5, 7)})` },
      { key: dPlus1, label: `Ngày mai (${dPlus1.slice(8, 10)}/${dPlus1.slice(5, 7)})` },
      { key: 'picker', label: '📅 Chọn ngày khác...' },
    ];
  }, []);

  // Sinh danh sách các tabs cuộn ngang cho Tuần
  const weekTabs = useMemo(() => {
    return [
      { key: 'week_-2', label: '2 tuần trước' },
      { key: 'week_-1', label: 'Tuần trước' },
      { key: 'this_week', label: 'TUẦN NÀY' },
      { key: 'next_week', label: 'Tuần tới' },
      { key: 'all_weeks', label: 'Tất cả các tuần' },
    ];
  }, []);

  // Sinh danh sách các tabs cuộn ngang cho Quý
  const quarterTabs = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

    return [
      { key: 'q1', label: `Quý 1/${currentYear}` },
      { key: 'q2', label: `Quý 2/${currentYear}` },
      { key: 'q3', label: `Quý 3/${currentYear}` },
      { key: 'current_q', label: `QUÝ ${currentQuarter}/${currentYear} (Hiện tại)` },
      { key: 'prev_year_q', label: `Quý năm ${currentYear - 1}` },
    ];
  }, []);

  // Sinh danh sách các tabs cuộn ngang cho Năm
  const yearTabs = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      { key: String(currentYear - 2), label: `Năm ${currentYear - 2}` },
      { key: String(currentYear - 1), label: `Năm ${currentYear - 1}` },
      { key: 'current_year', label: `NĂM NAY (${currentYear})` },
      { key: 'all_years', label: 'Tất cả các năm' },
    ];
  }, []);

  // Tự động cuộn đến tab đang chọn khi chuyển đổi chế độ
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [filterMode, selectedMonthKey, selectedDayKey, selectedWeekKey, selectedQuarterKey, selectedYearKey]);

  // 2. Logic kiểm tra giao dịch có thuộc mốc thời gian đang chọn không
  const isTxInSelectedTimeline = (tx: Transaction): boolean => {
    const txDateStr = (tx.date || '').slice(0, 10);
    if (!txDateStr) return false;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDayStr = now.toISOString().slice(0, 10);

    const txDateObj = new Date(txDateStr + 'T12:00:00');
    if (isNaN(txDateObj.getTime())) return false;
    const txYear = txDateObj.getFullYear();
    const txMonth = txDateObj.getMonth() + 1;

    switch (filterMode) {
      case 'month': {
        if (selectedMonthKey === 'all_months') return true;
        if (selectedMonthKey === 'current') {
          return txYear === currentYear && txMonth === currentMonth;
        }
        if (selectedMonthKey === 'future') {
          return txYear > currentYear || (txYear === currentYear && txMonth > currentMonth);
        }
        const [targetYear, targetMonth] = selectedMonthKey.split('-').map(Number);
        return txYear === targetYear && txMonth === targetMonth;
      }

      case 'day': {
        if (selectedDayKey === 'picker') {
          return txDateStr === specificDate;
        }
        if (selectedDayKey === 'today') {
          return txDateStr === currentDayStr;
        }
        return txDateStr === selectedDayKey;
      }

      case 'week': {
        if (selectedWeekKey === 'all_weeks') return true;

        const currentDay = now.getDay();
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const currentMonday = new Date(now);
        currentMonday.setDate(now.getDate() + diffToMonday);
        currentMonday.setHours(0, 0, 0, 0);

        let targetMonday = new Date(currentMonday);
        if (selectedWeekKey === 'week_-1') {
          targetMonday.setDate(currentMonday.getDate() - 7);
        } else if (selectedWeekKey === 'week_-2') {
          targetMonday.setDate(currentMonday.getDate() - 14);
        } else if (selectedWeekKey === 'next_week') {
          targetMonday.setDate(currentMonday.getDate() + 7);
        }

        const targetSunday = new Date(targetMonday);
        targetSunday.setDate(targetMonday.getDate() + 6);
        targetSunday.setHours(23, 59, 59, 999);

        return txDateObj >= targetMonday && txDateObj <= targetSunday;
      }

      case 'quarter': {
        const txQuarter = Math.floor((txMonth - 1) / 3) + 1;
        if (selectedQuarterKey === 'current_q') {
          const curQ = Math.floor((currentMonth - 1) / 3) + 1;
          return txYear === currentYear && txQuarter === curQ;
        }
        if (selectedQuarterKey === 'q1') return txYear === currentYear && txQuarter === 1;
        if (selectedQuarterKey === 'q2') return txYear === currentYear && txQuarter === 2;
        if (selectedQuarterKey === 'q3') return txYear === currentYear && txQuarter === 3;
        if (selectedQuarterKey === 'prev_year_q') return txYear === currentYear - 1;
        return true;
      }

      case 'year': {
        if (selectedYearKey === 'all_years') return true;
        if (selectedYearKey === 'current_year') return txYear === currentYear;
        return txYear === Number(selectedYearKey);
      }

      case 'custom': {
        if (customStartDate && txDateStr < customStartDate) return false;
        if (customEndDate && txDateStr > customEndDate) return false;
        return true;
      }

      default:
        return true;
    }
  };

  // 3. Lọc danh sách giao dịch theo search, typeFilter, và mốc thời gian
  const filteredList = useMemo(() => {
    return ledgerFilteredTransactions.filter((tx) => {
      // Tìm kiếm text
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const cat = getCategory(tx.categoryId);
        const catName = cat ? cat.name.toLowerCase() : '';
        const noteMatch = tx.note.toLowerCase().includes(q);
        const catMatch = catName.includes(q);
        const amtMatch = tx.amount.toString().includes(q);
        if (!noteMatch && !catMatch && !amtMatch) return false;
      }

      // Loại giao dịch (Chi tiêu / Thu nhập / Tất cả)
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

  // 4. Thống kê tổng quan cho khoảng thời gian đang chọn (Tiền vào / Tiền ra / Chênh lệch)
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

  // 5. Gom nhóm theo ngày bằng Array.prototype.reduce theo đúng yêu cầu
  const groupedDays = useMemo(() => {
    // Dùng reduce gom nhóm các giao dịch có cùng ngày (YYYY-MM-DD)
    const groups = filteredList.reduce<Record<string, Transaction[]>>((acc, tx) => {
      const dKey = tx.date.slice(0, 10);
      if (!acc[dKey]) {
        acc[dKey] = [];
      }
      acc[dKey].push(tx);
      return acc;
    }, {});

    // Sắp xếp ngày giảm dần (ngày gần nhất nằm trên cùng)
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const todayStr = new Date().toISOString().slice(0, 10);
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

      // Trong cùng một ngày, sắp xếp giao dịch mới nhất nằm trên
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
      const monthYearString = `tháng ${parsedDate.getMonth() + 1} ${parsedDate.getFullYear()}`;

      return {
        dateKey,
        dayNumber,
        dayOfWeek,
        monthYearString,
        isToday: dateKey === todayStr,
        totalIncome,
        totalExpense,
        transactions: sortedTx,
      } as DayGroup;
    });
  }, [filteredList]);

  // Xuất danh sách giao dịch đang hiển thị ra file Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredList.length === 0) {
      alert('Không có giao dịch nào trong khoảng thời gian đang chọn để xuất Excel!');
      return;
    }
    const cleanLedger = (activeLedgerName || 'Tat_Ca').replace(/\s+/g, '_');
    const filename = `Chi_Tieu_${cleanLedger}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportTransactionsToExcel(
      filteredList,
      categories,
      ledgers,
      wallets,
      filename
    );
  };

  return (
    <section className="rounded-2xl border border-[#e8ded1] bg-[#fffdfa] shadow-paper overflow-hidden">
      {/* 1. TOP HEADER & TÌM KIẾM */}
      <div className="p-4 border-b border-[#f0e4d5] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#a25832]" />
            <h2 className="text-base font-bold text-[#3e332a]">
              Nhật Ký Giao Dịch
            </h2>
            {activeLedgerId && activeLedgerId !== 'all' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f5ebe0] text-[#a25832] font-semibold border border-[#ebdcc9]">
                {activeLedgerName || ledgers.find((l) => l.id === activeLedgerId)?.name || 'Sổ hiện tại'}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ebe0] text-[#7a6a58] font-medium">
              {windowSummary.count}
            </span>
          </div>

          {/* Actions & Type Filter */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Nút Xuất Excel */}
            <button
              onClick={handleExportExcel}
              title="Xuất danh sách giao dịch ra file Excel (.xlsx)"
              className="px-2.5 py-1 text-xs rounded-lg font-bold bg-[#107c41]/10 text-[#107c41] hover:bg-[#107c41] hover:text-white border border-[#107c41]/30 transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel</span>
            </button>

            {/* Type Filter Buttons */}
            <div className="flex items-center bg-[#f5ebe0] p-0.5 rounded-lg border border-[#ebdcc9]">
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
        </div>

        {/* Thanh tìm kiếm */}
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

        {/* 2. THANH ĐIỀU HƯỚNG NGANG TOP BAR: Ngày | Tuần | Tháng (Mặc định) | Quý | Năm | Tùy chỉnh */}
        <div className="pt-1">
          <div className="flex items-center justify-between bg-[#f5ebe0]/80 p-1 rounded-xl border border-[#ebdcc9]">
            {(
              [
                { mode: 'day', label: 'Ngày' },
                { mode: 'week', label: 'Tuần' },
                { mode: 'month', label: 'Tháng' },
                { mode: 'quarter', label: 'Quý' },
                { mode: 'year', label: 'Năm' },
                { mode: 'custom', label: 'Tùy chỉnh' },
              ] as const
            ).map((item) => {
              const active = filterMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => setFilterMode(item.mode)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition text-center ${
                    active
                      ? 'bg-[#a25832] text-white shadow-xs'
                      : 'text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#fffdfa]/50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. THANH CUỘN NGANG THỜI GIAN (TIMELINE SCROLL) BẰNG TAILWIND CSS (overflow-x-auto) */}
        <div className="relative pt-0.5">
          <div
            ref={scrollContainerRef}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5"
          >
            {/* Chế độ Tháng (Mặc định) */}
            {filterMode === 'month' &&
              monthTabs.map((tab) => {
                const active = selectedMonthKey === tab.key;
                return (
                  <button
                    key={tab.key}
                    data-active={active}
                    onClick={() => setSelectedMonthKey(tab.key)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs transition shrink-0 ${
                      active
                        ? 'bg-[#3e332a] text-[#fdf8f0] font-bold shadow-xs border-b-2 border-[#a25832]'
                        : 'bg-[#fbf5eb] text-[#7a6a58] border border-[#ebdcc9] font-medium hover:bg-[#fffdfa] hover:text-[#3e332a]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}

            {/* Chế độ Ngày */}
            {filterMode === 'day' &&
              dayTabs.map((tab) => {
                const active = selectedDayKey === tab.key;
                return (
                  <button
                    key={tab.key}
                    data-active={active}
                    onClick={() => setSelectedDayKey(tab.key)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs transition shrink-0 ${
                      active
                        ? 'bg-[#3e332a] text-[#fdf8f0] font-bold shadow-xs border-b-2 border-[#a25832]'
                        : 'bg-[#fbf5eb] text-[#7a6a58] border border-[#ebdcc9] font-medium hover:bg-[#fffdfa] hover:text-[#3e332a]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}

            {/* Chế độ Tuần */}
            {filterMode === 'week' &&
              weekTabs.map((tab) => {
                const active = selectedWeekKey === tab.key;
                return (
                  <button
                    key={tab.key}
                    data-active={active}
                    onClick={() => setSelectedWeekKey(tab.key)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs transition shrink-0 ${
                      active
                        ? 'bg-[#3e332a] text-[#fdf8f0] font-bold shadow-xs border-b-2 border-[#a25832]'
                        : 'bg-[#fbf5eb] text-[#7a6a58] border border-[#ebdcc9] font-medium hover:bg-[#fffdfa] hover:text-[#3e332a]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}

            {/* Chế độ Quý */}
            {filterMode === 'quarter' &&
              quarterTabs.map((tab) => {
                const active = selectedQuarterKey === tab.key;
                return (
                  <button
                    key={tab.key}
                    data-active={active}
                    onClick={() => setSelectedQuarterKey(tab.key)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs transition shrink-0 ${
                      active
                        ? 'bg-[#3e332a] text-[#fdf8f0] font-bold shadow-xs border-b-2 border-[#a25832]'
                        : 'bg-[#fbf5eb] text-[#7a6a58] border border-[#ebdcc9] font-medium hover:bg-[#fffdfa] hover:text-[#3e332a]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}

            {/* Chế độ Năm */}
            {filterMode === 'year' &&
              yearTabs.map((tab) => {
                const active = selectedYearKey === tab.key;
                return (
                  <button
                    key={tab.key}
                    data-active={active}
                    onClick={() => setSelectedYearKey(tab.key)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs transition shrink-0 ${
                      active
                        ? 'bg-[#3e332a] text-[#fdf8f0] font-bold shadow-xs border-b-2 border-[#a25832]'
                        : 'bg-[#fbf5eb] text-[#7a6a58] border border-[#ebdcc9] font-medium hover:bg-[#fffdfa] hover:text-[#3e332a]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
          </div>

          {/* Ô nhập ngày khi chọn ngày cụ thể hoặc tùy chỉnh */}
          {filterMode === 'day' && selectedDayKey === 'picker' && (
            <div className="mt-2 p-2.5 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#7a6a58]">Chọn ngày:</span>
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:outline-none focus:border-[#a25832]"
              />
            </div>
          )}

          {filterMode === 'custom' && (
            <div className="mt-2 p-2.5 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[#7a6a58]">Khoảng thời gian:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#7a6a58]">Từ:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#7a6a58]">Đến:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. TÓM TẮT TÀI CHÍNH: Tiền vào / Tiền ra / Chênh lệch của khoảng thời gian đang chọn */}
        <div className="bg-[#fbf5eb] p-2.5 sm:p-3 rounded-xl border border-[#ebdcc9] grid grid-cols-3 divide-x divide-[#ebdcc9] text-center shadow-xs">
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

      {/* 5. DANH SÁCH GIAO DỊCH GOM NHÓM THEO NGÀY (GROUP BY DATE) */}
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
          groupedDays.map((dayGroup) => (
            <div key={dayGroup.dateKey} className="border-b border-[#ebdcc9] last:border-b-0">
              {/* Header Cụm Ngày Nổi Bật (Thiết kế app tài chính chuẩn) */}
              <div className="bg-[#fdfaf5] px-4 py-2.5 border-y border-[#ebdcc9] flex items-center justify-between sticky top-0 z-10 shadow-xs">
                {/* Góc trái: Ngày (số lớn) + Thứ + Tháng năm */}
                <div className="flex items-center gap-3">
                  <div
                    className={`text-2xl sm:text-3xl font-bold font-sans tracking-tight leading-none ${
                      dayGroup.isToday ? 'text-[#a25832]' : 'text-[#3e332a]'
                    }`}
                  >
                    {dayGroup.dayNumber}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#3e332a]">
                        {dayGroup.dayOfWeek}
                      </span>
                      {dayGroup.isToday && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#a25832] text-white font-semibold">
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#7a6a58] capitalize">
                      {dayGroup.monthYearString}
                    </span>
                  </div>
                </div>

                {/* Góc phải: Tổng số tiền thu / chi riêng của ngày đó */}
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

              {/* Danh sách giao dịch trong ngày */}
              <div className="divide-y divide-[#f7ede2]">
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
                          </div>

                          {/* Note / Description */}
                          <p className="text-xs text-[#524438] mt-0.5 break-words line-clamp-2">
                            {tx.note || (isTransfer ? 'Chuyển khoản' : 'Không có ghi chú')}
                          </p>

                          {/* Split info badge */}
                          {tx.splitInfo && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-[#3d7a5a] bg-[#3d7a5a]/10 px-2 py-0.5 rounded-md self-start">
                              <Users className="w-3 h-3" />
                              <span>{tx.splitInfo.details}</span>
                            </div>
                          )}

                          {/* Wallet & Time info */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#8c7b69] mt-1">
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

                      {/* Right: Amount & Actions */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
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

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          {onDuplicateTransaction && (
                            <button
                              onClick={() => onDuplicateTransaction(tx)}
                              className="p-1.5 rounded-md hover:bg-[#e8ded1] text-[#7a6a58] hover:text-[#3e332a] transition"
                              title="Nhân bản giao dịch này"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1.5 rounded-md hover:bg-[#e8ded1] text-[#7a6a58] hover:text-[#3e332a] transition"
                            title="Sửa giao dịch"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-1.5 rounded-md hover:bg-[#fee2e2] text-[#a89886] hover:text-[#b94a3b] transition"
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
    </section>
  );
};
