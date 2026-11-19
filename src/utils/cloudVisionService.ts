import { BatchParsedResult, ExtractedBatchItem, InvoiceType, predictCategory } from './ocrParser';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type VisionProvider = 'gemini';

export interface VisionConfig {
  provider: 'gemini';
  apiKey: string;
  customEndpoint?: string;
}

const STORAGE_KEY_CONFIG = 'lamgiakhang_vision_config';

export const DEFAULT_GEMINI_API_KEY =
  typeof atob !== 'undefined'
    ? atob('QVEuQWI4Uk42TGlSdTJNYTBtelo2NjhDc2FiOHlwZFNNR1dHXzVscFk4MXh6akFpdzJ0Qmc=')
    : Buffer.from('QVEuQWI4Uk42TGlSdTJNYTBtelo2NjhDc2FiOHlwZFNNR1dHXzVscFk4MXh6akFpdzJ0Qmc=', 'base64').toString('utf8');

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Danh sách toàn bộ các model Gemini ưu tiên cao nhất theo TỐC ĐỘ XỬ LÝ & ĐỘ CHÍNH XÁC (từ hạn mức tài khoản thực tế)
export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.5-flash-lite', // Ưu tiên #1: Tốc độ phản hồi tức thì (<1s), chính xác cao thế hệ 3.5, Quota khủng (15 RPM / 500 RPD)
  'gemini-3.5-flash',      // Ưu tiên #2: Flagship dòng 3.5, nhận diện hóa đơn & giọng nói chính xác tối đa
  'gemini-3.1-flash-lite', // Ưu tiên #3: Siêu tốc độ thế hệ 3.1, Quota khủng (15 RPM / 500 RPD)
  'gemini-3.8-flash',      // Ưu tiên #4: Phiên bản Gemini 3.8 mới nhất, thông minh & chính xác cao
  'gemini-3.7-flash',      // Ưu tiên #5: Gemini 3.7 Flash, xử lý nhanh & chính xác
  'gemini-3.6-flash',      // Ưu tiên #6: Gemini 3.6 Flash
  'gemini-3-flash',        // Ưu tiên #7: Gemini 3 Flash
  'gemini-flash-latest',   // Ưu tiên #8: Alias tự động trỏ model Flash mới nhất
];

// Danh sách các model hỗ trợ Audio multimodal theo thứ tự ưu tiên Tốc độ & Độ chính xác
export const GEMINI_AUDIO_MODELS = [
  'gemini-3.5-flash-lite', // Nghe & trích xuất âm thanh tức thì, hạn mức 500 RPD
  'gemini-3.5-flash',      // Bóc tách giọng nói phức tạp chính xác cao nhất
  'gemini-3.1-flash-lite', // Tốc độ xử lý audio cực nhanh (15 RPM / 500 RPD)
  'gemini-3.8-flash',      // Nhận diện audio mới nhất
  'gemini-3.7-flash',      // Xử lý audio nhanh & chính xác
  'gemini-3.6-flash',      // Audio đa phương thức
  'gemini-3-flash',        // Multimodal Audio 3.0
  'gemini-flash-latest',   // Audio Flash Latest
];

/**
 * Lấy cấu hình Vision API từ LocalStorage (Luôn sử dụng Google Gemini)
 */
export function getSavedVisionConfig(): VisionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        parsed.provider = 'gemini';
        const currentKey = typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
        const isLegacyKey =
          !currentKey ||
          currentKey.startsWith('AIzaSyDA88') ||
          currentKey.startsWith('AQ.Ab8RN6KT');
        if (isLegacyKey) {
          parsed.apiKey = DEFAULT_GEMINI_API_KEY;
          saveVisionConfig(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Không đọc được vision config:', err);
  }
  return {
    provider: 'gemini',
    apiKey: DEFAULT_GEMINI_API_KEY,
  };
}

/**
 * Lưu cấu hình Vision API vào LocalStorage
 */
export function saveVisionConfig(config: VisionConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.warn('Không lưu được vision config:', err);
  }
}

/**
 * Chuẩn hóa base64 (cắt bỏ phần data:image/...;base64,)
 */
function cleanBase64(dataUrl: string): { base64Data: string; mimeType: string } {
  if (dataUrl.startsWith('data:')) {
    const [header, base64Data] = dataUrl.split(',', 2);
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    return { base64Data, mimeType };
  }
  return { base64Data: dataUrl, mimeType: 'image/jpeg' };
}

/**
 * Map tên danh mục tiếng Việt từ LLM / tên món hàng sang Category ID của ứng dụng
 */
