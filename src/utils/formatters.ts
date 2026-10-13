import { TimeFilter } from '../types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumberOnly = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN').format(amount);
};

/**
 * Chuyển đổi bất kỳ chuỗi ISO / Date nào sang chuỗi ngày cục bộ 'YYYY-MM-DD'
 * (Tránh lỗi lệch múi giờ UTC+7 khi dùng .toISOString().slice(0, 10))
 */
export const toLocalDateKey = (input?: string | Date | null): string => {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = input ? new Date(input) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  const yyyy = safe.getFullYear();
  const mm = String(safe.getMonth() + 1).padStart(2, '0');
  const dd = String(safe.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Chuyển đổi bất kỳ chuỗi ISO / Date nào sang chuỗi tháng cục bộ 'YYYY-MM'
 */
export const toLocalMonthKey = (input?: string | Date | null): string => {
  if (typeof input === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(input.trim())) {
    return input.trim().slice(0, 7);
  }
  const d = input ? new Date(input) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  const yyyy = safe.getFullYear();
  const mm = String(safe.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

/**
 * Chuyển đổi bất kỳ chuỗi ISO / Date nào sang định dạng 'YYYY-MM-DDTHH:mm' theo múi giờ cục bộ
 * dành cho thẻ <input type="datetime-local"> (Tránh lỗi lệch 7 tiếng khi bấm Chỉnh sửa)
 */
export const toLocalDateTimeInput = (input?: string | Date | null): string => {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      return `${trimmed}T${hh}:${min}`;
    }
  }
  const d = input ? new Date(input) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  const yyyy = safe.getFullYear();
  const mm = String(safe.getMonth() + 1).padStart(2, '0');
  const dd = String(safe.getDate()).padStart(2, '0');
  const hh = String(safe.getHours()).padStart(2, '0');
  const min = String(safe.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

/**
 * Phân tích chuỗi 'YYYY-MM-DD' thành đối tượng Date theo giờ địa phương (12:00 trưa)
 */
export const parseLocalDateKey = (dateKey: string): Date => {
  if (typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())) {
    const [y, m, d] = dateKey.trim().split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parsed = new Date(dateKey);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const formatDateDisplay = (dateString: string): string => {
  try {
    const date = parseLocalDateKey(dateString);
    if (isNaN(date.getTime())) return dateString;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateString;
  }
};

export const formatDateTimeDisplay = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${hh}:${min} ${dd}/${mm}/${yyyy}`;
  } catch {
    return dateString;
  }
};

export const isWithinTimeFilter = (dateString: string, filter: TimeFilter): boolean => {
  if (filter === 'all') return true;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;

  const now = new Date();
  
  if (filter === 'week') {
    // Current week (Monday to Sunday)
    const currentDay = now.getDay(); // 0 is Sunday
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return date >= monday && date <= sunday;
  }

  if (filter === 'month') {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  if (filter === 'year') {
    return date.getFullYear() === now.getFullYear();
  }

  return true;
};
