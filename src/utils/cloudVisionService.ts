import { BatchParsedResult, ExtractedBatchItem, InvoiceType, predictCategory } from './ocrParser';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type VisionProvider = 'gemini';

export interface VisionConfig {
  provider: 'gemini';
  apiKey: string;
  customEndpoint?: string;
}

const STORAGE_KEY_CONFIG = 'lamgiakhang_vision_config';

/**
 * Lấy cấu hình Vision API từ LocalStorage (Luôn sử dụng Google Gemini)
 */
export function getSavedVisionConfig(): VisionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.provider = 'gemini';
      if (!parsed.apiKey || parsed.apiKey.trim().length === 0 || parsed.apiKey === "AIzaSyDA88CsMhhsgUzg5lvMHX3aYdaKQdz9AJQ") {
        parsed.apiKey = DEFAULT_GEMINI_API_KEY;
        saveVisionConfig(parsed);
      }
      return parsed;
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
 * Map tên danh mục tiếng Việt từ LLM sang Category ID của ứng dụng
 */
function mapCategoryNameToId(name: string): string {
  const normalized = (name || '').toLowerCase();
  if (normalized.includes('ăn') || normalized.includes('cơm') || normalized.includes('phở') || normalized.includes('thực phẩm')) return 'cat-eat';
  if (normalized.includes('uống') || normalized.includes('cafe') || normalized.includes('trà') || normalized.includes('nước')) return 'cat-drink';
  if (normalized.includes('xăng') || normalized.includes('xe') || normalized.includes('janus')) return 'cat-gas';
  if (normalized.includes('hóa đơn') || normalized.includes('điện') || normalized.includes('nước') || normalized.includes('trọ') || normalized.includes('mạng')) return 'cat-bills';
  if (normalized.includes('mua sắm') || normalized.includes('quần áo') || normalized.includes('áo') || normalized.includes('shopee')) return 'cat-shopping';
  if (normalized.includes('cắt tóc') || normalized.includes('gội đầu') || normalized.includes('tóc')) return 'cat-haircut';
  if (normalized.includes('điện tử') || normalized.includes('điện thoại') || normalized.includes('laptop')) return 'cat-electronics';
  if (normalized.includes('gia dụng') || normalized.includes('nồi') || normalized.includes('chảo')) return 'cat-furniture';
  if (normalized.includes('lương') || normalized.includes('thưởng') || normalized.includes('thu nhập')) return 'cat-salary';
  return predictCategory(name);
}

/**
 * Prompt 1: Tách từng món (Mặc định)
 */
export const VISION_INVOICE_PROMPT_SPLIT = `Đọc hóa đơn/biên lai và trích xuất các khoản chi tiêu từng món.
Bạn phải trả về một MẢNG JSON (JSON Array) chứa các đối tượng. Ví dụ định dạng bắt buộc: [ { "name": "Món 1", "amount": 100 }, { "name": "Món 2", "amount": 200 } ]. Không trả về các object rời rạc.

Mỗi phần tử gồm:
- "name": tên món hoặc người nhận chuyển khoản
- "amount": số tiền nguyên dương (VD: 50k -> 50000, 1.2tr -> 1200000)
- "date": YYYY-MM-DD (mặc định 2026 nếu thiếu năm)
- "categorySuggestion": một trong các nhóm: "Ăn", "Uống", "Xăng xe", "Hóa đơn", "Mua sắm", "Cắt tóc", "Đồ điện tử", "Đồ gia dụng", "Tiền lương", "Chi tiêu khác"

Quy tắc:
1. Không lấy dòng VAT, Tổng cộng, Tiền thối.
2. Biên lai ngân hàng: xuất 1 phần tử gồm nội dung/người nhận và số tiền.
3. Chỉ trả về chuỗi JSON thuần túy, không có markdown hoặc ký tự khác bên ngoài.`;

/**
 * Prompt 2: Gộp thành 1 giao dịch duy nhất
 */