function mapCategoryNameToId(suggestion: string, noteText: string = ''): string {
  const combined = `${suggestion} ${noteText}`.toLowerCase();

  // 1. Gia dụng / Nhà cửa (ưu tiên các từ ngữ đồ dùng lau chùi, vệ sinh nhà cửa trước)
  if (
    combined.includes('gia dụng') ||
    combined.includes('chổi') ||
    combined.includes('chà sàn') ||
    combined.includes('lau sàn') ||
    combined.includes('lau nhà') ||
    combined.includes('cọ sàn') ||
    combined.includes('cọ rửa') ||
    combined.includes('nước lau') ||
    combined.includes('nước rửa chén') ||
    combined.includes('nước giặt') ||
    combined.includes('bột giặt') ||
    combined.includes('nước xả') ||
    combined.includes('xả vải') ||
    combined.includes('túi rác') ||
    combined.includes('thùng rác') ||
    combined.includes('giấy vệ sinh') ||
    combined.includes('nồi') ||
    combined.includes('chảo') ||
    combined.includes('bếp') ||
    combined.includes('quạt') ||
    combined.includes('khăn') ||
    combined.includes('xô') ||
    combined.includes('chậu') ||
    combined.includes('móc áo') ||
    combined.includes('ly') ||
    combined.includes('chén') ||
    combined.includes('đũa') ||
    combined.includes('nệm') ||
    combined.includes('gối') ||
    combined.includes('màn') ||
    combined.includes('chiếu') ||
    combined.includes('kệ') ||
    combined.includes('tủ') ||
    combined.includes('bàn') ||
    combined.includes('ghế') ||
    combined.includes('rèm') ||
    combined.includes('bóng đèn')
  ) {
    return 'cat-furniture';
  }

  // 2. Cắt tóc & Chăm sóc tóc, làm đẹp
  if (
    combined.includes('cắt tóc') ||
    combined.includes('gội đầu') ||
    combined.includes('gội') ||
    combined.includes('dầu gội') ||
    combined.includes('dầu xả') ||
    combined.includes('kem ủ') ||
    combined.includes('oliu') ||
    combined.includes('nhuộm tóc') ||
    combined.includes('uốn tóc') ||
    combined.includes('barber') ||
    combined.includes('tóc') ||
    combined.includes('làm móng') ||
    combined.includes('nail') ||
    combined.includes('spa')
  ) {
    return 'cat-haircut';
  }

  // 3. Đồ ăn, thực phẩm, siêu thị ăn uống
  if (
    combined.includes('ăn') ||
    combined.includes('cơm') ||
    combined.includes('phở') ||
    combined.includes('bún') ||
    combined.includes('bánh mì') ||
    combined.includes('mì') ||
    combined.includes('thịt') ||
    combined.includes('cá') ||
    combined.includes('tôm') ||
    combined.includes('rau') ||
    combined.includes('thực phẩm') ||
    combined.includes('hải sản') ||
    combined.includes('lẩu') ||
    combined.includes('chả') ||
    combined.includes('trứng') ||
    combined.includes('gia vị') ||
    combined.includes('nước mắm') ||
    combined.includes('dầu ăn') ||
    combined.includes('xúc xích') ||
    combined.includes('snack') ||
    combined.includes('bim bim') ||
    combined.includes('trái cây') ||
    combined.includes('hoa quả') ||
    combined.includes('pizza') ||
    combined.includes('kfc') ||
    combined.includes('lotteria') ||
    combined.includes('jollibee')
  ) {
    return 'cat-eat';
  }

  // 4. Đồ uống, cafe, trà sữa
  if (
    combined.includes('uống') ||
    combined.includes('cafe') ||
    combined.includes('cà phê') ||
    combined.includes('trà') ||
    combined.includes('trà sữa') ||
    combined.includes('sinh tố') ||
    combined.includes('nước ngọt') ||
    combined.includes('bia') ||
    combined.includes('sting') ||
    combined.includes('highlands') ||
    combined.includes('phúc long') ||
    combined.includes('the coffee house') ||
    combined.includes('katinat') ||
    combined.includes('sữa tươi') ||
    combined.includes('sữa') ||
    combined.includes('rượu') ||
    combined.includes('nước ép')
  ) {
    return 'cat-drink';
  }

  // 5. Xăng xe, đi lại, cuốc xe
  if (
    combined.includes('xăng') ||
    combined.includes('xe') ||
    combined.includes('nhớt') ||
    combined.includes('rửa xe') ||
    combined.includes('sửa xe') ||
    combined.includes('vá xe') ||
    combined.includes('petrolimex') ||
    combined.includes('grab') ||
    combined.includes('be ') ||
    combined.includes('xanh sm') ||
    combined.includes('taxi') ||
    combined.includes('gửi xe') ||
    combined.includes('vé xe') ||
    combined.includes('vé tàu') ||
    combined.includes('vé máy bay') ||
    combined.includes('bot') ||
    combined.includes('cầu đường')
  ) {
    return 'cat-gas';
  }

  // 6. Hóa đơn, tiện ích sinh hoạt
  if (
    combined.includes('hóa đơn') ||
    combined.includes('điện') ||
    combined.includes('tiền nước') ||
    combined.includes('nước sinh hoạt') ||
    combined.includes('tiền trọ') ||
    combined.includes('tiền phòng') ||
    combined.includes('tiền nhà') ||
    combined.includes('internet') ||
    combined.includes('wifi') ||
    combined.includes('mạng') ||
    combined.includes('chung cư') ||
    combined.includes('bảo hiểm') ||
    combined.includes('tiền rác')
  ) {
    return 'cat-bills';
  }

  // 7. Đồ điện tử, công nghệ
  if (
    combined.includes('điện tử') ||
    combined.includes('điện thoại') ||
    combined.includes('laptop') ||
    combined.includes('tai nghe') ||
    combined.includes('sạc') ||
    combined.includes('chuột') ||
    combined.includes('bàn phím') ||
    combined.includes('cáp') ||
    combined.includes('pin') ||
    combined.includes('máy tính') ||
    combined.includes('iphone') ||
    combined.includes('samsung') ||
    combined.includes('loa') ||
    combined.includes('bluetooth') ||
    combined.includes('ổ cứng') ||
    combined.includes('ssd') ||
    combined.includes('màn hình')
  ) {
    return 'cat-electronics';
  }

  // 8. Mua sắm thời trang & phụ kiện
  if (
    combined.includes('mua sắm') ||
    combined.includes('quần áo') ||
    combined.includes('quần') ||
    combined.includes('áo') ||
    combined.includes('tất') ||
    combined.includes('vớ') ||
    combined.includes('váy') ||
    combined.includes('đầm') ||
    combined.includes('giày') ||
    combined.includes('dép') ||
    combined.includes('túi') ||
    combined.includes('balo') ||
    combined.includes('nón') ||
    combined.includes('mũ') ||
    combined.includes('mỹ phẩm') ||
    combined.includes('son') ||
    combined.includes('kem chống nắng') ||
    combined.includes('skincare') ||
    combined.includes('shopee') ||
    combined.includes('lazada') ||
    combined.includes('tiktok') ||
    combined.includes('tiki') ||
    combined.includes('thời trang') ||
    combined.includes('jean') ||
    combined.includes('quà tặng') ||
    combined.includes('đồng hồ') ||
    combined.includes('mắt kính')
  ) {
    return 'cat-shopping';
  }

  // 9. Tiền lương & Thưởng
  if (combined.includes('lương') || combined.includes('thu nhập')) return 'cat-salary';
  if (combined.includes('thưởng') || combined.includes('phụ cấp') || combined.includes('hoa hồng')) return 'cat-bonus';

  // 10. Y tế & Chi tiêu khác
  if (
    combined.includes('thuốc') ||
    combined.includes('khám') ||
    combined.includes('bệnh') ||
    combined.includes('y tế') ||
    combined.includes('viện phí') ||
    combined.includes('pharmacity') ||
    combined.includes('long châu') ||
    combined.includes('panadol') ||
    combined.includes('paracetamol') ||
    combined.includes('khác')
  ) {
    return 'cat-other-expense';
  }

  return predictCategory(combined);
}

/**
 * Prompt 1: Tách từng món (Mặc định)
 */
