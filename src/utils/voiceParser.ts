import { Category, TransactionType, Wallet } from '../types';
import { DEFAULT_WALLETS } from '../data/initialData';
import {
  callGeminiText,
  callGeminiAudio,
  GEMINI_VOICE_SCHEMA,
  extractCleanJsonString,
  escapeNewlinesInJsonStrings,
} from './cloudVisionService';

export interface ParsedVoiceResult {
  amount: number;
  note: string;
  type: TransactionType;
  categoryId: string;
  rawText: string;
  transcript?: string;
  walletId?: string;
  walletName?: string;
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

  // 3c. "50k", "50 nghìn", "50 ngàn", "25ca", "25 ca", "30 cành", "50.5k"
  const nganRegex = /(\d+(?:[.,]\d+)?)\s*(?:nghìn|ngàn|k|ca|ka|cành|c|ng)(?![a-zA-Z0-9à-ỹÀ-Ỹ])/i;
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
export function cleanNote(rawText: string, matchedAmountStr: string, walletName?: string): string {
  let note = rawText;
  if (matchedAmountStr) {
    const regex = new RegExp(matchedAmountStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    note = note.replace(regex, ' ');
  }

  // Xóa số tiền và từ lóng: 25ca, 25 ka, 25k, 50 cành, 2 củ, 500k, 25000, 25.000đ, 25000 vnd
  note = note
    .replace(/\s*\b(?:hết\s*)?\d+(?:[.,]\d+)?\s*(?:k|ca|ka|cành|c|nghìn|ngàn|củ|triệu|tr|lít|lốp|đ|vnd|đồng)\b/gi, ' ')
    .replace(/\s*\b(?:hết\s*)?\d{4,}\b/g, ' ');

  // Xóa các cụm ví / thanh toán
  note = note
    .replace(/\s*\b(?:thanh toán\s*(?:bằng|qua|ví)?|qua ví|bằng ví|trả bằng|chuyển khoản|ck|bằng|qua)\s*(?:momo|mb\s*bank|mb|timo|bidv|tiền\s*mặt|vietcombank|techcombank|zalopay|ngân\s*hàng|ví)[\w\s]*$/gi, ' ')
    .replace(/\s*\b(?:thanh toán\s*(?:bằng|qua|ví)?|qua ví|bằng ví|trả bằng|chuyển khoản|ck)\b[\w\s]*/gi, ' ');

  if (walletName) {
    const wRegex = new RegExp(`\\b(?:ví\\s*)?${walletName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    note = note.replace(wRegex, ' ');
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
 * Prompt chuẩn theo yêu cầu:
 * Bóc tách giao dịch tiếng Việt kèm từ lóng tiền tệ và đối chiếu danh sách ví hợp lệ
 */
export function buildVoiceSystemPrompt(walletNames: string): string {
  return `Bạn là trợ lý tài chính tiếng Việt thông minh. Hãy bóc tách câu của người dùng ra chuẩn JSON.

CHÚ Ý TỪ LÓNG TIỀN TỆ:
- Nếu người dùng nói số đi kèm 'k', 'ca', 'ka', 'cành' (VD: '25ca', '25 ca', '30 cành', '50k'), BẮT BUỘC chuyển thành số nguyên nhân với 1000 (Ví dụ: '25ca' = 25000, '30 cành' = 30000, '50k' = 50000).
- Nếu dùng 'lít'/'xị' (x100,000, VD: '2 lít' = 200000).
- Nếu dùng 'củ'/'chai'/'triệu'/'tr' (x1,000,000, VD: '2 củ' = 2000000, '1tr5' = 1500000).

VÍ TIỀN (wallet):
- DANH SÁCH VÍ HỢP LỆ CỦA NGƯỜI DÙNG: [${walletNames}].
- BẮT BUỘC CHỈ ĐƯỢC CHỌN TỪ DANH SÁCH VÍ NÀY. Tuyệt đối không tự bịa ví mới.
- Khi người dùng nói ví hoặc phương thức thanh toán (VD: 'thanh toán bằng momo', 'qua momo', 'ví momo', 'bằng ví mb'...), tìm ví khớp nhất trong danh sách ví trên (VD: 'momo' -> 'MoMo').
- Nếu câu nói không nhắc đến ví hoặc không khớp ví nào, mặc định là 'Tiền mặt' (hoặc ví đầu tiên).

GHI CHÚ (note):
- Chỉ giữ lại tên món ăn, dịch vụ hoặc mục đích chi tiêu thực tế.
- BẮT BUỘC LOẠI BỎ hoàn toàn số tiền, đơn vị tiền tệ (như '25ca', '50k') và các cụm từ thanh toán/ví (như 'thanh toán bằng momo', 'qua momo', 'bằng ví momo', 'bằng tiền mặt') khỏi 'note'.
- Ví dụ: 'ăn cơm tấm 25ca thanh toán bằng momo' -> note: 'ăn cơm tấm'.

VÍ DỤ CHUẨN:
Nếu người dùng nói: 'ăn cơm tấm 25ca thanh toán bằng momo'
Trả về JSON chính xác:
{
  "transcript": "ăn cơm tấm 25ca thanh toán bằng momo",
  "note": "ăn cơm tấm",
  "amount": 25000,
  "wallet": "MoMo",
  "category": "Ăn",
  "transactionType": "expense"
}`;
}

export const VOICE_CHAIN_OF_THOUGHT_PROMPT = buildVoiceSystemPrompt('Tiền mặt, MoMo, MB Bank, Timo, BIDV, Sacombank');
export const VOICE_CONCISE_PROMPT = VOICE_CHAIN_OF_THOUGHT_PROMPT;
export const VOICE_FEW_SHOT_SYSTEM_PROMPT = VOICE_CHAIN_OF_THOUGHT_PROMPT;

/**
 * Nâng cấp bóc tách Giọng nói (Voice) bằng Google Gemini API:
 * Gửi câu nói lên Gemini để bóc tách: transcript, amount, note, wallet, category, transactionType
 * Tự động quy đổi các từ k/ca/cành/ngàn/nghìn/triệu/củ/lít thành số nguyên, nhận diện ví chính xác
 */
export async function parseVoiceWithGemini(
  text: string,
  categories: Category[],
  wallets: Wallet[] = DEFAULT_WALLETS,
  apiKeyOverride?: string,
  abortSignal?: AbortSignal,
  onModelSwitch?: (modelName: string, reason: string) => void
): Promise<ParsedVoiceResult> {
  const cleanInput = text.trim();
  const walletList = wallets && wallets.length > 0 ? wallets : DEFAULT_WALLETS;
  const walletNames = walletList.map((w) => w.name).join(', ') || 'Tiền mặt';

  if (!cleanInput) {
    return {
      amount: 0,
      note: '',
      type: 'expense',
      categoryId: categories[0]?.id || '',
      rawText: text,
      walletId: walletList[0]?.id || 'wallet-cash',
      walletName: walletList[0]?.name || 'Tiền mặt',
    };
  }

  // Danh sách danh mục để AI gợi ý chuẩn xác nhất
  const categoryNames = categories.map((c) => c.name).join(', ');
  const systemPrompt = buildVoiceSystemPrompt(walletNames);

  const prompt = `${systemPrompt}

Danh sách danh mục có sẵn: ${categoryNames}.
Câu nói của người dùng: "${cleanInput}"`;

  try {
    const rawResponse = await callGeminiText(
      prompt,
      apiKeyOverride,
      abortSignal,
      GEMINI_VOICE_SCHEMA,
      onModelSwitch,
      systemPrompt
    );
    let cleanText = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
    const cleanJson = extractCleanJsonString(cleanText);

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = JSON.parse(escapeNewlinesInJsonStrings(cleanJson));
    }

    const transcript = String(parsed.transcript || cleanInput).trim();
    let amount = Math.abs(Math.round(Number(parsed.amount) || 0));
    // Fallback nếu LLM trả 0
    if (amount === 0) {
      const fallbackExt = extractAmount(transcript || cleanInput);
      if (fallbackExt) {
        amount = fallbackExt.amount;
      }
    }

    const rawNote = String(parsed.note || '').trim().replace(/\\n/g, '\n');
    let note = rawNote
      .replace(/\s*\b(?:hết\s*)?\d+(?:[.,]\d+)?\s*(?:k|ca|ka|cành|c|nghìn|ngàn|củ|triệu|tr|lít|lốp|đ|vnd|đồng)\b/gi, ' ')
      .replace(/\s*\b(?:hết\s*)?\d{4,}\b/g, ' ')
      .replace(/\s*\b(?:thanh toán\s*(?:bằng|qua|ví)?|qua ví|bằng ví|trả bằng|chuyển khoản|ck|bằng|qua)\s*(?:momo|mb\s*bank|mb|timo|bidv|tiền\s*mặt|vietcombank|techcombank|zalopay|ngân\s*hàng|ví)[\w\s]*$/gi, ' ')
      .replace(/\s*\b(?:thanh toán\s*(?:bằng|qua|ví)?|qua ví|bằng ví|trả bằng|chuyển khoản|ck)\b[\w\s]*/gi, ' ')
      .replace(/[,\-–—:;]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    for (const w of walletList) {
      if (w.name.trim()) {
        const wReg = new RegExp(`\\b(?:ví\\s*)?${w.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        note = note.replace(wReg, ' ');
      }
    }
    note = note.replace(/\s+/g, ' ').trim();
    if (note.length > 0) {
      note = note.charAt(0).toUpperCase() + note.slice(1);
    }
    if (!note || note.toLowerCase() === 'chưa rõ' || note.toLowerCase() === 'chưa rõ mục đích') {
      note = cleanNote(rawNote || transcript || cleanInput, '', '');
    }

    // Nhận diện Ví tiền: Bắt buộc chọn từ danh sách ví có sẵn của tài khoản
    const parsedWalletStr = String(parsed.wallet || '').trim().toLowerCase();
    let matchedWallet = walletList.find((w) => w.name.toLowerCase() === parsedWalletStr);
    if (!matchedWallet && parsedWalletStr) {
      matchedWallet = walletList.find((w) =>
        w.name.toLowerCase().includes(parsedWalletStr) ||
        parsedWalletStr.includes(w.name.toLowerCase())
      );
    }
    if (!matchedWallet) {
      const fullText = (cleanInput + ' ' + transcript).toLowerCase();
      for (const w of walletList) {
        if (fullText.includes(w.name.toLowerCase())) {
          matchedWallet = w;
          break;
        }
      }
      if (!matchedWallet) {
        if (fullText.includes('momo')) {
          matchedWallet = walletList.find((w) => w.name.toLowerCase().includes('momo'));
        } else if (fullText.includes('mb') || fullText.includes('mbbank')) {
          matchedWallet = walletList.find((w) => w.name.toLowerCase().includes('mb'));
        } else if (fullText.includes('timo')) {
          matchedWallet = walletList.find((w) => w.name.toLowerCase().includes('timo'));
        }
      }
    }
    if (!matchedWallet) {
      matchedWallet =
        walletList.find((w) => w.id === 'wallet-cash' || w.name.toLowerCase().includes('tiền mặt')) ||
        walletList[0];
    }

    const rawType = String(parsed.transactionType || '').trim().toLowerCase();
    let type: TransactionType = 'expense';
    if (rawType === 'income' || rawType.includes('income') || rawType.includes('thu')) {
      type = 'income';
    } else if (rawType === 'expense' || rawType.includes('expense') || rawType.includes('chi')) {
      type = 'expense';
    } else {
      const isIncomeText = /\b(lương|thưởng|thu nhập|tiền về|được tặng|nhận được|chuyển khoản cho tôi|trả nợ|bán)\b/i.test(
        transcript || cleanInput
      );
      type = isIncomeText ? 'income' : 'expense';
    }

    const categoryName = String(parsed.category || '').trim().toLowerCase();

    // Tìm danh mục khớp với loại giao dịch (income / expense)
    let matchedCat = categories.find(
      (c) =>
        (c.type === type || c.type === 'both') &&
        (c.name.toLowerCase() === categoryName || categoryName.includes(c.name.toLowerCase()))
    );

    if (!matchedCat && categoryName) {
      matchedCat = categories.find(
        (c) =>
          (c.type === type || c.type === 'both') &&
          c.name.toLowerCase().split(/\s+/).some((w) => w.length > 1 && categoryName.includes(w))
      );
    }

    if (!matchedCat && categoryName) {
      matchedCat = categories.find(
        (c) => c.name.toLowerCase() === categoryName || categoryName.includes(c.name.toLowerCase())
      );
    }

    if (!matchedCat) {
      const localResult = parseVoiceInput(cleanInput, categories);
      matchedCat = categories.find((c) => c.id === localResult.categoryId);
    }

    const defaultCatForType =
      categories.find((c) => c.type === type || c.type === 'both') || categories[0];
    const finalCat = matchedCat || defaultCatForType;

    return {
      amount,
      note,
      type,
      categoryId: finalCat?.id || '',
      rawText: transcript || text,
      transcript: transcript || undefined,
      walletId: matchedWallet?.id || 'wallet-cash',
      walletName: matchedWallet?.name || 'Tiền mặt',
    };
  } catch (err) {
    console.warn('Lỗi gọi Gemini NLP cho Voice, tự động fallback sang Regex parser cục bộ:', err);
    const local = parseVoiceInput(text, categories);
    return {
      ...local,
      walletId: walletList[0]?.id || 'wallet-cash',
      walletName: walletList[0]?.name || 'Tiền mặt',
    };
  }
}

/**
 * Phân tích trực tiếp từ dữ liệu âm thanh ghi âm (Audio Base64) bằng Google Gemini
 * Tự động chuyển đổi các model dự phòng khi hết Quota
 * Sử dụng kỹ thuật Chain-of-Thought ép Gemini chép chính tả (transcript) trước
 */
export async function parseVoiceAudioWithGemini(
  audioBase64: string,
  mimeType: string,
  categories: Category[],
  wallets: Wallet[] = DEFAULT_WALLETS,
  apiKeyOverride?: string,
  abortSignal?: AbortSignal,
  onModelSwitch?: (modelName: string, reason: string) => void
): Promise<ParsedVoiceResult> {
  const walletList = wallets && wallets.length > 0 ? wallets : DEFAULT_WALLETS;
  const walletNames = walletList.map((w) => w.name).join(', ') || 'Tiền mặt';
  const categoryNames = categories.map((c) => c.name).join(', ');

  const systemPrompt = buildVoiceSystemPrompt(walletNames);
  const prompt = `${systemPrompt}

Nhiệm vụ: Nghe kỹ Audio. Đầu tiên chép chính tả 100% câu tiếng Việt vào 'transcript'. Sau đó bóc tách amount, note, wallet, category, transactionType.
Danh sách danh mục có sẵn: ${categoryNames}.`;

  const rawResponse = await callGeminiAudio(
    audioBase64,
    mimeType,
    prompt,
    apiKeyOverride,
    abortSignal,
    GEMINI_VOICE_SCHEMA,
    onModelSwitch,
    systemPrompt
  );

  let cleanText = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
  const cleanJson = extractCleanJsonString(cleanText);

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err: any) {
    try {
      parsed = JSON.parse(escapeNewlinesInJsonStrings(cleanJson));
    } catch {
      console.error('Không thể parse JSON từ Gemini Audio:', cleanJson, err);
      throw new Error(`Phản hồi từ Trợ lý AI không phải JSON hợp lệ: ${cleanJson.slice(0, 100)}`);
    }
  }

  const transcript = String(parsed.transcript || '').trim();
  let amount = Math.abs(Math.round(Number(parsed.amount) || 0));

  const rawNote = String(parsed.note || '').trim().replace(/\\n/g, '\n');
  let note = rawNote
    .replace(/\s*\b(?:hết\s*)?\d+(?:[.,]\d+)?\s*(?:k|ca|ka|cành|c|nghìn|ngàn|củ|triệu|tr|lít|lốp|đ|vnd|đồng)\b/gi, ' ')
    .replace(/\s*\b(?:hết\s*)?\d{4,}\b/g, ' ')
    .replace(/\s*\b(?:thanh toán\s*(?:bằng|qua|ví)?|qua ví|bằng ví|trả bằng|chuyển khoản|ck|bằng|qua)\s*(?:momo|mb\s*bank|mb|timo|bidv|tiền\s*mặt|vietcombank|techcombank|zalopay|ngân\s*hàng|ví)[\w\s]*$/gi, ' ')
    .replace(/\s*\b(?:thanh toán\s*(?:bằng|qua|ví)?|qua ví|bằng ví|trả bằng|chuyển khoản|ck)\b[\w\s]*/gi, ' ')
    .replace(/[,\-–—:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const w of walletList) {
    if (w.name.trim()) {
      const wReg = new RegExp(`\\b(?:ví\\s*)?${w.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      note = note.replace(wReg, ' ');
    }
  }
  note = note.replace(/\s+/g, ' ').trim();
  if (note.length > 0) {
    note = note.charAt(0).toUpperCase() + note.slice(1);
  }
  if (!note || note.toLowerCase() === 'chưa rõ' || note.toLowerCase() === 'chưa rõ mục đích') {
    note = cleanNote(rawNote || transcript || 'Giao dịch giọng nói', '', '');
  }

  // Nếu amount = 0, thử bóc tách từ transcript hoặc rawNote
  if (amount === 0) {
    const fallbackExt = extractAmount(transcript || rawNote);
    if (fallbackExt) {
      amount = fallbackExt.amount;
    }
  }

  // Nhận diện Ví tiền: Bắt buộc chọn từ danh sách ví có sẵn của tài khoản
  const parsedWalletStr = String(parsed.wallet || '').trim().toLowerCase();
  let matchedWallet = walletList.find((w) => w.name.toLowerCase() === parsedWalletStr);
  if (!matchedWallet && parsedWalletStr) {
    matchedWallet = walletList.find((w) =>
      w.name.toLowerCase().includes(parsedWalletStr) ||
      parsedWalletStr.includes(w.name.toLowerCase())
    );
  }
  if (!matchedWallet) {
    const fullText = (transcript + ' ' + rawNote).toLowerCase();
    for (const w of walletList) {
      if (fullText.includes(w.name.toLowerCase())) {
        matchedWallet = w;
        break;
      }
    }
    if (!matchedWallet) {
      if (fullText.includes('momo')) {
        matchedWallet = walletList.find((w) => w.name.toLowerCase().includes('momo'));
      } else if (fullText.includes('mb') || fullText.includes('mbbank')) {
        matchedWallet = walletList.find((w) => w.name.toLowerCase().includes('mb'));
      } else if (fullText.includes('timo')) {
        matchedWallet = walletList.find((w) => w.name.toLowerCase().includes('timo'));
      }
    }
  }
  if (!matchedWallet) {
    matchedWallet =
      walletList.find((w) => w.id === 'wallet-cash' || w.name.toLowerCase().includes('tiền mặt')) ||
      walletList[0];
  }

  const rawType = String(parsed.transactionType || '').trim().toLowerCase();
  let type: TransactionType = 'expense';
  if (rawType === 'income' || rawType.includes('income') || rawType.includes('thu')) {
    type = 'income';
  } else if (rawType === 'expense' || rawType.includes('expense') || rawType.includes('chi')) {
    type = 'expense';
  } else {
    const isIncomeText = /\b(lương|thưởng|thu nhập|tiền về|được tặng|nhận được|chuyển khoản cho tôi|trả nợ|bán)\b/i.test(
      transcript || note
    );
    type = isIncomeText ? 'income' : 'expense';
  }

  const categoryName = String(parsed.category || '').trim().toLowerCase();

  // Tìm danh mục khớp với loại giao dịch (income / expense)
  let matchedCat = categories.find(
    (c) =>
      (c.type === type || c.type === 'both') &&
      (c.name.toLowerCase() === categoryName || categoryName.includes(c.name.toLowerCase()))
  );

  if (!matchedCat && categoryName) {
    matchedCat = categories.find(
      (c) =>
        (c.type === type || c.type === 'both') &&
        c.name.toLowerCase().split(/\s+/).some((w) => w.length > 1 && categoryName.includes(w))
    );
  }

  if (!matchedCat && categoryName) {
    matchedCat = categories.find(
      (c) => c.name.toLowerCase() === categoryName || categoryName.includes(c.name.toLowerCase())
    );
  }

  const defaultCatForType =
    categories.find((c) => c.type === type || c.type === 'both') || categories[0];
  const finalCat = matchedCat || defaultCatForType;

  return {
    amount,
    note,
    type,
    categoryId: finalCat?.id || '',
    rawText: transcript || note,
    transcript: transcript || undefined,
    walletId: matchedWallet?.id || 'wallet-cash',
    walletName: matchedWallet?.name || 'Tiền mặt',
  };
}

