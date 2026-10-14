export type TransactionType = 'expense' | 'income' | 'transfer';

export type TimeFilter = 'week' | 'month' | 'year' | 'all';

export interface Ledger {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isDefault?: boolean;
  order?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Wallet {
  id: string;
  name: string;
  initialBalance: number;
  icon: string;
  color: string;
  accountNumber?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income' | 'both';
  icon: string;
  color: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  date: string; // ISO string YYYY-MM-DD or YYYY-MM-DDTHH:mm
  categoryId: string;
  note: string;
  ledgerId: string;
  walletId: string;
  toWalletId?: string | null; // for transfer type
  receiptImage?: string | null;
  splitInfo?: {
    totalRoomExpense: number;
    roommateCount: number;
    perPersonAmount: number;
    details: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface RoomSplitData {
  roomRent: number;
  electricOld: number;
  electricNew: number;
  electricUnitPrice: number;
  waterOld: number;
  waterNew: number;
  waterUnitPrice: number;
  internetFee: number;
  garbageFee: number;
  roommatesCount: number;
  roommateNames: string[];
  note: string;
}
