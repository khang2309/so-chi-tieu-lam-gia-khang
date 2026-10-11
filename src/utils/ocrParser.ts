export interface ParsedReceiptData {
  rawText: string;
  amount: number | null;
  date: string | null; // ISO YYYY-MM-DD
  matchedAmounts: number[];
  suggestedNote: string;
}

/**
 * Trích xuất ngày tháng và tổng số tiền từ chuỗi văn bản OCR hóa đơn tiếng Việt
 */
export function parseVietnameseReceipt(rawText: string): ParsedReceiptData {
  const text = rawText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Tìm kiếm ngày tháng (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy)
  let foundDate: string | null = null;
  const dateRegex = /(?:ngày\s+)?\b([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/i;
  
  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      let day = parseInt(match[1], 10);
      let month = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);
      if (year < 100) year += 2000;

      // Đảm bảo tính hợp lệ của ngày tháng
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const paddedMonth = month.toString().padStart(2, '0');
        const paddedDay = day.toString().padStart(2, '0');
        foundDate = `${year}-${paddedMonth}-${paddedDay}`;
        break;
      }
    }
  }

  // 2. Tìm kiếm và chuẩn hóa số tiền
  const candidateAmounts: number[] = [];

  // Mẫu nhận diện từ khóa ưu tiên (tổng cộng, thanh toán, thành tiền, total...)
  const priorityKeywordRegex = /(?:tổng\s*cộng|thanh\s*toán|tổng\s*tiền|thành\s*tiền|tổng|total|tiền\s*mặt)/i;
  let priorityAmount: number | null = null;

  for (const line of lines) {
    const isPriorityLine = priorityKeywordRegex.test(line);

    // a. Xử lý đuôi 'tr' hoặc 'triệu' (VD: 1.5tr, 2 triệu)
    const millionMatch = line.match(/(\d+(?:[\.,]\d+)?)\s*(?:tr|triệu)\b/i);
    if (millionMatch) {
      const val = parseFloat(millionMatch[1].replace(',', '.'));
      if (!isNaN(val)) {
        const amt = Math.round(val * 1000000);
        candidateAmounts.push(amt);
        if (isPriorityLine && !priorityAmount) priorityAmount = amt;
      }
    }

    // b. Xử lý đuôi 'k', 'nghìn', 'ngàn' (VD: 50k, 120 nghìn)
    const thousandMatch = line.match(/(\d+(?:[\.,]\d+)?)\s*(?:k|nghìn|ngàn)\b/i);
    if (thousandMatch) {
      const val = parseFloat(thousandMatch[1].replace(',', '.'));
      if (!isNaN(val)) {
        const amt = Math.round(val * 1000);
        candidateAmounts.push(amt);
        if (isPriorityLine && !priorityAmount) priorityAmount = amt;
      }
    }

    // c. Xử lý số tiền dạng 100.000 hoặc 100,000 hoặc 1 500 000 (có thể kèm đ, VNĐ, VND)
    // Tách các cụm số có phân cách hàng nghìn
    const currencyMatches = line.matchAll(/\b(\d{1,3}(?:[\.,\s]\d{3})+(?:[\.,]\d{1,2})?|\d{4,9})\s*(?:vnđ|vnd|đ|d)?\b/gi);
    for (const match of currencyMatches) {
      let rawNumStr = match[1];
      // Loại bỏ khoảng trắng và dấu đính kèm
      rawNumStr = rawNumStr.replace(/\s+/g, '');
      
      // Chuẩn hóa định dạng Việt Nam: 100.000 hoặc 100,000
      let cleanNum = 0;
      if (rawNumStr.includes('.') && !rawNumStr.includes(',')) {
        cleanNum = parseInt(rawNumStr.replace(/\./g, ''), 10);
      } else if (rawNumStr.includes(',') && !rawNumStr.includes('.')) {
        cleanNum = parseInt(rawNumStr.replace(/,/g, ''), 10);
      } else if (rawNumStr.includes('.') && rawNumStr.includes(',')) {
        // Có cả 2 (ví dụ: 100.000,00 hoặc 100,000.00)
        cleanNum = parseInt(rawNumStr.replace(/[\.,]/g, '').slice(0, -2), 10);
      } else {
        cleanNum = parseInt(rawNumStr, 10);
      }

      // Lọc các số không phải tiền (năm hiện tại 2024..2027, mã số thuế, sđt dài)
      if (cleanNum >= 1000 && cleanNum < 1000000000) {
        if (cleanNum !== 2024 && cleanNum !== 2025 && cleanNum !== 2026 && cleanNum !== 2027) {
          candidateAmounts.push(cleanNum);
          if (isPriorityLine && !priorityAmount) priorityAmount = cleanNum;
        }
      }
    }
  }

  // Lọc trùng
  const uniqueAmounts = Array.from(new Set(candidateAmounts));

  // Chọn số tiền lớn nhất hoặc số tiền ở dòng có chữ 'tổng cộng'
  const finalAmount = priorityAmount || (uniqueAmounts.length > 0 ? Math.max(...uniqueAmounts) : null);

  // 3. Gợi ý tên quán / ghi chú
  let suggestedNote = 'Chi tiêu hóa đơn';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('petrolimex') || lowerText.includes('xăng')) {
    suggestedNote = 'Đổ xăng (Yamaha Janus)';
  } else if (lowerText.includes('highlands') || lowerText.includes('coffee') || lowerText.includes('cà phê')) {
    suggestedNote = 'Cà phê Highlands';
  } else if (lowerText.includes('bách hóa xanh') || lowerText.includes('siêu thị')) {
    suggestedNote = 'Mua thực phẩm Bách Hóa Xanh';
  } else if (lowerText.includes('30shine') || lowerText.includes('barber') || lowerText.includes('cắt tóc')) {
    suggestedNote = 'Cắt tóc';
  } else if (lines.length > 0) {
    // Lấy dòng đầu tiên khả dĩ làm tên cửa hàng
    const firstLine = lines.find((l) => l.length > 3 && l.length < 35 && !/hóa\s*đơn/i.test(l));
    if (firstLine) suggestedNote = firstLine;
  }

  return {
    rawText: text,
    amount: finalAmount,
    date: foundDate,
    matchedAmounts: uniqueAmounts,
    suggestedNote,
  };
}
