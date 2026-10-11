import * as XLSX from 'xlsx';
import { Transaction, Category, Ledger, Wallet } from '../types';

/**
 * Xuất danh sách giao dịch ra file Excel (.xlsx)
 * Bao gồm các cột chuẩn: STT, Ngày, Tên giao dịch, Loại, Danh mục, Số tiền, Ghi chú, Sổ, Ví
 */
export function exportTransactionsToExcel(
  transactions: Transaction[],
  categories: Category[],
  ledgers: Ledger[],
  wallets: Wallet[],
  filename = 'Danh_Sach_Chi_Tieu.xlsx'
): void {
  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name || 'Khác';
  const getLedgerName = (id: string) => ledgers.find((l) => l.id === id)?.name || 'Mặc định';
  const getWalletName = (id: string) => wallets.find((w) => w.id === id)?.name || 'Tiền mặt';

  const rows = transactions.map((tx, idx) => {
    const typeLabel =
      tx.type === 'expense' ? 'Chi tiêu' : tx.type === 'income' ? 'Thu nhập' : 'Chuyển khoản';

    // Format ngày giờ đẹp
    let dateStr = tx.date;
    try {
      const d = new Date(tx.date);
      dateStr = d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      // fallback
    }

    return {
      'STT': idx + 1,
      'Ngày': dateStr,
      'Tên giao dịch': tx.note || 'Khoản chi tiêu',
      'Loại': typeLabel,
      'Danh mục': getCatName(tx.categoryId),
      'Số tiền': tx.amount,
      'Ghi chú': tx.note || '',
      'Sổ': getLedgerName(tx.ledgerId),
      'Ví': getWalletName(tx.walletId),
    };
  });

  // Tạo Sheet từ JSON
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Căn chỉnh độ rộng cột cho đẹp
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 20 }, // Ngày
    { wch: 28 }, // Tên giao dịch
    { wch: 14 }, // Loại
    { wch: 20 }, // Danh mục
    { wch: 16 }, // Số tiền
    { wch: 25 }, // Ghi chú
    { wch: 20 }, // Sổ
    { wch: 18 }, // Ví
  ];

  // Tạo Workbook và xuất file
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Giao Dịch');

  XLSX.writeFile(workbook, filename);
}
