export interface ExtractedBatchItem {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  note: string;
  categoryId: string;
  rawLine: string;
}

export interface BatchParsedResult {
  rawText: string;
  items: ExtractedBatchItem[];
  totalAmount: number;
}

// Bộ từ điển phân loại chi tiêu tự động (Keyword Mapping)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'cat-eat': [
    'cơm', 'phở', 'bún', 'ăn', 'thịt', 'rau', 'bánh', 'trưa', 'sáng',
    'tối', 'mì', 'cháo', 'lẩu', 'hủ tiếu', 'cơm tấm', 'bánh mì', 'trứng',
    'hải sản', 'gà', 'vịt', 'bò', 'canh', 'quán ăn', 'nhà hàng'
  ],
  'cat-drink': [
    'nước', 'cafe', 'cà phê', 'trà sữa', 'bia', 'sinh tố', 'sting',
    'nước ngọt', 'matcha', 'highlands', 'phúc long', 'coca', 'pepsi',
    'trà', 'nước suối', 'lavie', 'aquafina', 'sữa tươi', 'uống'
  ],
  'cat-gas': [
    'xăng', 'nhớt', 'xe', 'vá', 'janus', 'yamaha', 'rửa xe', 'petrolimex',
    'thay nhớt', 'ruột xe', 'bơm xe', 'gửi xe', 'bảo dưỡng', 'xăng xe', 'sửa xe'
  ],
  'cat-bills': [
    'điện', 'nước', 'wifi', 'mạng', 'trọ', 'phòng', 'rác', 'vệ sinh',
    'tiền nhà', 'hóa đơn', 'internet', 'truyền hình', 'phí quản lý'
  ],
  'cat-shopping': [
    'áo', 'quần', 'shopee', 'lazada', 'tiki', 'mua', 'giày', 'dép',
    'váy', 'túi', 'sắm', 'siêu thị', 'quần áo', 'mỹ phẩm', 'đầm', 'nón'
  ],
  'cat-haircut': [
    'cắt tóc', 'gội đầu', 'barber', '30shine', 'cắt', 'uốn tóc', 'nhuộm', 'tóc'
  ],
  'cat-electronics': [
    'điện thoại', 'laptop', 'tai nghe', 'sạc', 'chuột', 'bàn phím',
    'cáp', 'điện tử', 'pin', 'máy tính', 'cục sạc', 'ốp lưng', 'màn hình'
  ],
  'cat-furniture': [
    'gia dụng', 'chảo', 'nồi', 'quạt', 'bếp', 'khăn', 'xô', 'chổi',
    'móc áo', 'ly', 'chén', 'đũa', 'nệm', 'gối', 'màn', 'chiếu'
  ],
  'cat-salary': [
    'lương', 'thưởng', 'thu nhập', 'lương tháng', 'hoa hồng', 'tiền lương'
  ],
};

/**
 * Tự động đoán danh mục dựa trên văn bản dòng
 */
export function predictCategory(text: string): string {
  const normalized = text.toLowerCase();

  // Kiểm tra từng danh mục theo từ khóa
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      // Tìm từ khóa nguyên từ hoặc có khoảng cách
      if (normalized.includes(kw)) {
        return catId;
      }
    }
  }

  return 'cat-other-expense'; // Mặc định: Chi tiêu khác
}

/**
 * Hàm phân tích số tiền và làm sạch ghi chú trên một dòng
 */