export const VISION_INVOICE_PROMPT_MERGE = `Phân tích hóa đơn này và trả về 1 giao dịch duy nhất. Khóa totalAmount là tổng tiền hóa đơn. Khóa note (Ghi chú) bắt buộc phải bắt đầu bằng [Tên Cửa Hàng], sau đó liệt kê chi tiết từng món hàng và giá tiền tương ứng bên dưới theo định dạng: [Tên Cửa Hàng]\\n- Món A: giá\\n- Món B: giá.

BẮT BUỘC: Trả về DUY NHẤT một chuỗi JSON hợp lệ. Ví dụ:
{"totalAmount": 100000, "note": "Tên Cửa Hàng\\n- Món 1: 50.000\\n- Món 2: 50.000", "categorySuggestion": "Ăn uống", "date": "YYYY-MM-DD"}

ĐẶC BIỆT LƯU Ý: Phải dùng ký tự escape \\n để xuống dòng bên trong giá trị string của note, tuyệt đối không dùng dấu xuống dòng thực tế (literal unescaped newline) gây lỗi JSON.

Quy tắc bắt buộc:
1. "totalAmount": Số nguyên tổng tiền cả hóa đơn (Total / Tổng thanh toán). Không lấy tiền thối hay giảm giá.
2. "note": BẮT BUỘC bắt đầu bằng [Tên Cửa Hàng], sau đó dùng ký tự \\n để xuống dòng liệt kê từng món và giá (VD: "[Tên Cửa Hàng]\\n- Món A: 50.000\\n- Món B: 50.000").
3. "categorySuggestion": Tự động phán đoán danh mục phù hợp nhất cho cả hóa đơn (chọn 1 trong: "Ăn", "Uống", "Xăng xe", "Hóa đơn", "Mua sắm", "Cắt tóc", "Đồ điện tử", "Đồ gia dụng", "Chi tiêu khác").
4. "date": YYYY-MM-DD từ hóa đơn (mặc định 2026 nếu thiếu).
5. Chỉ trả về DUY NHẤT chuỗi JSON hợp lệ, không bọc markdown (\`\`\`json) hay văn bản giải thích nào khác.`;

export const DEFAULT_GEMINI_API_KEY = "AQ.Ab8RN6KT024Z8aPAvINhdVRsi8K7uSVOjKGGem0PfL7Ml_V1Xg";

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
  'gemini-2.5-flash-lite', // Ưu tiên #8: Dòng Lite 2.5 (10 RPM / 20 RPD)
  'gemini-2.5-flash',      // Ưu tiên #9: Dòng Flash 2.5
  'gemini-2.0-flash',      // Ưu tiên #10: Dòng Flash 2.0
  'gemini-flash-latest',   // Ưu tiên #11: Alias tự động trỏ model Flash mới nhất
  'gemini-1.5-flash',      // Ưu tiên #12: Fallback thế hệ 1.5
  'gemini-1.5-flash-8b',   // Ưu tiên #13: Fallback siêu nhẹ 8B
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
  'gemini-2.5-flash-lite', // Audio 2.5 Lite
  'gemini-2.5-flash',      // Audio 2.5 Flash
  'gemini-2.0-flash',      // Audio 2.0 Flash
  'gemini-flash-latest',   // Audio Flash Latest
  'gemini-1.5-flash',      // Audio 1.5 Flash
  'gemini-1.5-flash-8b',   // Audio 1.5 Flash 8B
];

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
      description: 'Tổng số tiền thanh toán cả hóa đơn (số nguyên dương)',
    },
    note: {
      type: 'STRING',
      description: 'Ghi chú bắt đầu bằng [Tên Cửa Hàng], sau đó liệt kê từng món và giá tiền ngăn cách bằng \\n',
    },
    categorySuggestion: {
      type: 'STRING',
      description: 'Gợi ý danh mục phù hợp (Ăn, Uống, Xăng xe, Hóa đơn, Mua sắm, Cắt tóc, Đồ điện tử, Đồ gia dụng, Chi tiêu khác)',
    },
    date: {
      type: 'STRING',
      description: 'Ngày lập hóa đơn theo định dạng YYYY-MM-DD',
    },
  },
  required: ['totalAmount', 'note', 'categorySuggestion', 'date'],
};

/**
 * Schema Gemini cho chế độ Tách Hóa Đơn (Array of Transaction Objects)
 */