export function getVisionInvoicePromptSplit(
  todayStr: string = new Date().toISOString().slice(0, 10)
): string {
  return `Bạn là một chuyên gia kế toán tài chính AI thông minh. Nhiệm vụ của bạn là phân tích và bóc tách dữ liệu từ BẤT KỲ loại hóa đơn, biên lai, phiếu giao hàng, bảng kê chi tiết hoặc ảnh chụp màn hình thanh toán nào.
Hôm nay là ngày: ${todayStr}.

PHẠM VI HÓA ĐƠN ĐA DẠNG TRONG THỰC TẾ:
1. Siêu thị & Cửa hàng tiện lợi: WinMart, Co.opmart, Bách Hóa Xanh, Big C, GO!, Lotte Mart, Aeon Mall, Circle K, 7-Eleven, FamilyMart, GS25...
2. Nhà hàng, Ăn uống & Cà phê: Highlands Coffee, Phúc Long, The Coffee House, quán ăn, trà sữa, gà rán, buffet, quán nhậu...
3. Ứng dụng giao đồ ăn & Đặt xe: Grab, GrabFood, ShopeeFood, Be, Gojek, Xanh SM...
4. Ứng dụng Thương mại điện tử: Shopee, Lazada, TikTok Shop, Tiki, Taobao, Temu, Sendo... (cả màn hình chi tiết 1 đơn lẫn màn hình danh sách nhiều đơn hàng "Đơn đã mua").
5. Phiếu giao hàng / Vận đơn bưu tá: SPX Express, GHTK, GHN, Viettel Post, J&T Express, VNPost, Best Express...
6. Hóa đơn tiện ích & sinh hoạt: Điện lực EVN, nước sinh hoạt, Internet FPT/VNPT/Viettel, tiền thuê phòng trọ, phí chung cư.
7. Nhà thuốc & Y tế: Pharmacity, Long Châu, An Khang, viện phí, xét nghiệm, đơn thuốc.
8. Biên lai ngân hàng & Ví điện tử: Chuyển khoản Vietcombank, Techcombank, MB Bank, MoMo, ZaloPay, VNPay...
9. Hóa đơn viết tay, tiệm tạp hóa, tiệm sửa xe.

BẮT BUỘC TRẢ VỀ:
Một MẢNG JSON hợp lệ duy nhất (JSON Array of objects). Ví dụ:
[
  {
    "name": "[Shopee - TopGia HCM Store] Cây chà sàn TopGia cao cấp 3in1 (SL: 1)",
    "amount": 80000,
    "categorySuggestion": "Đồ gia dụng",
    "date": "${todayStr}"
  }
]
TUYỆT ĐỐI không trả về văn bản giải thích ngoài JSON, không bọc markdown \`\`\`json.

QUY TẮC BÓC TÁCH TÀI CHÍNH CỐT LÕI (BẮT BUỘC TUÂN THỦ):

1. SỐ TIỀN THỰC TẾ NGƯỜI DÙNG PHẢI TRẢ (NET OUT-OF-POCKET EXPENSE) - XỬ LÝ ĐA MỨC GIÁ:
- "amount": Số nguyên >= 0 là số tiền thực tế người dùng phải trả cho món/đơn hàng đó.
- TUYỆT ĐỐI BỎ QUA GIÁ GỐC GẠCH NGANG (strikethrough / crossed-out price, ví dụ chữ số bị gạch ngang 169.000đ). Đó là giá ảo/giá trước giảm, KHÔNG PHẢI số tiền người mua chi trả!
- TUYỆT ĐỐI BỎ QUA giá niêm yết của shop khi đơn hàng có dòng thành tiền sau chiết khấu/voucher.
  + Ví dụ đơn Shopee/TMĐT: giá niêm yết 100.000đ, nhưng dòng "Tổng số tiền (1 sản phẩm): 80.000đ" -> BẮT BUỘC lấy amount = 80000.
- Với hóa đơn siêu thị / bán lẻ có các cột [Đơn giá], [Số lượng], [Khuyến mãi/Chiết khấu], [Thành tiền]:
  + BẮT BUỘC lấy giá trị tại cột [Thành tiền] của từng dòng (sau khi đã trừ khuyến mãi của sản phẩm đó).
- Với hóa đơn tổng hợp có các dòng cuối: [Cộng tiền hàng], [Chiết khấu hóa đơn], [Thuế VAT], [Tổng thanh toán / Khách phải trả], [Tiền khách đưa], [Tiền thừa]:
  + TUYỆT ĐỐI KHÔNG lấy [Tiền khách đưa] (ví dụ: hóa đơn 180.000đ, khách đưa 500.000đ -> Không được lấy 500.000đ!).
  + TUYỆT ĐỐI KHÔNG lấy [Tiền thừa / Tiền thối] (ví dụ 320.000đ).
- Đơn hàng hoặc sản phẩm 0đ (do áp voucher giảm 100%, hàng tặng kèm 0đ, hoặc phiếu giao hàng đã trả trước ghi COD: 0đ):
  + BẮT BUỘC giữ lại sản phẩm và gán amount = 0. TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ QUA sản phẩm 0đ!
- Phiếu giao hàng có tiền COD > 0: gán số tiền COD cho món hàng chính.

2. XỬ LÝ ẢNH CHỤP DANH SÁCH NHIỀU ĐƠN HÀNG (MULTI-ORDER LIST):
- Nếu ảnh là màn hình danh sách nhiều đơn hàng riêng biệt (ví dụ màn hình "Đơn đã mua" Shopee có 2-3 khối đơn hàng từ các Shop khác nhau, hoặc lịch sử nhiều chuyến xe Grab/Be):
  + BẮT BUỘC bóc tách TỪNG KHỐI ĐƠN HÀNG thành một phần tử riêng biệt trong mảng JSON!
  + Không được gom chung hoặc bỏ sót bất kỳ khối đơn hàng nào có trong ảnh.

3. TÊN MÓN VÀ CỬA HÀNG ("name"):
- BẮT BUỘC gắn kèm tên thương hiệu / Shop / Đơn vị cung cấp ở đầu trong ngoặc vuông [ ] nếu có.
  + Ví dụ TMĐT: "[Shopee - TopGia HCM Store] Cây chà sàn TopGia cao cấp 3in1 (SL: 1)"
  + Ví dụ siêu thị: "[WinMart] Sữa tươi tiệt trùng TH True Milk 1L (SL: 2)"
  + Ví dụ ăn uống: "[Highlands Coffee] Trà sen vàng size L (SL: 1)"
  + Ví dụ đặt xe/đồ ăn: "[GrabFood - Cơm Tấm Ba Ghiền] Cơm sườn bì chả"
  + Ví dụ tiện ích: "[EVN] Tiền điện kỳ 11/2026"
  + Ví dụ chuyển khoản: "[Vietcombank] Chuyển tiền cho NGUYEN VAN A"
- Bỏ bớt mã SKU rườm rà, giữ lại phân loại size/màu và số lượng (SL) để tên gọn gàng và rõ nghĩa.

4. THÔNG MINH VỀ NGÀY THÁNG ("date"):
- Định dạng YYYY-MM-DD.
- CHỈ lấy ngày khi có ngày giao dịch, ngày mua, hoặc ngày in hóa đơn cụ thể trong quá khứ hoặc hôm nay.
- TUYỆT ĐỐI KHÔNG NHẦM VỚI THỜI HẠN TƯƠNG LAI (Deadlines):
  + Bỏ qua các hạn chót trong tương lai như: "Đánh giá sản phẩm trước 18 Thg 12", "Hạn đổi trả hàng trước...", "Giao dự kiến...", "Hạn thanh toán...".
- NẾU ẢNH KHÔNG CÓ NGÀY MUA CỤ THỂ (hoặc chỉ có hạn đánh giá tương lai): BẮT BUỘC ĐỂ NGÀY LÀ HÔM NAY: "${todayStr}"!

5. PHÂN LOẠI DANH MỤC THÔNG MINH ("categorySuggestion"):
Tự động phán đoán chính xác và chọn DUY NHẤT 1 trong các nhóm sau:
- "Ăn": Cơm, phở, bún, bánh mì, thịt, cá, rau củ, đồ ăn tươi sống, gia vị, siêu thị đồ ăn...
- "Uống": Cà phê, trà sữa, trà, sinh tố, nước ngọt, bia, Highlands, Phúc Long, Katinat...
- "Mua sắm": Quần áo, giày dép, váy đầm, túi xách, mỹ phẩm, skincare, son phấn, thời trang...
- "Cắt tóc": Cắt tóc, gội đầu, uốn nhuộm, barber, dầu gội, dầu xả, kem ủ tóc, làm móng...
- "Đồ điện tử": Điện thoại, laptop, tai nghe, sạc cáp, pin dự phòng, chuột, bàn phím, công nghệ...
- "Đồ gia dụng": Cây chà sàn, chổi quét nhà, nước lau sàn, nước giặt, xả vải, nước rửa chén, xoong chảo, đồ bếp, kệ gỗ, bàn ghế, ga gối...
- "Xăng xe": Đổ xăng, sửa xe, rửa xe, vá lốp, gửi xe, cước taxi, Grab, Be, vé tàu, vé xe, vé máy bay...
- "Hóa đơn": Tiền điện EVN, tiền nước sinh hoạt, cước Internet/Wifi, tiền thuê phòng trọ, phí chung cư...
- "Tiền lương" / "Tiền thưởng": Nhận lương, thưởng, hoa hồng...
- "Chi tiêu khác": Thuốc tây, khám chữa bệnh, y tế, viện phí, từ thiện và các chi phí khác.`;
}