function extractAmountAndCleanNote(line: string): { amount: number; note: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let detectedAmount: number | null = null;
  let matchedSubstr = '';

  // 1. Kiểm tra hậu tố 'tr' hoặc 'triệu' (VD: 1.5tr, 2 triệu)
  const millionMatch = trimmed.match(/(\d+(?:[\.,]\d+)?)\s*(?:tr|triệu)\b/i);
  if (millionMatch) {
    const val = parseFloat(millionMatch[1].replace(',', '.'));
    if (!isNaN(val)) {
      detectedAmount = Math.round(val * 1000000);
      matchedSubstr = millionMatch[0];
    }
  }

  // 2. Kiểm tra hậu tố 'k', 'nghìn', 'ngàn' (VD: 50k, 120 nghìn)
  if (detectedAmount === null) {
    const thousandMatch = trimmed.match(/(\d+(?:[\.,]\d+)?)\s*(?:k|nghìn|ngàn)\b/i);
    if (thousandMatch) {
      const val = parseFloat(thousandMatch[1].replace(',', '.'));
      if (!isNaN(val)) {
        detectedAmount = Math.round(val * 1000);
        matchedSubstr = thousandMatch[0];
      }
    }
  }

  // 3. Kiểm tra số có phân cách hàng nghìn (100.000, 100,000, 35000đ, 70000 VND)
  if (detectedAmount === null) {
    const currencyMatch = trimmed.match(/\b(\d{1,3}(?:[\.,\s]\d{3})+(?:[\.,]\d{1,2})?|\d{4,9})\s*(?:vnđ|vnd|đ|d)?\b/i);
    if (currencyMatch) {
      let rawNum = currencyMatch[1].replace(/\s+/g, '');
      let cleanNum = 0;
      if (rawNum.includes('.') && !rawNum.includes(',')) {
        cleanNum = parseInt(rawNum.replace(/\./g, ''), 10);
      } else if (rawNum.includes(',') && !rawNum.includes('.')) {
        cleanNum = parseInt(rawNum.replace(/,/g, ''), 10);
      } else if (rawNum.includes('.') && rawNum.includes(',')) {
        cleanNum = parseInt(rawNum.replace(/[\.,]/g, '').slice(0, -2), 10);
      } else {
        cleanNum = parseInt(rawNum, 10);
      }

      // Loại bỏ số giống năm hiện tại (2024..2027)
      if (cleanNum >= 1000 && cleanNum < 1000000000 && cleanNum !== 2024 && cleanNum !== 2025 && cleanNum !== 2026 && cleanNum !== 2027) {
        detectedAmount = cleanNum;
        matchedSubstr = currencyMatch[0];
      }
    }
  }

  if (detectedAmount === null || detectedAmount <= 0) {
    return null;
  }

  // Làm sạch phần ghi chú (loại bỏ phần số tiền và từ nối)
  let cleanNote = trimmed;
  if (matchedSubstr) {
    cleanNote = cleanNote.replace(matchedSubstr, '');
  }
  // Loại bỏ các ký tự dấu thừa ở đầu/cuối: ':', '-', '+', '=', ',', '.'
  cleanNote = cleanNote.replace(/^[\s:\-–—+=,.]+/, '').replace(/[\s:\-–—+=,.]+$/, '').trim();

  // Nếu note sau khi xóa tiền bị trống (ví dụ dòng chỉ ghi mỗi "50k"), đặt ghi chú chung
  if (!cleanNote) {
    cleanNote = 'Khoản chi tiêu ' + detectedAmount.toLocaleString('vi-VN') + ' đ';
  } else {
    // Viết hoa chữ cái đầu
    cleanNote = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
  }

  return {
    amount: detectedAmount,
    note: cleanNote,
  };
}

/**
 * Kiểm tra xem dòng có chứa thông tin Ngày tháng hay không và trích xuất ngày YYYY-MM-DD
 */
function extractDateFromLine(line: string, currentYear: number): { date: string; remainingLine: string } | null {
  // Định dạng ngày đầy đủ: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  const fullDateRegex = /(?:ngày\s+)?\b([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/i;
  const fullMatch = line.match(fullDateRegex);
  if (fullMatch) {
    let day = parseInt(fullMatch[1], 10);
    let month = parseInt(fullMatch[2], 10);
    let year = parseInt(fullMatch[3], 10);
    if (year < 100) year += 2000;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const paddedMonth = month.toString().padStart(2, '0');
      const paddedDay = day.toString().padStart(2, '0');
      const remaining = line.replace(fullMatch[0], '').trim();
      return {
        date: `${year}-${paddedMonth}-${paddedDay}`,
        remainingLine: remaining,
      };
    }
  }

  // Định dạng ngày ngắn: dd/mm, dd-mm (ví dụ: 12/10, 05-09)
  const shortDateRegex = /(?:ngày\s+)?\b([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])\b/i;
  const shortMatch = line.match(shortDateRegex);
  if (shortMatch) {
    let day = parseInt(shortMatch[1], 10);
    let month = parseInt(shortMatch[2], 10);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const paddedMonth = month.toString().padStart(2, '0');
      const paddedDay = day.toString().padStart(2, '0');
      const remaining = line.replace(shortMatch[0], '').trim();
      return {
        date: `${currentYear}-${paddedMonth}-${paddedDay}`,
        remainingLine: remaining,
      };
    }
  }

  return null;
}

/**
 * NÂNG CẤP: Quét từng dòng (Line-by-line) & Tự động tách nhiều giao dịch (Smart Batch Extraction)
 */
export function parseBatchVietnameseReceipt(rawText: string): BatchParsedResult {
  const text = rawText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const today = new Date();
  const currentYear = today.getFullYear();
  let currentDate = today.toISOString().slice(0, 10); // YYYY-MM-DD

  const items: ExtractedBatchItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 1. Kiểm tra xem dòng có chứa Ngày tháng không
    const dateExtraction = extractDateFromLine(line, currentYear);
    if (dateExtraction) {
      currentDate = dateExtraction.date;
      line = dateExtraction.remainingLine; // Phần còn lại của dòng (nếu có tiền cùng dòng)
    }

    // Nếu dòng chỉ chứa ngày tháng (không còn chữ gì nữa), chuyển sang dòng tiếp theo
    if (!line || line.length < 2) {
      continue;
    }

    // 2. Kiểm tra xem dòng có chứa Số tiền không
    const amountExtraction = extractAmountAndCleanNote(line);
    if (amountExtraction) {
      const { amount, note } = amountExtraction;
      // Dự đoán danh mục dựa trên nội dung dòng gốc
      const predictedCatId = predictCategory(lines[i]);

      items.push({
        id: 'batch-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substr(2, 3),
        date: currentDate,
        amount,
        note,
        categoryId: predictedCatId,
        rawLine: lines[i],
      });
    }
  }

  const totalAmount = items.reduce((acc, it) => acc + it.amount, 0);

  return {
    rawText: text,
    items,
    totalAmount,
  };
}
