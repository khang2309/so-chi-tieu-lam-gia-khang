export type InvoiceType = 'TYPE_A_TABLE' | 'TYPE_B_TRANSFER' | 'TYPE_C_FREE_TEXT';

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
  invoiceType: InvoiceType;
  invoiceTypeName: string;
  items: ExtractedBatchItem[];
  totalAmount: number;
}

// Bộ từ điển phân loại chi tiêu tự động (Keyword Mapping)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'cat-eat': [
    'cơm', 'phở', 'bún', 'ăn', 'thịt', 'rau', 'bánh', 'trưa', 'sáng',
    'tối', 'mì', 'cháo', 'lẩu', 'hủ tiếu', 'cơm tấm', 'bánh mì', 'trứng',
    'hải sản', 'gà', 'vịt', 'bò', 'canh', 'quán ăn', 'nhà hàng', 'thực phẩm',
    'cá', 'tôm', 'mực', 'thức ăn', 'chả'
  ],
  'cat-drink': [
    'nước', 'cafe', 'cà phê', 'trà sữa', 'bia', 'sinh tố', 'sting',
    'nước ngọt', 'matcha', 'highlands', 'phúc long', 'coca', 'pepsi',
    'trà', 'nước suối', 'lavie', 'aquafina', 'sữa tươi', 'uống', 'sữa'
  ],
  'cat-gas': [
    'xăng', 'nhớt', 'xe', 'vá', 'janus', 'yamaha', 'rửa xe', 'petrolimex',
    'thay nhớt', 'ruột xe', 'bơm xe', 'gửi xe', 'bảo dưỡng', 'xăng xe', 'sửa xe',
    'ron 95', 'ron 92', 'e5'
  ],
  'cat-bills': [
    'điện', 'nước', 'wifi', 'mạng', 'trọ', 'phòng', 'rác', 'vệ sinh',
    'tiền nhà', 'hóa đơn', 'internet', 'truyền hình', 'phí quản lý',
    'tiền trọ', 'phòng trọ', 'kwh', 'khối nước'
  ],
  'cat-shopping': [
    'áo', 'quần', 'shopee', 'lazada', 'tiki', 'mua', 'giày', 'dép',
    'váy', 'túi', 'sắm', 'siêu thị', 'quần áo', 'mỹ phẩm', 'đầm', 'nón',
    'balo', 'thời trang'
  ],
  'cat-haircut': [
    'cắt tóc', 'gội đầu', 'barber', '30shine', 'cắt', 'uốn tóc', 'nhuộm', 'tóc'
  ],
  'cat-electronics': [
    'điện thoại', 'laptop', 'tai nghe', 'sạc', 'chuột', 'bàn phím',
    'cáp', 'điện tử', 'pin', 'máy tính', 'cục sạc', 'ốp lưng', 'màn hình',
    'type-c', 'usb', 'phụ kiện'
  ],
  'cat-furniture': [
    'gia dụng', 'chảo', 'nồi', 'quạt', 'bếp', 'khăn', 'xô', 'chổi',
    'móc áo', 'ly', 'chén', 'đũa', 'nệm', 'gối', 'màn', 'chiếu'
  ],
  'cat-salary': [
    'lương', 'thưởng', 'thu nhập', 'lương tháng', 'hoa hồng', 'tiền lương',
    'nhận lương', 'phụ cấp'
  ],
};

/**
 * Tự động phân loại danh mục dựa trên văn bản
 */
export function predictCategory(text: string): string {
  const normalized = text.toLowerCase();
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        return catId;
      }
    }
  }
  return 'cat-other-expense'; // Mặc định: Chi tiêu khác
}