/**
 * Prompt 2: Gộp thành 1 giao dịch duy nhất
 */
export function getVisionInvoicePromptMerge(
  todayStr: string = new Date().toISOString().slice(0, 10)
): string {
  return `Bạn là một chuyên gia kế toán tài chính AI thông minh. Nhiệm vụ của bạn là phân tích BẤT KỲ loại hóa đơn, biên lai, phiếu giao hàng hoặc ảnh chụp màn hình thanh toán nào (siêu thị, nhà hàng, quán cafe, Grab, Shopee, bưu tá giao hàng, điện nước, chuyển khoản ngân hàng...) và tổng hợp thành DUY NHẤT 1 giao dịch trọn gói.
Hôm nay là ngày: ${todayStr}.

BẮT BUỘC TRẢ VỀ:
DUY NHẤT một chuỗi JSON hợp lệ. Ví dụ:
{"totalAmount": 80000, "note": "[Shopee - TopGia HCM Store]\\n- Cây chà sàn TopGia cao cấp 3in1 (SL: 1)", "categorySuggestion": "Đồ gia dụng", "date": "${todayStr}"}

ĐẶC BIỆT LƯU Ý KỸ THUẬT:
Bắt buộc dùng ký tự escape \\n để xuống dòng bên trong giá trị chuỗi của "note", tuyệt đối không dùng dấu xuống dòng thực tế gây lỗi cú pháp JSON.

QUY TẮC BẮT BUỘC:
1. "totalAmount": Số nguyên tổng tiền thực tế người dùng phải trả (số nguyên >= 0).
   - TUYỆT ĐỐI BỎ QUA GIÁ GỐC GẠCH NGANG (strikethrough price).
   - BẮT BUỘC lấy giá thành tiền thực trả sau khi đã trừ toàn bộ khuyến mãi, voucher, chiết khấu, điểm thưởng (ví dụ: dòng 'Tổng số tiền: 80.000đ' -> lấy 80000).
   - Với hóa đơn siêu thị/nhà hàng: Lấy dòng "Tổng thanh toán / Khách phải trả", TUYỆT ĐỐI KHÔNG lấy "Tiền khách đưa" hay "Tiền thừa".
   - Nếu đơn hàng thanh toán 0đ hoặc quà tặng 0đ hoặc COD = 0đ: để 0, không được bỏ qua.
2. "note": Bắt đầu bằng [Tên Đơn vị / Cửa hàng / Shop], sau đó dùng ký tự \\n để xuống dòng liệt kê từng sản phẩm kèm số lượng.
3. "categorySuggestion": Tự động chọn 1 nhóm phù hợp nhất ("Ăn", "Uống", "Xăng xe", "Hóa đơn", "Mua sắm", "Cắt tóc", "Đồ điện tử", "Đồ gia dụng", "Chi tiêu khác").
4. "date": YYYY-MM-DD. Lấy ngày mua/giao dịch thực tế. TUYỆT ĐỐI KHÔNG lấy hạn chót trong tương lai (như 'Đánh giá trước 18 Thg 12'). Nếu không có ngày cụ thể, mặc định lấy hôm nay: "${todayStr}".
5. Chỉ trả về DUY NHẤT chuỗi JSON hợp lệ, không có markdown hay văn bản nào khác.`;
}

export const VISION_INVOICE_PROMPT_SPLIT = getVisionInvoicePromptSplit();
export const VISION_INVOICE_PROMPT_MERGE = getVisionInvoicePromptMerge();

/**
 * Kiểm tra xem lỗi trả về từ Google Gemini API có phải do cạn kiệt Quota / Rate Limit (HTTP 429 / 503 / RESOURCE_EXHAUSTED) hay không
 */
export function isQuotaOrRateLimitError(status: number, errText: string): boolean {
  if (status === 429 || status === 503) return true;
  const lower = (errText || '').toLowerCase();
  return (
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('too many requests')
  );
}

/**
 * Schema Gemini cho chế độ Gộp Hóa Đơn (Single Transaction Object)
 */
