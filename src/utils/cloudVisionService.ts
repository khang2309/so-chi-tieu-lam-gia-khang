import { BatchParsedResult, ExtractedBatchItem, InvoiceType, predictCategory } from './ocrParser';

export type VisionProvider = 'gemini' | 'openai' | 'google_vision';

export interface VisionConfig {
  provider: VisionProvider;
  apiKey: string;
  customEndpoint?: string;
}

const STORAGE_KEY_CONFIG = 'lamgiakhang_vision_config';

/**
 * Lấy cấu hình Vision API từ LocalStorage
 */
export function getSavedVisionConfig(): VisionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
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
 * Prompt chuẩn mực tối ưu cho LLM Vision nhận diện hóa đơn tiếng Việt
 */
const VISION_INVOICE_PROMPT = `Bạn là trợ lý AI chuyên trích xuất dữ liệu hóa đơn và chi tiêu tại Việt Nam.
Nhiệm vụ: Hãy phân tích kỹ hình ảnh này (hóa đơn in nhiệt siêu thị/cửa hàng, biên lai chuyển khoản ngân hàng, hoặc giấy ghi chép chi tiêu tự do).
Bạn phải trả về một MẢNG JSON (JSON Array) chứa các đối tượng. Ví dụ định dạng bắt buộc: [ { "name": "Món 1", "amount": 100 }, { "name": "Món 2", "amount": 200 } ]. Không trả về các object rời rạc.

Cấu trúc đối tượng mục chi tiêu mẫu:
{
  "name": "Tên món hoặc khoản chi rõ ràng",
  "amount": 50000,
  "date": "YYYY-MM-DD",
  "categorySuggestion": "Ăn" | "Uống" | "Xăng xe (Yamaha Janus)" | "Hóa đơn" | "Mua sắm" | "Cắt tóc" | "Đồ điện tử" | "Đồ gia dụng" | "Tiền lương" | "Chi tiêu khác"
}

Quy tắc bắt buộc:
1. Số tiền: Bỏ chữ VNĐ, đ, nghìn, k, chuyển đổi thành số nguyên dương (VD: 50k -> 50000, 1.2tr -> 1200000, 45.000 -> 45000).
2. Không đưa các dòng phụ như "Tổng cộng", "VAT", "Tiền mặt", "Khách đưa", "Tiền thừa" vào danh sách mặt hàng items.
3. Ngày tháng: Chuẩn YYYY-MM-DD. Nếu hóa đơn chỉ ghi ngày/tháng (ví dụ 12/10), mặc định lấy năm 2026.
4. Đối với Biên lai chuyển khoản ngân hàng (Type B): Chỉ xuất đúng 1 item có amount là số tiền chuyển, name là nội dung chuyển khoản / người nhận.
5. Đối với Hóa đơn in nhiệt có bảng (Type A): Tách từng món trong danh sách hàng hóa và gán cùng ngày hóa đơn.
6. Bạn phải trả về một MẢNG JSON (JSON Array) chứa các đối tượng. Ví dụ định dạng bắt buộc: [ { "name": "Món 1", "amount": 100 }, { "name": "Món 2", "amount": 200 } ]. Không trả về các object rời rạc.

Chỉ trả về duy nhất một chuỗi JSON hợp lệ. KHÔNG dùng định dạng markdown, KHÔNG dùng block code \`\`\`json, KHÔNG có bất kỳ đoạn text hoặc ký tự * nào bên ngoài cấu trúc JSON.`;

export const DEFAULT_GEMINI_API_KEY = "AQ.Ab8RN6KT024Z8aPAvINhdVRsi8K7uSVOjKGGem0PfL7Ml_V1Xg";

export const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

// Danh sách các model Gemini ưu tiên và fallback theo đúng chỉ định
export const GEMINI_FALLBACK_MODELS = [
  'gemini-1.5-flash',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
];

/**
 * 1. Gọi Google Gemini Vision API với cơ chế tự động Fallback qua danh sách models
 * Hỗ trợ tự động thử cả v1beta và v1 endpoints nếu gặp lỗi 404, tích hợp AbortSignal để hủy tức thì
 */