export const GEMINI_SPLIT_SCHEMA = {
  type: 'ARRAY',
  description: 'Danh sách các món hàng/dịch vụ trong hóa đơn',
  items: {
    type: 'OBJECT',
    properties: {
      name: {
        type: 'STRING',
        description: 'Tên món hàng hoặc dịch vụ',
      },
      amount: {
        type: 'INTEGER',
        description: 'Số tiền của món hàng/dịch vụ (số nguyên dương)',
      },
      categorySuggestion: {
        type: 'STRING',
        description: 'Gợi ý danh mục phù hợp cho món này',
      },
      date: {
        type: 'STRING',
        description: 'Ngày lập hóa đơn định dạng YYYY-MM-DD',
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
        "Bước 2: Dựa vào transcript, trích xuất số tiền. Quy đổi: k, ca, ka, nghìn, ngàn = x 1.000 (VD: '25ca' = 25000). củ, triệu = x 1.000.000.",
    },
    note: {
      type: 'string',
      description: "Mô tả nội dung giao dịch, loại bỏ phần số tiền. (VD: 'ăn cơm tấm'). Nếu không rõ, để là 'Chưa rõ'.",
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
  required: ['transcript', 'amount', 'note', 'category', 'transactionType'],
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
      `Khóa API Google Gemini của bạn đã bị thu hồi hoặc hạn chế quyền (Google báo lỗi 403). Vui lòng nhấn vào nút 'Cấu hình Key' và dán API Key cá nhân mới lấy miễn phí từ https://aistudio.google.com/app/apikey.`
    );
  }

  throw new Error(`Tất cả các model Gemini đều không phản hồi: ${lastError}`);
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

  throw new Error(`Không thể kết nối Gemini API: ${lastError}`);
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

  throw new Error(`Không thể phân tích âm thanh bằng Gemini: ${lastError}`);
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

  const invoiceType: InvoiceType =
    (typeof parsed === 'object' && !Array.isArray(parsed) && parsed.invoiceType) ||
    'TYPE_A_TABLE';

  const invoiceTypeName =
    (typeof parsed === 'object' && !Array.isArray(parsed) && parsed.invoiceTypeName) ||
    (invoiceType === 'TYPE_A_TABLE'
      ? 'Hóa đơn in / Bảng (Siêu thị)'
      : invoiceType === 'TYPE_B_TRANSFER'
      ? 'Biên lai Chuyển khoản'
      : 'Giấy ghi chép tự do');

  const defaultDate =
    (typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.date : null) ||
    new Date().toISOString().slice(0, 10);

  let rawItems: any[] = [];
  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (Array.isArray(parsed.items)) {
    rawItems = parsed.items;
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Nếu AI trả về 1 object đơn lẻ (nhất là trong chế độ gộp 1 giao dịch)
    const singleAmt = Number(parsed.totalAmount || parsed.total || parsed.amount || parsed.price || 0);
    const singleNote = String(
      parsed.note || parsed.name || parsed.storeName || parsed.merchant || parsed.title || 'Chi tiêu hóa đơn'
    )
      .trim()
      .replace(/\\n/g, '\n');
    if (singleAmt > 0) {
      rawItems = [
        {
          note: singleNote,
          name: singleNote,
          amount: singleAmt,
          totalAmount: singleAmt,
          date: parsed.date || defaultDate,
          categorySuggestion: parsed.categorySuggestion || parsed.category || singleNote,
        },
      ];
    }
  }

  const items: ExtractedBatchItem[] = rawItems
    .filter((item: any) => item && (Number(item.totalAmount) > 0 || Number(item.amount) > 0 || Number(item.price) > 0))
    .map((item: any, idx: number) => {
      const amt = Number(item.totalAmount || item.amount || item.price || 0);
      const noteText = String(item.note || item.name || item.title || `Món hàng ${idx + 1}`)
        .trim()
        .replace(/\\n/g, '\n');
      const itemDate = item.date || defaultDate;
      const categoryId = item.categoryId || mapCategoryNameToId(item.categorySuggestion || item.category || noteText);

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

  const promptText =
    scanMode === 'merge' ? VISION_INVOICE_PROMPT_MERGE : VISION_INVOICE_PROMPT_SPLIT;
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