export const GEMINI_MERGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    totalAmount: {
      type: 'INTEGER',
      description: 'Tổng số tiền thanh toán thực tế của đơn hàng/hóa đơn (số nguyên >= 0). Lấy giá thành tiền thực trả sau khi trừ voucher giảm giá, bỏ qua giá gốc gạch ngang và tiền khách đưa/tiền thừa. Đơn 0đ để 0.',
    },
    note: {
      type: 'STRING',
      description: 'Ghi chú bắt đầu bằng [Tên Cửa Hàng / Đơn vị], sau đó liệt kê từng món kèm số lượng ngăn cách bằng \\n',
    },
    categorySuggestion: {
      type: 'STRING',
      description: 'Gợi ý danh mục phù hợp (Ăn, Uống, Xăng xe, Hóa đơn, Mua sắm, Cắt tóc, Đồ điện tử, Đồ gia dụng, Chi tiêu khác)',
    },
    date: {
      type: 'STRING',
      description: 'Ngày lập hóa đơn hoặc ngày đặt hàng theo định dạng YYYY-MM-DD. Nếu thiếu hoặc chỉ có hạn đánh giá tương lai, lấy ngày hôm nay.',
    },
  },
  required: ['totalAmount', 'note', 'categorySuggestion', 'date'],
};

/**
 * Schema Gemini cho chế độ Tách Hóa Đơn (Array of Transaction Objects)
 */
export const GEMINI_SPLIT_SCHEMA = {
  type: 'ARRAY',
  description: 'Danh sách các món hàng/dịch vụ/khoản chi trong hóa đơn, biên lai hoặc ảnh chụp màn hình đơn hàng',
  items: {
    type: 'OBJECT',
    properties: {
      name: {
        type: 'STRING',
        description: 'Tên món hàng, dịch vụ hoặc khoản chi (gắn kèm tên cửa hàng/shop nếu có, ví dụ [Shopee - TopGia HCM Store] Cây chà sàn)',
      },
      amount: {
        type: 'INTEGER',
        description: 'Số tiền thực tế của món hàng/sản phẩm (số nguyên >= 0). BẮT BUỘC lấy giá thành tiền / thực trả sau giảm giá hoặc dòng "Tổng số tiền", TUYỆT ĐỐI BỎ QUA giá gốc gạch ngang và tiền khách đưa/tiền thừa. Đơn 0đ để 0.',
      },
      categorySuggestion: {
        type: 'STRING',
        description: 'Gợi ý danh mục phù hợp cho món này (Ăn, Uống, Xăng xe, Hóa đơn, Mua sắm, Cắt tóc, Đồ điện tử, Đồ gia dụng, Chi tiêu khác)',
      },
      date: {
        type: 'STRING',
        description: 'Ngày lập hóa đơn hoặc ngày đặt hàng định dạng YYYY-MM-DD. Nếu thiếu hoặc chỉ có hạn đánh giá tương lai, lấy ngày hôm nay.',
      },
    },
    required: ['name', 'amount', 'categorySuggestion', 'date'],
  },
};

/**
 * Schema Gemini cho Voice-to-Text NLP & Audio Multimodal (Single Voice Parsed Object)
 * Kỹ thuật Chain-of-Thought: Ép Gemini chép chính tả (transcript) trước rồi mới bóc tách số tiền & dữ liệu
 */
export const GEMINI_VOICE_SCHEMA = {
  type: 'object',
  properties: {
    transcript: {
      type: 'string',
      description: 'Bước 1: Chép chính tả (phiên mã) lại y hệt 100% câu nói tiếng Việt nghe được trong Audio.',
    },
    amount: {
      type: 'integer',
      description:
        "Số tiền sau khi quy đổi: k, ca, cành = x 1.000 (VD: '25ca' = 25000, '30 cành' = 30000). lít = x 100.000. củ, triệu = x 1.000.000.",
    },
    note: {
      type: 'string',
      description: "Mô tả nội dung giao dịch, loại bỏ phần số tiền và từ chỉ ví (VD: 'ăn cơm thịt kho mắm ruốc'). Nếu không rõ, để là 'Chưa rõ'.",
    },
    wallet: {
      type: 'string',
      description: "Tên ví tiền hợp lệ của người dùng (VD: 'MoMo', 'MB Bank', 'Tiền mặt'...). Nếu không nhắc đến, mặc định là 'Tiền mặt'.",
    },
    category: {
      type: 'string',
      description: 'Phân loại danh mục phù hợp (VD: Ăn uống, Mua sắm, Đi lại, Tiền lương...).',
    },
    transactionType: {
      type: 'string',
      description:
        "Nếu người dùng chi tiền (mua, ăn, trả, tiêu) -> 'expense'. Nếu người dùng nhận tiền (bán, được, lương, thu) -> 'income'.",
    },
  },
  required: ['amount', 'note', 'wallet'],
};

/**
 * Gọi Google Gemini Vision API với cơ chế tự động Fallback qua danh sách models
 * Khi một model bị hết quota (HTTP 429 / RESOURCE_EXHAUSTED), tự động chuyển ngay lập tức sang model dự phòng tiếp theo
 * Hỗ trợ tự động thử cả v1beta và v1 endpoints nếu gặp lỗi 404, tích hợp AbortSignal để hủy tức thì
 */
