import { Ledger, Wallet, Category, Transaction } from '../types';


// Không có dữ liệu mẫu ban đầu: Người dùng tự tạo hoặc đồng bộ từ Cloud
export const DEFAULT_LEDGERS: Ledger[] = [];

export const DEFAULT_WALLETS: Wallet[] = [];

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-eat',
    name: 'Ăn',
    type: 'expense',
    icon: 'UtensilsCrossed',
    color: '#d97706',
    isDefault: true,
  },
  {
    id: 'cat-drink',
    name: 'Uống',
    type: 'expense',
    icon: 'Coffee',
    color: '#92400e',
    isDefault: true,
  },
  {
    id: 'cat-shopping',
    name: 'Mua sắm',
    type: 'expense',
    icon: 'ShoppingBag',
    color: '#db2777',
    isDefault: true,
  },
  {
    id: 'cat-haircut',
    name: 'Cắt tóc',
    type: 'expense',
    icon: 'Scissors',
    color: '#0284c7',
    isDefault: true,
  },
  {
    id: 'cat-electronics',
    name: 'Đồ điện tử',
    type: 'expense',
    icon: 'Laptop',
    color: '#4f46e5',
    isDefault: true,
  },
  {
    id: 'cat-furniture',
    name: 'Đồ gia dụng',
    type: 'expense',
    icon: 'Armchair',
    color: '#059669',
    isDefault: true,
  },
  {
    id: 'cat-gas',
    name: 'Xăng xe',
    type: 'expense',
    icon: 'Fuel',
    color: '#ea580c',
    isDefault: true,
  },
  {
    id: 'cat-bills',
    name: 'Hóa đơn',
    type: 'expense',
    icon: 'Receipt',
    color: '#4b5563',
    isDefault: true,
  },
  {
    id: 'cat-salary',
    name: 'Tiền lương',
    type: 'income',
    icon: 'Briefcase',
    color: '#16a34a',
    isDefault: true,
  },
  {
    id: 'cat-bonus',
    name: 'Tiền thưởng / Phụ cấp',
    type: 'income',
    icon: 'Gift',
    color: '#ca8a04',
    isDefault: true,
  },
  {
    id: 'cat-other-expense',
    name: 'Chi tiêu khác',
    type: 'expense',
    icon: 'CircleEllipsis',
    color: '#6b7280',
    isDefault: true,
  },
];

// Danh sách giao dịch ban đầu hoàn toàn trống - không có dữ liệu mẫu
export const DEFAULT_TRANSACTIONS: Transaction[] = [];