// =========================================================================
// 1. CƠ CHẾ PHÂN LOẠI HÓA ĐƠN (PRE-CLASSIFICATION)
// =========================================================================
export function classifyInvoice(rawText: string): InvoiceType {
  const text = (rawText || '').toLowerCase();

  // Kiểm tra Loại B: Biên lai chuyển khoản ngân hàng
  const transferKeywords = [
    'chuyển khoản thành công', 'giao dịch thành công', 'chuyển tiền thành công',
    'tài khoản nhận', 'nội dung giao dịch', 'người thụ hưởng', 'mã giao dịch',
    'nội dung chuyển khoản', 'lời nhắn', 'tài khoản thụ hưởng', 'tài khoản nguồn',
    'ngân hàng nhận', 'số tham chiếu', 'ft2', 'vcb', 'mbbank', 'timo'
  ];
  let transferScore = 0;
  for (const kw of transferKeywords) {
    if (text.includes(kw)) transferScore++;
  }
  if (transferScore >= 2 || text.includes('chuyển khoản thành công') || text.includes('giao dịch thành công')) {
    return 'TYPE_B_TRANSFER';
  }

  // Kiểm tra Loại A: Hóa đơn in nhiệt / Siêu thị có bảng
  const tableKeywords = [
    'hóa đơn', 'phiếu thanh toán', 'số phiếu', 'mặt hàng', 'tên hàng',
    'đơn giá', 'thành tiền', 'sl', 'đvt', 'cảm ơn', 'vat', 'thu ngân',
    'tổng cộng', 'cộng tiền hàng', 'bàn số', 'hóa đơn bán lẻ', 'khách đưa'
  ];
  let tableScore = 0;
  for (const kw of tableKeywords) {
    if (text.includes(kw)) tableScore++;
  }
  if (tableScore >= 2) {
    return 'TYPE_A_TABLE';
  }

  // Loại C: Ghi chép tự do / ghi tay
  return 'TYPE_C_FREE_TEXT';
}