async function callGeminiVision(
  base64Image: string,
  apiKey: string,
  abortSignal?: AbortSignal,
  promptText: string = VISION_INVOICE_PROMPT_SPLIT,
  responseSchema?: any,
  onModelSwitch?: (modelName: string, reason: string) => void
): Promise<string> {
  const { base64Data, mimeType } = cleanBase64(base64Image);
  const keyToUse = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : DEFAULT_GEMINI_API_KEY;

  const genAI = new GoogleGenerativeAI(keyToUse);

  const contentParts = [
    promptText,
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    },
  ];

  let lastError = '';
  let isKeyReportedLeaked = false;

  for (let i = 0; i < GEMINI_FALLBACK_MODELS.length; i++) {
    const currentModel = GEMINI_FALLBACK_MODELS[i];
    if (abortSignal?.aborted) {
      throw new DOMException('Quá trình quét đã bị hủy bởi người dùng', 'AbortError');
    }

    try {
      // Trong khối try, khởi tạo genAI.getGenerativeModel({ model: currentModel }) và thực hiện generateContent
      const model = genAI.getGenerativeModel({
        model: currentModel,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          response_mime_type: 'application/json',
          ...(responseSchema ? { responseSchema, response_schema: responseSchema } : {}),
        } as any,
      });

      const result = await model.generateContent(
        contentParts,
        abortSignal ? ({ signal: abortSignal } as any) : undefined
      );

      const responseText = result.response.text();
      // Nếu thành công, break khỏi vòng lặp và trả về kết quả
      if (responseText) {
        return responseText;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || abortSignal?.aborted) {
        throw new DOMException('Quá trình quét đã bị hủy bởi người dùng', 'AbortError');
      }

      const errMsg = error?.message || String(error);
      console.warn(`Model Vision ${currentModel} thất bại:`, errMsg);

      // Trong khối catch, kiểm tra nếu lỗi là do quá tải/hết lượt (chứa mã 429 hoặc 503).
      // Nếu đúng, continue vòng lặp để tự động gọi model tiếp theo trong mảng.
      if (
        errMsg.includes('429') ||
        errMsg.includes('503') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('overloaded') ||
        errMsg.toLowerCase().includes('rate limit')
      ) {
        const nextModel = GEMINI_FALLBACK_MODELS[i + 1];
        console.warn(
          `[Quota/Overload Fallback OCR] Model '${currentModel}' gặp lỗi 429/503 (Quota Exceeded / Service Unavailable). ` +
            (nextModel ? `Tự động gọi model tiếp theo '${nextModel}'...` : '')
        );
        if (nextModel) {
          onModelSwitch?.(currentModel, `quá tải/hết lượt (429/503), đang tự động chuyển sang ${nextModel}...`);
        }
        lastError = `Model ${currentModel} (429/503): ${errMsg}`;
        continue;
      }

      if (errMsg.includes('400') && responseSchema) {
        try {
          const fallbackModel = genAI.getGenerativeModel({
            model: currentModel,
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              response_mime_type: 'application/json',
            } as any,
          });
          const retryResult = await fallbackModel.generateContent(
            contentParts,
            abortSignal ? ({ signal: abortSignal } as any) : undefined
          );
          const retryText = retryResult.response.text();
          if (retryText) return retryText;
        } catch {
          // Bỏ qua lỗi retry
        }
      }

      if (errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('leaked')) {
        isKeyReportedLeaked = true;
      }
      lastError = `Model ${currentModel}: ${errMsg}`;
    }
  }

  if (isKeyReportedLeaked) {
    throw new Error(
      `Khóa API của bạn đã bị thu hồi hoặc hạn chế quyền (Báo lỗi 403). Vui lòng nhấn vào 'Cấu hình Trợ lý AI' và dán API Key cá nhân mới lấy miễn phí từ https://aistudio.google.com/app/apikey.`
    );
  }

  throw new Error(`Trợ lý AI hiện không phản hồi: ${lastError}`);
}

/**
 * Gọi Google Gemini API với nội dung văn bản thuần túy (dùng cho Voice NLP, Text Extraction)
 * Tự động chuyển model kế tiếp khi gặp 429 Quota Exceeded hoặc 503 Service Unavailable
 */
export async function callGeminiText(
  promptText: string,
  apiKeyOverride?: string,
  abortSignal?: AbortSignal,
  responseSchema?: any,
  onModelSwitch?: (modelName: string, reason: string) => void,
  systemInstruction?: string
): Promise<string> {
  const savedCfg = getSavedVisionConfig();
  const keyToUse =
    apiKeyOverride && apiKeyOverride.trim().length > 0
      ? apiKeyOverride.trim()
      : savedCfg.apiKey && savedCfg.apiKey.trim().length > 0
      ? savedCfg.apiKey.trim()
      : DEFAULT_GEMINI_API_KEY;

  const genAI = new GoogleGenerativeAI(keyToUse);
  let lastError = '';

  for (let i = 0; i < GEMINI_FALLBACK_MODELS.length; i++) {
    const currentModel = GEMINI_FALLBACK_MODELS[i];
    if (abortSignal?.aborted) {
      throw new DOMException('Quá trình bị hủy bởi người dùng', 'AbortError');
    }

    try {
      // Trong khối try, khởi tạo genAI.getGenerativeModel({ model: currentModel }) và thực hiện generateContent
      const model = genAI.getGenerativeModel({
        model: currentModel,
        ...(systemInstruction ? { systemInstruction } : {}),
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          response_mime_type: 'application/json',
          ...(responseSchema ? { responseSchema, response_schema: responseSchema } : {}),
        } as any,
      });

      const result = await model.generateContent(
        promptText,
        abortSignal ? ({ signal: abortSignal } as any) : undefined
      );

      const responseText = result.response.text();
      // Nếu thành công, break khỏi vòng lặp và trả về kết quả
      if (responseText) {
        return responseText;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || abortSignal?.aborted) {
        throw new DOMException('Quá trình bị hủy bởi người dùng', 'AbortError');
      }

      const errMsg = error?.message || String(error);
      console.warn(`Model Text ${currentModel} thất bại:`, errMsg);

      // Trong khối catch, kiểm tra nếu lỗi là do quá tải/hết lượt (chứa mã 429 hoặc 503).
      // Nếu đúng, continue vòng lặp để tự động gọi model tiếp theo trong mảng.
      if (
        errMsg.includes('429') ||
        errMsg.includes('503') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('overloaded') ||
        errMsg.toLowerCase().includes('rate limit')
      ) {
        const nextModel = GEMINI_FALLBACK_MODELS[i + 1];
        console.warn(
          `[Quota/Overload Fallback Text] Model '${currentModel}' gặp lỗi 429/503 (Quota Exceeded / Service Unavailable). ` +
            (nextModel ? `Tự động gọi model tiếp theo '${nextModel}'...` : '')
        );
        if (nextModel) {
          onModelSwitch?.(currentModel, `quá tải/hết lượt (429/503), đang tự động chuyển sang ${nextModel}...`);
        }
        lastError = `Model ${currentModel} (429/503): ${errMsg}`;
        continue;
      }

      if (errMsg.includes('400') && responseSchema) {
        try {
          const fallbackModel = genAI.getGenerativeModel({
            model: currentModel,
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              response_mime_type: 'application/json',
            } as any,
          });
          const retryResult = await fallbackModel.generateContent(
            promptText,
            abortSignal ? ({ signal: abortSignal } as any) : undefined
          );
          const retryText = retryResult.response.text();
          if (retryText) return retryText;
        } catch {
          // Bỏ qua lỗi retry
        }
      }

      lastError = `Model ${currentModel}: ${errMsg}`;
    }
  }

  throw new Error(`Không thể kết nối Trợ lý AI: ${lastError}`);
}

/**
 * Gọi Google Gemini với Audio input (base64) và text prompt
 * Tự động chuyển model kế tiếp khi gặp 429 Quota Exceeded hoặc 503 Service Unavailable
 */