async function callGeminiVision(base64Image: string, apiKey: string, abortSignal?: AbortSignal): Promise<string> {
  const { base64Data, mimeType } = cleanBase64(base64Image);
  const keyToUse = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : DEFAULT_GEMINI_API_KEY;

  const payload = {
    contents: [
      {
        parts: [
          { text: VISION_INVOICE_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  let lastError = '';
  let isKeyReportedLeaked = false;

  for (const model of GEMINI_FALLBACK_MODELS) {
    if (abortSignal?.aborted) {
      throw new DOMException('Quá trình quét đã bị hủy bởi người dùng', 'AbortError');
    }

    const apiVersions = ['v1beta', 'v1'];
    for (const apiVer of apiVersions) {
      if (abortSignal?.aborted) {
        throw new DOMException('Quá trình quét đã bị hủy bởi người dùng', 'AbortError');
      }

      try {
        const endpoint = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${keyToUse}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortSignal,
        });

        if (res.ok) {
          const json = await res.json();
          const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawContent) {
            return rawContent;
          }
        } else {
          const errText = await res.text();
          console.warn(`Model ${model} (${apiVer}) thất bại (HTTP ${res.status}):`, errText);
          if (res.status === 403 || errText.includes('PERMISSION_DENIED') || errText.includes('leaked')) {
            isKeyReportedLeaked = true;
          }
          lastError = `Model ${model} (${apiVer} - ${res.status}): ${errText}`;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || abortSignal?.aborted) {
          throw err;
        }
        console.warn(`Lỗi khi gọi model ${model} (${apiVer}):`, err);
        lastError = err?.message || String(err);
      }
    }
  }

  if (isKeyReportedLeaked) {
    throw new Error(
      `Khóa API Google Gemini của bạn đã bị thu hồi hoặc hạn chế quyền (Google báo lỗi 403/404). Vui lòng nhấn vào nút 'Cấu hình Key' và dán API Key cá nhân mới lấy miễn phí từ https://aistudio.google.com/app/apikey.`
    );
  }

  throw new Error(`Tất cả các model Gemini đều không phản hồi: ${lastError}`);
}

/**
 * 2. Gọi OpenAI GPT-4o-mini Vision API (Hỗ trợ AbortSignal)
 */
async function callOpenAIVision(base64Image: string, apiKey: string, abortSignal?: AbortSignal): Promise<string> {
  const { base64Data, mimeType } = cleanBase64(base64Image);
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: VISION_INVOICE_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: abortSignal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI Vision API lỗi (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const rawContent = json?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('OpenAI API không trả về kết quả!');
  }
  return rawContent;
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
 * 1. Xóa bỏ các thẻ Markdown: text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
 * 2. Cứu vãn dữ liệu (Fallback Parser): Nếu chuỗi trả về là các object rời rạc (ví dụ: {...} {...} hoặc {...}, {...}),
 *    dùng Regex tự động bọc chuỗi đó vào dấu [] và thêm dấu phẩy giữa các object trước khi gọi JSON.parse().
 * 3. Đảm bảo an toàn không bị lỗi "Unexpected non-whitespace character after JSON".
 */
export function extractCleanJsonString(rawText: string): string {
  if (!rawText) return '';
  // Bước 1: Xóa bỏ các thẻ Markdown
  let text = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

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
export function parseVisionJsonResponse(jsonString: string): BatchParsedResult {
  // Dọn dẹp chuỗi JSON trước khi Parse
  const cleanJson = extractCleanJsonString(jsonString);

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err: any) {
    console.error('Không thể parse JSON từ Cloud AI sau khi dọn dẹp:', cleanJson, err);
    throw new Error(
      `Phản hồi từ Cloud AI không phải JSON hợp lệ (${err?.message || err}). Dữ liệu nhận được: ${cleanJson.slice(0, 120)}...`
    );
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
      const categoryId = item.categoryId || mapCategoryNameToId(item.categorySuggestion || item.category || name);

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
    rawText: JSON.stringify(parsed, null, 2),
    invoiceType,
    invoiceTypeName,
    items,
    totalAmount,
  };
}

/**
 * HÀM CHÍNH: extractInvoiceDataWithCloudVision
 * Gửi ảnh Base64 lên Cloud Vision API (Gemini / OpenAI) và parse dữ liệu JSON
 * Hỗ trợ abortSignal để hủy bỏ ngay lập tức nếu người dùng bấm Hủy
 */
export async function extractInvoiceDataWithCloudVision(
  imageSource: string,
  configOverride?: Partial<VisionConfig>,
  abortSignal?: AbortSignal
): Promise<BatchParsedResult> {
  const currentConfig = { ...getSavedVisionConfig(), ...configOverride };
  const effectiveKey = currentConfig.apiKey?.trim() || DEFAULT_GEMINI_API_KEY;

  let rawJsonText = '';
  if (currentConfig.provider === 'openai') {
    if (!effectiveKey) {
      throw new Error('Chưa thiết lập OpenAI API Key!');
    }
    rawJsonText = await callOpenAIVision(imageSource, effectiveKey, abortSignal);
  } else {
    // Mặc định: Google Gemini Vision
    rawJsonText = await callGeminiVision(imageSource, effectiveKey, abortSignal);
  }

  return parseVisionJsonResponse(rawJsonText);
}
