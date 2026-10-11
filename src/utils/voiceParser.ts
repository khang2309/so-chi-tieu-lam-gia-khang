import { Category, TransactionType } from '../types';
import { callGeminiText, GEMINI_VOICE_SCHEMA } from './cloudVisionService';

export interface ParsedVoiceResult {
  amount: number;
  note: string;
  type: TransactionType;
  categoryId: string;
  rawText: string;
}

// Chuyển đổi các từ chữ số tiếng Việt thông dụng sang số
const VIETNAMESE_NUMBER_WORDS: Record<string, number> = {
  'không': 0,
  'một': 1,
  'mốt': 1,
  'hai': 2,
  'ba': 3,
  'bốn': 4,
  'năm': 5,
  'lăm': 5,
  'sáu': 6,
  'bảy': 7,
  'tám': 8,
  'chín': 9,
  'mười': 10,
  'mười một': 11,
  'mười hai': 12,
  'mười ba': 13,
  'mười bốn': 14,
  'mười lăm': 15,
  'hai mươi': 20,
  'hai lăm': 25,
  'ba mươi': 30,
  'ba lăm': 35,
  'bốn mươi': 40,
  'bốn lăm': 45,
  'năm mươi': 50,
  'năm lăm': 55,
  'sáu mươi': 60,
  'bảy mươi': 70,
  'tám mươi': 80,
  'chín mươi': 90,
  'trăm': 100,
  'một trăm': 100,
  'hai trăm': 200,
  'ba trăm': 300,
  'bốn trăm': 400,
  'năm trăm': 500,
  'sáu trăm': 600,
  'bảy trăm': 700,
  'tám trăm': 800,
  'chín trăm': 900,
};

/**
 * Trích xuất số tiền từ văn bản giọng nói tiếng Việt
 */