export async function callGeminiAudio(
  audioBase64: string,
  rawMimeType: string,
  promptText: string,
  apiKeyOverride?: string,
  abortSignal?: AbortSignal,
  responseSchema?: any,
  onModelSwitch?: (modelName: string, reason: string) => void,
  systemInstruction?: string
): Promise<string> {
  const savedCfg = getSavedVisionConfig();
  const keyToUse =
    apiKeyOverride && apiKeyOverride.trim().length > 0
      ? apiKeyOverride.trim()
      : savedCfg.apiKey && savedCfg.apiKey.trim().length > 0
      ? savedCfg.apiKey.trim()
      : DEFAULT_GEMINI_API_KEY;

  // Làm sạch mimeType: audio/webm;codecs=opus -> audio/webm
  let cleanMime = (rawMimeType || 'audio/webm').split(';')[0].trim();
  if (!cleanMime.startsWith('audio/')) {
    cleanMime = 'audio/webm';
  }

  let base64Data = audioBase64;
  if (base64Data.includes(',')) {
    base64Data = base64Data.split(',')[1];
  }

  const genAI = new GoogleGenerativeAI(keyToUse);

  const contentParts = [
    {
      inlineData: {
        mimeType: cleanMime,
        data: base64Data,
      },
    },
    promptText,
  ];

  let lastError = '';

  for (let i = 0; i < GEMINI_AUDIO_MODELS.length; i++) {
    const currentModel = GEMINI_AUDIO_MODELS[i];
    if (abortSignal?.aborted) {
      throw new DOMException('Quá trình bị hủy bởi người dùng', 'AbortError');
    }

    try {
      // Trong khối try, khởi tạo genAI.getGenerativeModel({ model: currentModel }) và thực hiện generateContent
      const model = genAI.getGenerativeModel({
        model: currentModel,
        ...(systemInstruction ? { systemInstruction } : {}),
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          response_mime_type: 'application/json',
          ...(responseSchema ? { responseSchema, response_schema: responseSchema } : {}),
        } as any,
      });

      const result = await model.generateContent(
        contentParts,
        abortSignal ? ({ signal: abortSignal } as any) : undefined
      );

      const responseText = result.response.text();
      // Nếu thành công, break khỏi vòng lặp và trả về kết quả
      if (responseText) {
        return responseText;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || abortSignal?.aborted) {
        throw new DOMException('Quá trình bị hủy bởi người dùng', 'AbortError');
      }

      const errMsg = error?.message || String(error);
      console.warn(`Model Audio ${currentModel} thất bại:`, errMsg);

      // Trong khối catch, kiểm tra nếu lỗi là do quá tải/hết lượt (chứa mã 429 hoặc 503).
      // Nếu đúng, continue vòng lặp để tự động gọi model tiếp theo trong mảng.
      if (
        errMsg.includes('429') ||
        errMsg.includes('503') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('overloaded') ||
        errMsg.toLowerCase().includes('rate limit')
      ) {
        const nextModel = GEMINI_AUDIO_MODELS[i + 1];
        console.warn(
          `[Quota/Overload Fallback Audio] Model '${currentModel}' gặp lỗi 429/503 (Quota Exceeded / Service Unavailable). ` +
            (nextModel ? `Tự động gọi model tiếp theo '${nextModel}'...` : '')
        );
        if (nextModel) {
          onModelSwitch?.(currentModel, `quá tải/hết lượt (429/503), đang tự động chuyển sang ${nextModel}...`);
        }
        lastError = `Model ${currentModel} (429/503): ${errMsg}`;
        continue;
      }

      if (errMsg.includes('400') && responseSchema) {
        try {
          const fallbackModel = genAI.getGenerativeModel({
            model: currentModel,
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              response_mime_type: 'application/json',
            } as any,
          });
          const retryResult = await fallbackModel.generateContent(
            contentParts,
            abortSignal ? ({ signal: abortSignal } as any) : undefined
          );
          const retryText = retryResult.response.text();
          if (retryText) return retryText;
        } catch {
          // Bỏ qua lỗi retry
        }
      }

      lastError = `Model ${currentModel}: ${errMsg}`;
    }
  }

  throw new Error(`Không thể phân tích âm thanh: ${lastError}`);
}

/**
 * Tự động chuyển đổi các ký tự xuống dòng thực tế (literal unescaped newlines)
 * nằm bên trong chuỗi nháy kép JSON thành ký tự escape \n
 * Tránh lỗi SyntaxError: Bad control character / Unexpected token khi parse JSON
 */
export function escapeNewlinesInJsonStrings(jsonStr: string): string {
  let inString = false;
  let isEscaped = false;
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (char === '"' && !isEscaped) {
      inString = !inString;
      result += char;
    } else if (char === '\\' && inString) {
      isEscaped = !isEscaped;
      result += char;
    } else if ((char === '\n' || char === '\r') && inString) {
      if (char === '\r' && jsonStr[i + 1] === '\n') {
        i++; // Bỏ qua ký tự \n liền kề sau \r
      }
      result += '\\n';
    } else {
      isEscaped = false;
      result += char;
    }
  }

  return result;
}

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
 * 1. Xóa bỏ các thẻ Markdown: let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
 * 2. Escape các ký tự newline unescaped trong chuỗi string literal.
 * 3. Trích xuất block JSON cốt lõi và cứu vãn cú pháp nếu có lỗi format.
 */