// =========================================================================
// HELPER: TRÍCH XUẤT NGÀY THÁNG TIẾNG VIỆT
// =========================================================================
function extractDateFromText(text: string, defaultDate: string): string {
  // Tìm cụm Ngày: hoặc Date: gần đầu văn bản trước
  const labeledDateRegex = /(?:ngày|date|thời\s*gian|ngay)[\s:\.]*([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/i;
  const labeledMatch = text.match(labeledDateRegex);
  if (labeledMatch) {
    let day = parseInt(labeledMatch[1], 10);
    let month = parseInt(labeledMatch[2], 10);
    let year = parseInt(labeledMatch[3], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  // Regex mở rộng \b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b
  const generalDateRegex = /\b([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/;
  const generalMatch = text.match(generalDateRegex);
  if (generalMatch) {
    let day = parseInt(generalMatch[1], 10);
    let month = parseInt(generalMatch[2], 10);
    let year = parseInt(generalMatch[3], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  return defaultDate;
}

// =========================================================================
// HELPER: CHUẨN HÓA SỐ TIỀN TIẾNG VIỆT
// =========================================================================
function parseMoneyNumber(rawStr: string): number | null {
  if (!rawStr) return null;
  let str = rawStr.trim();

  // 1. Kiểm tra 'tr' hoặc 'triệu'
  const trMatch = str.match(/(\d+(?:[\.,]\d+)?)\s*(?:tr|triệu)\b/i);
  if (trMatch) {
    const v = parseFloat(trMatch[1].replace(',', '.'));
    if (!isNaN(v)) return Math.round(v * 1000000);
  }

  // 2. Kiểm tra 'k', 'nghìn', 'ngàn'
  const kMatch = str.match(/(\d+(?:[\.,]\d+)?)\s*(?:k|nghìn|ngàn)\b/i);
  if (kMatch) {
    const v = parseFloat(kMatch[1].replace(',', '.'));
    if (!isNaN(v)) return Math.round(v * 1000);
  }

  // 3. Chuẩn hóa số nguyên có dấu chấm/phẩy phân cách: 100.000 hoặc 100,000
  let cleanStr = str.replace(/[^\d\.,]/g, '');
  if (!cleanStr) return null;

  let cleanNum = 0;
  if (cleanStr.includes('.') && !cleanStr.includes(',')) {
    cleanNum = parseInt(cleanStr.replace(/\./g, ''), 10);
  } else if (cleanStr.includes(',') && !cleanStr.includes('.')) {
    cleanNum = parseInt(cleanStr.replace(/,/g, ''), 10);
  } else if (cleanStr.includes('.') && cleanStr.includes(',')) {
    cleanNum = parseInt(cleanStr.replace(/[\.,]/g, '').slice(0, -2), 10);
  } else {
    cleanNum = parseInt(cleanStr, 10);
  }

  // Lọc số năm hiện tại (2024..2027) hoặc số quá nhỏ (< 1000)
  if (cleanNum >= 1000 && cleanNum < 1000000000) {
    if (cleanNum >= 2024 && cleanNum <= 2027) return null;
    return cleanNum;
  }

  return null;
}

// =========================================================================
// HELPER: LỌC RÁC VÀ LÀM SẠCH KÝ TỰ NHIỄU OCR
// =========================================================================
function cleanNoteText(str: string): string {
  if (!str) return '';
  // Loại bỏ các ký tự rác OCR phổ biến như |, ;, ", ?, ~, `, <, >, {, }
  let cleaned = str.replace(/[|;~"`\<\>\\{}]/g, ' ').replace(/\s+/g, ' ').trim();
  // Loại bỏ chuỗi ký tự rời rạc vô nghĩa do nhiễu hạt scan như "HE Hi B li In li HH II II I"
  cleaned = cleaned.replace(/\b([IHli1]\s+){2,}[IHli1]?\b/gi, '').trim();
  return cleaned;
}

function isGarbageOcrText(str: string): boolean {
  if (!str) return true;
  const trimmed = str.trim();
  if (trimmed.length < 2) return true;

  // Đếm số lượng chữ cái tiếng Việt và số
  const lettersAndDigits = trimmed.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '');
  if (lettersAndDigits.length < 2) return true;

  // Chuỗi chỉ gồm các vạch kẻ và chữ cái nhiễu lặp lại (I, H, l, |, ;, :)
  if (/^([IHl\|ji\s;:,\.\?!"])+$/i.test(trimmed)) return true;

  return false;
}

// =========================================================================
// 2. CHIẾN LƯỢC TRÍCH XUẤT CHO TỪNG LOẠI (EXTRACTION STRATEGIES)
// =========================================================================

/**
 * CHIẾN LƯỢC CHO LOẠI A: Hóa đơn in nhiệt / Siêu thị có bảng
 * Tách từng món trong phần thân bảng, gán cùng ngày hóa đơn
 */
export function extractThermalReceipt(rawText: string): ExtractedBatchItem[] {
  const lines = (rawText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const todayStr = new Date().toISOString().slice(0, 10);
  const invoiceDate = extractDateFromText(rawText, todayStr);

  const items: ExtractedBatchItem[] = [];

  // Tìm điểm bắt đầu bảng (sau chữ Mặt hàng, Tên hàng, SL, ĐVT, Đơn giá...)
  let startIndex = -1;
  const tableHeaderRegex = /(?:mặt\s*hàng|tên\s*hàng|tên\s*món|mô\s*tả|sl\b|đvt\b|đơn\s*giá|thành\s*tiền|đơn\s*vị)/i;
  for (let i = 0; i < lines.length; i++) {
    if (tableHeaderRegex.test(lines[i])) {
      startIndex = i + 1;
      break;
    }
  }

  // Nếu không thấy header rõ ràng, tìm sau dòng tiêu đề hóa đơn / ngày
  if (startIndex === -1) {
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      if (/hóa\s*đơn|phiếu\s*thanh\s*toán|ngày/i.test(lines[i])) {
        startIndex = i + 1;
      }
    }
  }
  if (startIndex === -1) startIndex = 0;

  // Tìm điểm kết thúc bảng (Tổng, Tổng cộng, Total, Thanh toán...)
  let endIndex = lines.length;
  const tableFooterRegex = /(?:tổng\s*cộng|tổng\s*tiền|tổng\b|total\b|thanh\s*toán|cộng\s*tiền\s*hàng|tiền\s*mặt|thuế\s*vat|cảm\s*ơn|điểm\s*tích)/i;
  for (let i = startIndex; i < lines.length; i++) {
    if (tableFooterRegex.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  // Quét các dòng trong thân bảng
  for (let i = startIndex; i < endIndex; i++) {
    const line = lines[i];

    // Bỏ qua các dòng kẻ ngang hoặc số thứ tự rác
    if (/^[\-=_\.\s]{3,}$/.test(line) || /^stt\b/i.test(line)) continue;

    // Tìm tất cả các cụm số tiền có trên dòng
    const moneyMatches = Array.from(
      line.matchAll(/\b(\d{1,3}(?:[\.,\s]\d{3})+(?:[\.,]\d{1,2})?|\d{4,9}|\d+(?:[\.,]\d+)?\s*(?:k|nghìn|ngàn|tr|triệu))\s*(?:vnđ|vnd|đ|d)?\b/gi)
    );

    if (moneyMatches.length > 0) {
      // Số tiền ở cuối dòng thường là THÀNH TIỀN của món
      const lastMatch = moneyMatches[moneyMatches.length - 1];
      const parsedAmt = parseMoneyNumber(lastMatch[0]);

      if (parsedAmt && parsedAmt >= 1000) {
        // Cắt bỏ phần số tiền và số lượng để lấy TÊN MÓN
        const firstMatchIndex = moneyMatches[0].index ?? line.length;
        let itemName = line.slice(0, firstMatchIndex).trim();

        // Xóa số thứ tự ở đầu dòng nếu có (ví dụ: '1.', '2/', '1 ')
        itemName = itemName.replace(/^\d+[\.\/\-)\s]+/, '').trim();
        // Xóa dấu thừa và làm sạch ký tự rác OCR
        itemName = cleanNoteText(itemName);
        itemName = itemName.replace(/^[\s:\-–—+=,.]+/, '').replace(/[\s:\-–—+=,.]+$/, '').trim();

        if (isGarbageOcrText(itemName)) {
          itemName = `Món ăn / Hàng hóa ${parsedAmt.toLocaleString('vi-VN')} đ`;
        } else {
          itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
        }

        items.push({
          id: 'item-thermal-' + Date.now() + '-' + i,
          date: invoiceDate,
          amount: parsedAmt,
          note: itemName,
          categoryId: predictCategory(itemName),
          rawLine: line,
        });
      }
    }
  }

  return items;
}

/**
 * CHIẾN LƯỢC CHO LOẠI B: Biên lai Chuyển khoản Ngân hàng
 * Chỉ tạo 1 giao dịch duy nhất với số tiền giao dịch và nội dung chuyển
 */
export function extractBankTransferReceipt(rawText: string): ExtractedBatchItem[] {
  const lines = (rawText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const todayStr = new Date().toISOString().slice(0, 10);
  const transferDate = extractDateFromText(rawText, todayStr);

  // 1. Tìm số tiền chuyển lớn nhất đi kèm VND, đ hoặc ở dòng có chữ 'Số tiền'
  let transferAmount = 0;
  for (const line of lines) {
    const isAmountLine = /(?:số\s*tiền|số\s*tiền\s*chuyển|tiền\s*chuyển|amount)/i.test(line);
    const matches = Array.from(
      line.matchAll(/\b(\d{1,3}(?:[\.,\s]\d{3})+(?:[\.,]\d{1,2})?|\d{4,9}|\d+(?:[\.,]\d+)?\s*(?:k|nghìn|ngàn|tr|triệu))\s*(?:vnđ|vnd|đ|d)?\b/gi)
    );
    for (const m of matches) {
      const amt = parseMoneyNumber(m[0]);
      if (amt && amt >= 1000) {
        if (isAmountLine) {
          transferAmount = amt;
          break;
        } else if (amt > transferAmount) {
          transferAmount = amt;
        }
      }
    }
    if (transferAmount > 0 && isAmountLine) break;
  }

  // 2. Tìm nội dung chuyển khoản / lời nhắn
  let transferNote = '';
  const notePrefixRegex = /(?:nội\s*dung\s*chuyển\s*khoản|nội\s*dung\s*giao\s*dịch|nội\s*dung|lời\s*nhắn|chi\s*tiết|ghi\s*chú)[\s:\.]*(.+)/i;
  for (const line of lines) {
    const match = line.match(notePrefixRegex);
    if (match && match[1] && match[1].trim().length > 1) {
      transferNote = match[1].trim();
      break;
    }
  }

  // Nếu không thấy chữ sau tiền tố, tìm tên người nhận
  if (!transferNote) {
    const receiverRegex = /(?:người\s*thụ\s*hưởng|người\s*nhận|tài\s*khoản\s*nhận)[\s:\.]*(.+)/i;
    for (const line of lines) {
      const match = line.match(receiverRegex);
      if (match && match[1] && match[1].trim().length > 1) {
        transferNote = `Chuyển khoản đến ${match[1].trim()}`;
        break;
      }
    }
  }

  if (!transferNote) {
    transferNote = 'Chuyển khoản ngân hàng';
  } else {
    transferNote = transferNote.charAt(0).toUpperCase() + transferNote.slice(1);
  }

  if (transferAmount <= 0) {
    transferAmount = 50000; // Giá trị cơ sở nếu không tìm thấy
  }

  return [
    {
      id: 'item-transfer-' + Date.now(),
      date: transferDate,
      amount: transferAmount,
      note: transferNote,
      categoryId: predictCategory(transferNote),
      rawLine: rawText.slice(0, 80),
    },
  ];
}

/**
 * CHIẾN LƯỢC CHO LOẠI C: Giấy ghi nợ tự do / Ghi chép tay
 * Quét từng dòng, cập nhật ngày khi thấy ngày, tách tiền & chữ còn lại
 */
export function extractFreeTextReceipt(rawText: string): ExtractedBatchItem[] {
  const lines = (rawText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const today = new Date();
  const currentYear = today.getFullYear();
  let currentDate = today.toISOString().slice(0, 10);

  const items: ExtractedBatchItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Kiểm tra ngày tháng trên dòng
    const shortDateRegex = /(?:ngày\s+)?\b([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])(?:[\/\-\.](20\d{2}|\d{2}))?\b/i;
    const dateMatch = line.match(shortDateRegex);
    if (dateMatch) {
      const d = parseInt(dateMatch[1], 10);
      const m = parseInt(dateMatch[2], 10);
      let y = dateMatch[3] ? parseInt(dateMatch[3], 10) : currentYear;
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        currentDate = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      }
    }

    // 2. Kiểm tra số tiền
    const moneyMatches = Array.from(
      line.matchAll(/\b(\d{1,3}(?:[\.,\s]\d{3})+(?:[\.,]\d{1,2})?|\d{4,9}|\d+(?:[\.,]\d+)?\s*(?:k|nghìn|ngàn|tr|triệu))\s*(?:vnđ|vnd|đ|d)?\b/gi)
    );

    if (moneyMatches.length > 0) {
      const lastMatch = moneyMatches[moneyMatches.length - 1];
      const amt = parseMoneyNumber(lastMatch[0]);

      if (amt && amt >= 1000) {
        // Tách chữ còn lại làm Tên món / Ghi chú
        let note = line.replace(lastMatch[0], '');
        if (dateMatch) {
          note = note.replace(dateMatch[0], '');
        }
        note = note.replace(/^[\s:\-–—+=,.]+/, '').replace(/[\s:\-–—+=,.]+$/, '').trim();

        if (!note) {
          note = `Khoản chi ${amt.toLocaleString('vi-VN')} đ`;
        } else {
          note = cleanNoteText(note);
          if (isGarbageOcrText(note)) {
            note = `Khoản chi ${amt.toLocaleString('vi-VN')} đ`;
          } else {
            note = note.charAt(0).toUpperCase() + note.slice(1);
          }
        }

        items.push({
          id: 'item-free-' + Date.now() + '-' + i,
          date: currentDate,
          amount: amt,
          note,
          categoryId: predictCategory(note),
          rawLine: line,
        });
      }
    }
  }

  return items;
}

// =========================================================================
// 3. HÀM CHÍNH ĐIỀU PHỐI (EXTRACT INVOICE DATA)
// Hỗ trợ cả chuỗi JSON từ Cloud/LLM Vision và văn bản phân tích dòng
/**
 * Hàm dọn dẹp chuỗi trước khi Parse JSON (JSON Extraction):
 * 1. Xóa bỏ các thẻ Markdown: text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
 * 2. Dùng Regex / Vị trí để trích xuất phần JSON cốt lõi (tìm từ dấu { hoặc [ đầu tiên đến dấu } hoặc ] cuối cùng).
 * 3. Chỉ khi nào trích xuất được chuỗi sạch mới parse, bọc trong try...catch an toàn.
 */
/**
 * Tách các top-level JSON objects {} từ chuỗi (hỗ trợ nested brackets)
 */
function extractTopLevelObjects(str: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let startIdx = -1;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        if (depth === 0) {
          startIdx = i;
        }
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && startIdx !== -1) {
          objects.push(str.substring(startIdx, i + 1));
          startIdx = -1;
        }
      }
    }
  }
  return objects;
}

/**
 * Hàm dọn dẹp chuỗi trước khi Parse JSON (JSON Extraction & Fallback Parser):
 * 1. Xóa bỏ các thẻ Markdown: text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
 * 2. Cứu vãn dữ liệu (Fallback Parser): Nếu chuỗi trả về là các object rời rạc (ví dụ: {...} {...} hoặc {...}, {...}),
 *    dùng Regex tự động bọc chuỗi đó vào dấu [] và thêm dấu phẩy giữa các object trước khi gọi JSON.parse().
 * 3. Đảm bảo an toàn không bị lỗi "Unexpected non-whitespace character after JSON".
 */
export function extractCleanJsonString(rawText: string): string {
  if (!rawText) return '';
  // Bước 1: Xóa bỏ các thẻ Markdown
  let text = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Bước 2: Dùng vị trí/Regex để trích xuất phần JSON cốt lõi (từ dấu { hoặc [ đầu tiên đến dấu } hoặc ] cuối cùng)
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else {
    startIdx = firstBrace !== -1 ? firstBrace : firstBracket;
  }

  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  const endIdx = Math.max(lastBrace, lastBracket);

  if (startIdx !== -1 && endIdx > startIdx) {
    text = text.substring(startIdx, endIdx + 1);
  }
  text = text.trim();

  // Thử parse trực tiếp xem đã hợp lệ chưa
  try {
    JSON.parse(text);
    return text;
  } catch {
    // Không parse được trực tiếp, kích hoạt Fallback Parser
  }

  // Bước 3: Cứu vãn dữ liệu (Fallback Parser)
  // Nếu là mảng [...] bị thiếu dấu phẩy giữa các object [{...} {...}]
  if (text.startsWith('[') && text.endsWith(']')) {
    const fixedCommaInArray = text.replace(/}\s*(\r?\n|\s)*\s*\{/g, '},\n{');
    try {
      JSON.parse(fixedCommaInArray);
      return fixedCommaInArray;
    } catch {
      // Tiếp tục xuống dưới
    }
  }

  // Tự động bọc và chèn dấu phẩy giữa các object rời rạc: {...} {...} hoặc {...}, {...}
  let regexFixed = text
    .replace(/}\s*,\s*\{/g, '},{')
    .replace(/}\s*\{/g, '},{')
    .trim();

  // Xóa dấu phẩy thừa ở cuối nếu có
  regexFixed = regexFixed.replace(/,\s*$/, '');

  // Tự động bọc chuỗi đó vào dấu [ ]
  if (!regexFixed.startsWith('[')) {
    regexFixed = `[${regexFixed}]`;
  }

  try {
    JSON.parse(regexFixed);
    return regexFixed;
  } catch {
    // Nếu Regex chưa xử lý hết, sử dụng bộ đếm ngoặc (brace parser)
  }

  const topObjects = extractTopLevelObjects(text);
  if (topObjects.length > 0) {
    const arrayFromObjects = `[${topObjects.join(',')}]`;
    try {
      JSON.parse(arrayFromObjects);
      return arrayFromObjects;
    } catch {
      // Bỏ qua
    }
  }

  return regexFixed;
}

// =========================================================================
// 5. HÀM CHÍNH BÓC TÁCH DỮ LIỆU TỔNG QUÁT (EXTRACT INVOICE DATA)
// =========================================================================
export function extractInvoiceData(rawText: string): BatchParsedResult {
  const cleanJson = extractCleanJsonString(rawText);

  // Kiểm tra nếu đầu vào là kết quả JSON trả về từ Cloud LLM Vision
  if (
    (cleanJson.startsWith('{') || cleanJson.startsWith('[')) &&
    (cleanJson.includes('"items"') || cleanJson.includes('"totalAmount"') || cleanJson.includes('"amount"'))
  ) {
    try {
      const parsed = JSON.parse(cleanJson);
      const invoiceType: InvoiceType =
        (typeof parsed === 'object' && !Array.isArray(parsed) && parsed.invoiceType) ||
        'TYPE_A_TABLE';

      const invoiceTypeName =
        (typeof parsed === 'object' && !Array.isArray(parsed) && parsed.invoiceTypeName) ||
        (invoiceType === 'TYPE_A_TABLE'
          ? 'Hóa đơn in / Bảng (Siêu thị, Cửa hàng)'
          : invoiceType === 'TYPE_B_TRANSFER'
          ? 'Biên lai Chuyển khoản Ngân hàng'
          : 'Giấy ghi chép tự do');

      const defaultDate =
        (typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.date : null) ||
        new Date().toISOString().slice(0, 10);

      const rawItems = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.items)
        ? parsed.items
        : [];

      const items: ExtractedBatchItem[] = rawItems
        .filter((item: any) => item && (Number(item.amount) > 0 || Number(item.price) > 0))
        .map((item: any, idx: number) => {
          const amt = Number(item.amount || item.price || 0);
          const name = String(item.name || item.title || item.note || `Món hàng ${idx + 1}`).trim();
          const itemDate = item.date || defaultDate;
          const categoryId = item.categoryId || predictCategory(item.categorySuggestion || item.category || name);

          return {
            id: `vision-item-${Date.now()}-${idx}`,
            date: itemDate,
            amount: amt,
            note: name,
            categoryId,
            rawLine: `${name}: ${amt.toLocaleString('vi-VN')} đ`,
          };
        });

      const totalAmount =
        (typeof parsed === 'object' && !Array.isArray(parsed) && Number(parsed.totalAmount)) ||
        items.reduce((acc, it) => acc + it.amount, 0);

      return {
        rawText,
        invoiceType,
        invoiceTypeName,
        items,
        totalAmount,
      };
    } catch (err) {
      console.warn('Lỗi parse JSON Vision, chuyển sang bộ phân tích cú pháp:', err);
    }
  }

  const invoiceType = classifyInvoice(rawText);
  let items: ExtractedBatchItem[] = [];

  if (invoiceType === 'TYPE_B_TRANSFER') {
    items = extractBankTransferReceipt(rawText);
  } else if (invoiceType === 'TYPE_A_TABLE') {
    items = extractThermalReceipt(rawText);
    // Nếu bộ bóc tách bảng không lấy được mục nào, dùng fallback tự do
    if (items.length === 0) {
      items = extractFreeTextReceipt(rawText);
    }
  } else {
    items = extractFreeTextReceipt(rawText);
  }

  const invoiceTypeNames: Record<InvoiceType, string> = {
    TYPE_A_TABLE: 'Hóa đơn in / Bảng (Siêu thị, Cửa hàng)',
    TYPE_B_TRANSFER: 'Biên lai Chuyển khoản Ngân hàng',
    TYPE_C_FREE_TEXT: 'Giấy ghi chép tự do / Ghi tay',
  };

  const totalAmount = items.reduce((acc, it) => acc + it.amount, 0);

  return {
    rawText,
    invoiceType,
    invoiceTypeName: invoiceTypeNames[invoiceType],
    items,
    totalAmount,
  };
}

// Giữ lại alias parseBatchVietnameseReceipt để tương thích
export const parseBatchVietnameseReceipt = extractInvoiceData;

