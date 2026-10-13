export type SmartDateFilterType =
  | 'all'
  | 'specific_date'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'this_year'
  | 'last_year'
  | 'custom_range';

export interface SmartDateFilterState {
  type: SmartDateFilterType;
  specificDate?: string; // YYYY-MM-DD
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;      // YYYY-MM-DD
}

export const SMART_DATE_FILTER_OPTIONS: Array<{
  value: SmartDateFilterType;
  label: string;
  group?: string;
}> = [
  { value: 'all', label: 'Tất cả thời gian' },
  { value: 'specific_date', label: '📅 Ngày cụ thể...' },
  { value: 'this_week', label: 'Tuần này' },
  { value: 'last_week', label: 'Tuần trước' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'q1', label: 'Quý 1 (Tháng 1 - 3)' },
  { value: 'q2', label: 'Quý 2 (Tháng 4 - 6)' },
  { value: 'q3', label: 'Quý 3 (Tháng 7 - 9)' },
  { value: 'q4', label: 'Quý 4 (Tháng 10 - 12)' },
  { value: 'this_year', label: 'Năm nay' },
  { value: 'last_year', label: 'Năm trước' },
  { value: 'custom_range', label: '🗓️ Tùy chỉnh (Từ ngày... Đến ngày...)' },
];

/**
 * Kiểm tra xem ngày của giao dịch có nằm trong khoảng lọc thông minh không
 */
export function isTransactionWithinSmartFilter(
  txDateString: string,
  filter: SmartDateFilterState,
  referenceDate: Date = new Date()
): boolean {
  if (!filter || filter.type === 'all') return true;
  if (!txDateString) return false;

  const txDate = new Date(txDateString);
  if (isNaN(txDate.getTime())) return false;

  const now = referenceDate;
  const currentYear = now.getFullYear();
  const txDateOnly = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`;

  switch (filter.type) {
    case 'specific_date': {
      if (!filter.specificDate) return true;
      return txDateOnly === filter.specificDate;
    }

    case 'this_week': {
      // Thứ 2 đến Chủ nhật của tuần này
      const currentDay = now.getDay(); // 0 là Chủ nhật, 1 là Thứ 2
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      return txDate >= monday && txDate <= sunday;
    }

    case 'last_week': {
      // Thứ 2 đến Chủ nhật của tuần trước
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() + diffToMonday - 7);
      lastMonday.setHours(0, 0, 0, 0);

      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      lastSunday.setHours(23, 59, 59, 999);

      return txDate >= lastMonday && txDate <= lastSunday;
    }

    case 'this_month': {
      return (
        txDate.getFullYear() === currentYear &&
        txDate.getMonth() === now.getMonth()
      );
    }

    case 'last_month': {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return (
        txDate.getFullYear() === prevMonthDate.getFullYear() &&
        txDate.getMonth() === prevMonthDate.getMonth()
      );
    }

    case 'q1': {
      return txDate.getFullYear() === currentYear && txDate.getMonth() >= 0 && txDate.getMonth() <= 2;
    }

    case 'q2': {
      return txDate.getFullYear() === currentYear && txDate.getMonth() >= 3 && txDate.getMonth() <= 5;
    }

    case 'q3': {
      return txDate.getFullYear() === currentYear && txDate.getMonth() >= 6 && txDate.getMonth() <= 8;
    }

    case 'q4': {
      return txDate.getFullYear() === currentYear && txDate.getMonth() >= 9 && txDate.getMonth() <= 11;
    }

    case 'this_year': {
      return txDate.getFullYear() === currentYear;
    }

    case 'last_year': {
      return txDate.getFullYear() === currentYear - 1;
    }

    case 'custom_range': {
      if (filter.startDate) {
        const start = new Date(filter.startDate + 'T00:00:00');
        if (txDate < start) return false;
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate + 'T23:59:59.999');
        if (txDate > end) return false;
      }
      return true;
    }

    default:
      return true;
  }
}
