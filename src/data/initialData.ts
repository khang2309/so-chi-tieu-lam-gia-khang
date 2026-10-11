import { Ledger, Wallet, Category, Transaction } from '../types';

export const DEFAULT_LEDGERS: Ledger[] = [
  {
    id: 'ledger-personal',
    name: 'Chi tiêu cá nhân',
    description: 'Chi tiêu sinh hoạt, ăn uống và cá nhân hằng ngày',
    icon: 'User',
    color: '#a25832', // Da bò ấm
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ledger-room',
    name: 'Tiền trọ',
    description: 'Tiền phòng, điện, nước, mạng chia 3 người',
    icon: 'Home',
    color: '#3d7a5a', // Xanh lá ấm
    isDefault: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ledger-hometown',
    name: 'Chi tiêu ở quê',
    description: 'Biếu bố mẹ, mua sắm đồ dùng gia đình ở quê',
    icon: 'Trees',
    color: '#3b6e8c', // Xanh xám nhạt
    isDefault: false,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_WALLETS: Wallet[] = [
  {
    id: 'wallet-cash',
    name: 'Tiền mặt',
    initialBalance: 0,
    icon: 'Banknote',
    color: '#2e7d32',
    accountNumber: 'Ví tiền mặt',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wallet-mbbank',
    name: 'MB Bank',
    initialBalance: 0,
    icon: 'Building2',
    color: '#1565c0',
    accountNumber: 'MB Bank',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wallet-timo',
    name: 'Timo',
    initialBalance: 0,
    icon: 'CreditCard',
    color: '#7b1fa2',
    accountNumber: 'Timo Digital Bank',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wallet-bidv',
    name: 'BIDV',
    initialBalance: 0,
    icon: 'Landmark',
    color: '#00897b',
    accountNumber: 'BIDV',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wallet-sacombank',
    name: 'Sacombank',
    initialBalance: 0,
    icon: 'Landmark',
    color: '#c62828',
    accountNumber: 'Sacombank',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wallet-momo',
    name: 'MoMo',
    initialBalance: 0,
    icon: 'Smartphone',
    color: '#ad1457',
    accountNumber: 'Ví điện tử MoMo',
    createdAt: new Date().toISOString(),
  },
];

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