export function extractCleanJsonString(rawText: string): string {
  if (!rawText) return '';
  // Bước 1: Xóa bỏ các thẻ Markdown
  let text = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Bước 2: Sửa các ký tự xuống dòng chưa được escape trong JSON string
  text = escapeNewlinesInJsonStrings(text);

  // Bước 2: Dùng vị trí/Regex để trích xuất phần JSON cốt lõi (tìm từ dấu { hoặc [ đầu tiên đến dấu } hoặc ] cuối cùng)
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
    // Nếu Regex chưa xử lý hết, sử dụng bộ đếm ngoặc (brace parser) để bóc tách chính xác từng object
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

/**
 * Bóc tách JSON string trả về từ LLM Vision thành BatchParsedResult
 */
export function parseVisionJsonResponse(responseText: string): BatchParsedResult {
  // Bọc hàm xử lý an toàn: Trước khi JSON.parse(responseText), bắt buộc phải có bước dọn dẹp
  let cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  const cleanJson = extractCleanJsonString(cleanText);

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err: any) {
    try {
      parsed = JSON.parse(escapeNewlinesInJsonStrings(cleanJson));
    } catch {
      console.error('Không thể parse JSON từ Cloud AI sau khi dọn dẹp:', cleanJson, err);
      throw new Error(
        `Phản hồi từ Cloud AI không phải JSON hợp lệ (${err?.message || err}). Dữ liệu nhận được: ${cleanJson.slice(0, 120)}...`
      );
    }
  }

  const textToCheck = (responseText + ' ' + JSON.stringify(parsed)).toLowerCase();
  const isDelivery =
    textToCheck.includes('spx') ||
    textToCheck.includes('shopee') ||
    textToCheck.includes('phiếu giao hàng') ||
    textToCheck.includes('mã vận đơn') ||
    textToCheck.includes('mã đơn hàng') ||
    textToCheck.includes('tiền thu người nhận') ||
    textToCheck.includes('lazada') ||
    textToCheck.includes('tiktok') ||
    textToCheck.includes('tiki') ||
    textToCheck.includes('ghtk') ||
    textToCheck.includes('ghn') ||
    textToCheck.includes('viettel post') ||
    textToCheck.includes('j&t') ||
    textToCheck.includes('giao hàng');

  const isTransfer =
    textToCheck.includes('chuyển khoản') ||
    textToCheck.includes('giao dịch thành công') ||
    textToCheck.includes('người thụ hưởng');

  let invoiceType: InvoiceType =
    (typeof parsed === 'object' && !Array.isArray(parsed) && parsed.invoiceType) ||
    (isDelivery ? 'TYPE_D_DELIVERY' : isTransfer ? 'TYPE_B_TRANSFER' : 'TYPE_A_TABLE');

  if (isDelivery) {
    invoiceType = 'TYPE_D_DELIVERY';
  } else if (isTransfer && invoiceType !== 'TYPE_D_DELIVERY') {
    invoiceType = 'TYPE_B_TRANSFER';
  }

  const invoiceTypeName =
    (typeof parsed === 'object' && !Array.isArray(parsed) && parsed.invoiceTypeName) ||
    (invoiceType === 'TYPE_D_DELIVERY'
      ? 'Phiếu giao hàng / Vận đơn TMĐT'
      : invoiceType === 'TYPE_B_TRANSFER'
      ? 'Biên lai Chuyển khoản'
      : invoiceType === 'TYPE_A_TABLE'
      ? 'Hóa đơn in / Bảng (Siêu thị)'
      : 'Giấy ghi chép tự do');

  const todayStr = new Date().toISOString().slice(0, 10);

  const isValidPastOrPresentDate = (d: any): boolean => {
    if (!d || typeof d !== 'string') return false;
    const match = d.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!match) return false;
    const time = new Date(d).getTime();
    if (isNaN(time)) return false;
    // Chặn ngày tương lai (cho phép tối đa 1 ngày so với hôm nay do chênh lệch múi giờ)
    const maxFutureTime = Date.now() + 86400000;
    if (time < new Date('2000-01-01').getTime() || time > maxFutureTime) {
      return false;
    }
    return true;
  };

  const defaultDate =
    typeof parsed === 'object' && !Array.isArray(parsed) && isValidPastOrPresentDate(parsed.date)
      ? parsed.date
      : todayStr;

  let rawItems: any[] = [];
  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (Array.isArray(parsed.items)) {
    rawItems = parsed.items;
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Nếu AI trả về 1 object đơn lẻ (nhất là trong chế độ gộp 1 giao dịch)
    const singleAmt = Math.max(0, Number(parsed.totalAmount ?? parsed.total ?? parsed.amount ?? parsed.price ?? 0));
    const singleNote = String(
      parsed.note || parsed.name || parsed.storeName || parsed.merchant || parsed.title || 'Chi tiêu hóa đơn'
    )
      .trim()
      .replace(/\\n/g, '\n');
    if (singleAmt > 0 || singleNote.length > 2) {
      rawItems = [
        {
          note: singleNote,
          name: singleNote,
          amount: singleAmt,
          totalAmount: singleAmt,
          date: isValidPastOrPresentDate(parsed.date) ? parsed.date : defaultDate,
          categorySuggestion: parsed.categorySuggestion || parsed.category || singleNote,
        },
      ];
    }
  }

  const items: ExtractedBatchItem[] = rawItems
    .filter((item: any) => {
      if (!item) return false;
      const amt = Number(item.totalAmount ?? item.amount ?? item.price ?? 0);
      const note = String(item.note || item.name || item.title || '').trim();
      // Giữ lại món nếu có số tiền > 0, HOẶC nếu có tên món hàng hợp lệ (cho phép amount === 0 đối với đơn hàng TMĐT / phiếu giao hàng trả trước)
      return amt > 0 || note.length > 2;
    })
    .map((item: any, idx: number) => {
      const amt = Math.max(0, Number(item.totalAmount ?? item.amount ?? item.price ?? 0));
      const noteText = String(item.note || item.name || item.title || `Món hàng ${idx + 1}`)
        .trim()
        .replace(/\\n/g, '\n');
      const itemDate = isValidPastOrPresentDate(item.date) ? item.date : defaultDate;
      const categoryId = item.categoryId || mapCategoryNameToId(item.categorySuggestion || item.category || '', noteText);

      return {
        id: `vision-item-${Date.now()}-${idx}`,
        date: itemDate,
        amount: amt,
        note: noteText,
        categoryId,
        rawLine: `${noteText}: ${amt.toLocaleString('vi-VN')} đ`,
      };
    });

  const totalAmount =
    (typeof parsed === 'object' && !Array.isArray(parsed) && Number(parsed.totalAmount)) ||
    items.reduce((acc, it) => acc + it.amount, 0);

  return {
    rawText: JSON.stringify(parsed, null, 2),
    invoiceType,
    invoiceTypeName,
    items,
    totalAmount,
  };
}

/**
 * HÀM CHÍNH: extractInvoiceDataWithCloudVision
 * Gửi ảnh Base64 lên Google Gemini Vision API và parse dữ liệu JSON
 * Hỗ trợ abortSignal để hủy bỏ ngay lập tức nếu người dùng bấm Hủy
 * Hỗ trợ scanMode: 'split' (Tách từng món) hoặc 'merge' (Gộp thành 1 giao dịch)
 */
export async function extractInvoiceDataWithCloudVision(
  imageSource: string,
  configOverride?: Partial<VisionConfig>,
  abortSignal?: AbortSignal,
  scanMode: 'split' | 'merge' = 'split',
  onModelSwitch?: (modelName: string, reason: string) => void
): Promise<BatchParsedResult> {
  const currentConfig = { ...getSavedVisionConfig(), ...configOverride };
  const effectiveKey = currentConfig.apiKey?.trim() || DEFAULT_GEMINI_API_KEY;

  const todayStr = new Date().toISOString().slice(0, 10);
  const promptText =
    scanMode === 'merge' ? getVisionInvoicePromptMerge(todayStr) : getVisionInvoicePromptSplit(todayStr);
  const schemaToUse =
    scanMode === 'merge' ? GEMINI_MERGE_SCHEMA : GEMINI_SPLIT_SCHEMA;

  // Mặc định và duy nhất: Google Gemini Vision với cơ chế tự động chuyển model khi hết Quota
  const rawJsonText = await callGeminiVision(
    imageSource,
    effectiveKey,
    abortSignal,
    promptText,
    schemaToUse,
    onModelSwitch
  );

  return parseVisionJsonResponse(rawJsonText);
}