export function extractAmount(text: string): { amount: number; matchedString: string } | null {
  const clean = text.toLowerCase().trim();

  // 1. Tỷ: "1 tỷ", "2.5 tỷ"
  const tyRegex = /(\d+(?:[.,]\d+)?)\s*(?:tỷ|ty|b)(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const tyMatch = clean.match(tyRegex);
  if (tyMatch) {
    const val = parseFloat(tyMatch[1].replace(',', '.'));
    return { amount: Math.round(val * 1_000_000_000), matchedString: tyMatch[0] };
  }

  // 2a. "X triệu/tr/củ/chai rưỡi"
  const trieuRuoiRegex = /(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|củ|chai|m)\s*rưỡi(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const trieuRuoiMatch = clean.match(trieuRuoiRegex);
  if (trieuRuoiMatch) {
    const val = parseFloat(trieuRuoiMatch[1].replace(',', '.')) + 0.5;
    return { amount: Math.round(val * 1_000_000), matchedString: trieuRuoiMatch[0] };
  }

  // 2b. "2tr5", "2 tr 5", "2 triệu 5", "2 triệu 500"
  const trieuLeRegex = /(\d+)\s*(?:triệu|tr|củ|chai|m)\s*(\d{1,3})(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const trieuLeMatch = clean.match(trieuLeRegex);
  if (trieuLeMatch) {
    const base = parseInt(trieuLeMatch[1], 10) * 1_000_000;
    let remainder = parseInt(trieuLeMatch[2], 10);
    if (remainder < 10) remainder *= 100_000;
    else if (remainder < 100) remainder *= 10_000;
    else remainder *= 1_000;
    return { amount: base + remainder, matchedString: trieuLeMatch[0] };
  }

  // 2c. "X triệu", "X tr", "X củ", "X chai", "X.Y triệu"
  const trieuRegex = /(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|củ|chai|m)(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const trieuMatch = clean.match(trieuRegex);
  if (trieuMatch) {
    const val = parseFloat(trieuMatch[1].replace(',', '.'));
    return { amount: Math.round(val * 1_000_000), matchedString: trieuMatch[0] };
  }

  // 3a. "X lít", "X xị"
  const litRegex = /(\d+)\s*(?:lít|xị)(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const litMatch = clean.match(litRegex);
  if (litMatch) {
    const val = parseInt(litMatch[1], 10);
    return { amount: val * 100_000, matchedString: litMatch[0] };
  }

  // 3b. "X k rưỡi", "X ngàn rưỡi"
  const nganRuoiRegex = /(\d+)\s*(?:nghìn|ngàn|k|ng)\s*rưỡi(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const nganRuoiMatch = clean.match(nganRuoiRegex);
  if (nganRuoiMatch) {
    const val = parseInt(nganRuoiMatch[1], 10) * 1000 + 500;
    return { amount: val, matchedString: nganRuoiMatch[0] };
  }

  // 3c. "50k", "50 nghìn", "50 ngàn", "50 ng", "50.5k"
  const nganRegex = /(\d+(?:[.,]\d+)?)\s*(?:nghìn|ngàn|k|ng)(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const nganMatch = clean.match(nganRegex);
  if (nganMatch) {
    const val = parseFloat(nganMatch[1].replace(',', '.'));
    return { amount: Math.round(val * 1_000), matchedString: nganMatch[0] };
  }

  // 3d. "trăm rưỡi" / "1 trăm rưỡi" -> 150.000, "hai trăm rưỡi" -> 250.000
  const tramRuoiRegex = /(?:(\d+)|một|hai|ba|bốn|năm)\s*trăm\s*rưỡi(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const tramRuoiMatch = clean.match(tramRuoiRegex);
  if (tramRuoiMatch) {
    let digit = 1;
    if (tramRuoiMatch[1]) digit = parseInt(tramRuoiMatch[1], 10);
    else if (clean.includes('hai')) digit = 2;
    else if (clean.includes('ba')) digit = 3;
    else if (clean.includes('bốn')) digit = 4;
    else if (clean.includes('năm')) digit = 5;
    return { amount: digit * 100_000 + 50_000, matchedString: tramRuoiMatch[0] };
  }

  // 3e. "nửa triệu" -> 500.000
  if (clean.includes('nửa triệu') || clean.includes('nửa củ')) {
    return { amount: 500_000, matchedString: clean.includes('nửa triệu') ? 'nửa triệu' : 'nửa củ' };
  }

  // 4. Số thuần dạng tiền tệ: "50.000đ", "50000 vnđ", "50.000 đồng"
  const dongRegex = /(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đồng|đ|vnd)(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const dongMatch = clean.match(dongRegex);
  if (dongMatch) {
    const num = parseInt(dongMatch[1].replace(/[.,]/g, ''), 10);
    if (!isNaN(num)) {
      return { amount: num, matchedString: dongMatch[0] };
    }
  }

  // 5. Số nguyên thuần túy từ 4 chữ số trở lên: "50000", "50.000", "250,000"
  const rawNumRegex = /(?:^|\s|[^\d.,])(\d{1,3}(?:[.,]\d{3})+|\d{4,})(?![a-zA-Z0-9à-ỹÀ-Ỹ])/;
  const rawMatch = clean.match(rawNumRegex);
  if (rawMatch) {
    const num = parseInt(rawMatch[1].replace(/[.,]/g, ''), 10);
    if (!isNaN(num) && num >= 1000) {
      return { amount: num, matchedString: rawMatch[1] };
    }
  }

  // 6. Xử lý các cụm chữ số tiếng Việt thông dụng (ví dụ: "năm mươi nghìn", "hai trăm ngàn", "năm chục", "ba chục")
  for (const [phrase, val] of Object.entries(VIETNAMESE_NUMBER_WORDS)) {
    const phraseNganRegex = new RegExp(`\\b${phrase}\\s*(?:nghìn|ngàn|k)(?![a-zA-Z0-9à-ỹÀ-Ỹ])`, 'i');
    const m = clean.match(phraseNganRegex);
    if (m) {
      return { amount: val * 1_000, matchedString: m[0] };
    }
    const phraseTrieuRegex = new RegExp(`\\b${phrase}\\s*(?:triệu|củ)(?![a-zA-Z0-9à-ỹÀ-Ỹ])`, 'i');
    const mT = clean.match(phraseTrieuRegex);
    if (mT) {
      return { amount: val * 1_000_000, matchedString: mT[0] };
    }
  }

  // Cụm "X chục": "5 chục" -> 50.000, "ba chục" -> 30.000
  const chucRegex = /(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín)\s*chục(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
  const chucMatch = clean.match(chucRegex);
  if (chucMatch) {
    let digit = parseInt(chucMatch[1], 10);
    if (isNaN(digit)) {
      digit = VIETNAMESE_NUMBER_WORDS[chucMatch[1].toLowerCase()] || 0;
    }
    if (digit > 0) {
      return { amount: digit * 10_000, matchedString: chucMatch[0] };
    }
  }

  return null;
}

/**
 * Phân loại loại giao dịch: Thu nhập hay Chi tiêu
 */
export function detectTransactionType(text: string): TransactionType {
  const lower = text.toLowerCase();
  const incomeKeywords = [
    'lương',
    'thưởng',
    'thu nhập',
    'được cho',
    'tiền lãi',
    'bán được',
    'thu vào',
    'hoàn tiền',
    'nhận được',
    'tiền về',
    'được tặng',
    'được lì xì',
    'lì xì',
  ];
  if (incomeKeywords.some((kw) => lower.includes(kw))) {
    return 'income';
  }
  return 'expense';
}

/**
 * Gợi ý danh mục phù hợp dựa trên từ khóa trong câu nói
 */
export function detectCategory(
  text: string,
  categories: Category[],
  type: TransactionType
): string {
  const lower = text.toLowerCase();

  // Bộ từ khóa ánh xạ theo danh mục
  const keywordMap: Record<string, string[]> = {
    // Xăng xe / Đi lại
    gas: [
      'xăng',
      'xe',
      'gửi xe',
      'rửa xe',
      'nhớt',
      'thay nhớt',
      'grab',
      'be',
      'gojek',
      'taxi',
      'vé xe',
      'xe buýt',
      'xe bus',
      'tàu',
      'vé tàu',
      'cầu đường',
      'bảo hiểm xe',
      'janus',
    ],
    // Uống
    drink: [
      'cà phê',
      'cafe',
      'trà sữa',
      'nước mía',
      'sinh tố',
      'nước ngọt',
      'bia',
      'rượu',
      'uống',
      'highlands',
      'phúc long',
      'the coffee house',
      'nước lọc',
      'nước khoáng',
    ],
    // Ăn
    eat: [
      'ăn',
      'cơm',
      'bún',
      'phở',
      'bánh mì',
      'hủ tiếu',
      'lẩu',
      'nướng',
      'nhậu',
      'tiệc',
      'đồ ăn',
      'bữa sáng',
      'bữa trưa',
      'bữa tối',
      'ăn vặt',
      'chè',
      'ốc',
      'kfc',
      'lotteria',
      'pizza',
      'bánh bao',
      'mì tôm',
      'mì cay',
    ],
    // Mua sắm
    shopping: [
      'mua',
      'quần áo',
      'áo',
      'quần',
      'giày',
      'dép',
      'siêu thị',
      'chợ',
      'shopee',
      'lazada',
      'tiki',
      'tiktok',
      'túi xách',
      'balo',
      'mỹ phẩm',
      'son',
      'kem',
      'shop',
    ],
    // Cắt tóc / Làm đẹp
    haircut: [
      'cắt tóc',
      'gội đầu',
      'barber',
      'salon',
      'làm tóc',
      'uốn tóc',
      'nhuộm tóc',
      'spa',
      'làm móng',
      'nail',
    ],
    // Đồ điện tử
    electronics: [
      'điện thoại',
      'tai nghe',
      'laptop',
      'máy tính',
      'chuột',
      'bàn phím',
      'sạc',
      'cáp',
      'củ sạc',
      'loa',
      'ipad',
      'pin',
      'màn hình',
      'công nghệ',
    ],
    // Đồ gia dụng
    furniture: [
      'gia dụng',
      'chảo',
      'nồi',
      'bát',
      'đũa',
      'quạt',
      'chổi',
      'nước giặt',
      'nước xả',
      'dầu gội',
      'sữa tắm',
      'kem đánh răng',
      'giấy vệ sinh',
      'bàn chải',
      'khăn',
    ],
    // Hóa đơn / Phòng trọ
    bills: [
      'tiền phòng',
      'tiền trọ',
      'tiền nhà',
      'tiền điện',
      'tiền nước',
      'tiền mạng',
      'tiền wifi',
      'internet',
      'rác',
      'tiền rác',
      'hóa đơn',
      'chung cư',
      'phí quản lý',
    ],
    // Lương
    salary: ['lương', 'tiền lương', 'bảng lương'],
    // Thưởng
    bonus: ['thưởng', 'tiền thưởng', 'phụ cấp', 'hoa hồng', 'tip', 'tiền tip'],
  };

  // Tìm danh mục khớp theo ID hoặc Tên
  for (const [groupKey, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      // Tìm category trong danh sách
      const found = categories.find((cat) => {
        const catName = cat.name.toLowerCase();
        const catId = cat.id.toLowerCase();
        if (groupKey === 'gas' && (catId.includes('gas') || catName.includes('xăng'))) return true;
        if (groupKey === 'drink' && (catId.includes('drink') || catName.includes('uống') || catName.includes('cà phê'))) return true;
        if (groupKey === 'eat' && (catId.includes('eat') || catName.includes('ăn'))) return true;
        if (groupKey === 'shopping' && (catId.includes('shopping') || catName.includes('mua sắm'))) return true;
        if (groupKey === 'haircut' && (catId.includes('haircut') || catName.includes('cắt tóc'))) return true;
        if (groupKey === 'electronics' && (catId.includes('electronic') || catName.includes('điện tử'))) return true;
        if (groupKey === 'furniture' && (catId.includes('furniture') || catName.includes('gia dụng'))) return true;
        if (groupKey === 'bills' && (catId.includes('bills') || catName.includes('hóa đơn') || catName.includes('tiền phòng'))) return true;
        if (groupKey === 'salary' && (catId.includes('salary') || catName.includes('lương'))) return true;
        if (groupKey === 'bonus' && (catId.includes('bonus') || catName.includes('thưởng'))) return true;
        return false;
      });
      if (found) return found.id;
    }
  }

  // Nếu không khớp, lấy danh mục mặc định theo loại giao dịch
  const filteredByType = categories.filter(
    (c) => (type === 'expense' ? c.type === 'expense' || c.type === 'both' : c.type === 'income' || c.type === 'both')
  );

  return filteredByType[0]?.id || categories[0]?.id || 'cat-eat';
}

/**
 * Làm sạch chuỗi ghi chú sau khi đã bóc tách số tiền
 */
export function cleanNote(rawText: string, matchedAmountStr: string): string {
  let note = rawText;
  if (matchedAmountStr) {
    // Thay thế cụm số tiền bằng khoảng trắng
    const regex = new RegExp(matchedAmountStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    note = note.replace(regex, ' ');
  }

  // Loại bỏ các từ thừa phổ biến trong câu nói giao dịch
  const removeWords = [
    /\bhết\b/gi,
    /\btầm\b/gi,
    /\bkhoảng\b/gi,
    /\bgiá\b/gi,
    /\btổng cộng\b/gi,
    /\blà\b/gi,
    /\bmất\b/gi,
    /\bcho\b/gi,
  ];

  removeWords.forEach((rgx) => {
    note = note.replace(rgx, ' ');
  });

  // Xóa ký tự thừa, nhiều khoảng trắng liên tiếp
  note = note
    .replace(/[,\-–—:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Viết hoa chữ cái đầu tiên
  if (note.length > 0) {
    note = note.charAt(0).toUpperCase() + note.slice(1);
  } else {
    note = rawText.trim();
  }

  return note;
}

/**
 * Hàm phân tích toàn diện câu nói bằng giọng nói (Smart Voice Parser - Regex Cục Bộ)
 */
export function parseVoiceInput(text: string, categories: Category[]): ParsedVoiceResult {
  const trimmed = text.trim();
  const extracted = extractAmount(trimmed);

  const amount = extracted ? extracted.amount : 0;
  const matchedStr = extracted ? extracted.matchedString : '';
  const note = cleanNote(trimmed, matchedStr);
  const type = detectTransactionType(trimmed);
  const categoryId = detectCategory(trimmed, categories, type);

  return {
    amount,
    note,
    type,
    categoryId,
    rawText: trimmed,
  };
}

/**
 * Nâng cấp bóc tách Giọng nói (Voice) bằng Google Gemini API:
 * Gửi câu nói lên Gemini để bóc tách: amount, note, category
 * Tự động quy đổi các từ k/ngàn/nghìn/triệu/củ thành số nguyên, loại bỏ số tiền khỏi note
 */
export async function parseVoiceWithGemini(
  text: string,
  categories: Category[],
  apiKeyOverride?: string,
  abortSignal?: AbortSignal
): Promise<ParsedVoiceResult> {
  const cleanInput = text.trim();
  if (!cleanInput) {
    return {
      amount: 0,
      note: '',
      type: 'expense',
      categoryId: categories[0]?.id || '',
      rawText: text,
    };
  }

  // Danh sách danh mục để AI gợi ý chuẩn xác nhất
  const categoryNames = categories.map((c) => c.name).join(', ');

  const prompt = `Trích xuất thông tin giao dịch từ câu nói này: '${cleanInput}'. Trả về duy nhất định dạng JSON: { "amount": <số tiền nguyên dương, tự động quy đổi các từ k/ngàn/nghìn/triệu/củ thành số>, "note": "<nội dung giao dịch, loại bỏ số tiền>", "category": "<danh mục phù hợp nhất trong danh sách: ${categoryNames}>" }`;

  try {
    const rawResponse = await callGeminiText(prompt, apiKeyOverride, abortSignal, GEMINI_VOICE_SCHEMA);
    let cleanText = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleanText);

    const amount = Math.abs(Math.round(Number(parsed.amount) || 0));
    const rawNote = String(parsed.note || '').trim();
    const note = rawNote || cleanInput;
    const categoryName = String(parsed.category || '').trim().toLowerCase();

    // Tìm danh mục khớp nhất
    let matchedCat = categories.find(
      (c) => c.name.toLowerCase() === categoryName || categoryName.includes(c.name.toLowerCase())
    );

    if (!matchedCat && categoryName) {
      matchedCat = categories.find((c) =>
        c.name.toLowerCase().split(/\s+/).some((w) => w.length > 1 && categoryName.includes(w))
      );
    }

    if (!matchedCat) {
      const localResult = parseVoiceInput(cleanInput, categories);
      matchedCat = categories.find((c) => c.id === localResult.categoryId);
    }

    const defaultExpenseCat = categories.find((c) => c.type === 'expense') || categories[0];
    const finalCat = matchedCat || defaultExpenseCat;

    const isIncome =
      finalCat?.type === 'income' ||
      /\b(lương|thưởng|thu nhập|tiền về|được tặng|nhận được|chuyển khoản cho tôi|trả nợ)\b/i.test(cleanInput);

    return {
      amount,
      note,
      type: isIncome ? 'income' : 'expense',
      categoryId: finalCat?.id || '',
      rawText: text,
    };
  } catch (err) {
    console.warn('Lỗi gọi Gemini NLP cho Voice, tự động fallback sang Regex parser cục bộ:', err);
    return parseVoiceInput(text, categories);
  }
}

