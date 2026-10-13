import { Category, Ledger, Transaction, Wallet } from '../types';

const BANK_NOTIF_CONFIG_KEY = 'sochitieu_bank_notif_config_v1';
const BANK_NOTIF_PROCESSED_IDS_KEY = 'sochitieu_bank_notif_processed_v1';
const BANK_NOTIF_REVIEW_QUEUE_KEY = 'sochitieu_bank_notif_review_queue_v1';

export interface BankNotifConfig {
  autoSave: boolean; // true = Tự động lưu thẳng vào sổ mặc định; false = Hiện ở khay Chờ duyệt
}

const BANK_NOTIF_HISTORY_LOG_KEY = 'sochitieu_bank_notif_history_log_v1';

export interface BankNotifHistoryItem {
  id: string;
  appName: string;
  title: string;
  text: string;
  timestamp: number;
  status: 'saved' | 'pending' | 'ignored';
  amount?: number;
  type?: 'expense' | 'income' | 'transfer';
  reason?: string;
}

export function getBankNotifHistoryLog(): BankNotifHistoryItem[] {
  try {
    const raw = localStorage.getItem(BANK_NOTIF_HISTORY_LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

export function addBankNotifHistoryLog(item: BankNotifHistoryItem): void {
  try {
    const current = getBankNotifHistoryLog();
    const updated = [item, ...current.filter((i) => i.id !== item.id)].slice(0, 30);
    localStorage.setItem(BANK_NOTIF_HISTORY_LOG_KEY, JSON.stringify(updated));
  } catch (_) {}
}

export interface RawAndroidBankNotification {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  timestamp: number;
}

export interface ParsedBankNotificationItem {
  id: string;
  appName: string;
  rawText: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  date: string; // YYYY-MM-DDTHH:mm
  note: string;
  categoryId: string;
  ledgerId: string;
  walletId: string;
  toWalletId?: string | null;
  timestamp: number;
}

export function getBankNotifConfig(): BankNotifConfig {
  try {
    const raw = localStorage.getItem(BANK_NOTIF_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        autoSave: Boolean(parsed.autoSave),
      };
    }
  } catch (_) {}
  return {
    autoSave: false, // Mặc định hiện khay Chờ duyệt để người dùng kiểm tra 1 chạm
  };
}

export function saveBankNotifConfig(config: BankNotifConfig): void {
  try {
    localStorage.setItem(BANK_NOTIF_CONFIG_KEY, JSON.stringify(config));
  } catch (_) {}
}

export function isNotificationPermissionGranted(): boolean {
  try {
    return Boolean(window.AndroidUpdater?.isNotificationPermissionGranted?.());
  } catch (_) {
    return false;
  }
}

export function openAndroidNotificationSettings(): void {
  try {
    if (window.AndroidUpdater?.openNotificationSettings) {
      window.AndroidUpdater.openNotificationSettings();
    } else {
      alert('Tính năng mở cài đặt quyền thông báo chỉ hoạt động trên ứng dụng Android (.apk).');
    }
  } catch (_) {}
}

function getProcessedNotifIds(): Set<string> {
  try {
    const raw = localStorage.getItem(BANK_NOTIF_PROCESSED_IDS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (_) {}
  return new Set();
}

function saveProcessedNotifIds(ids: Set<string>): void {
  try {
    const arr = Array.from(ids).slice(-300);
    localStorage.setItem(BANK_NOTIF_PROCESSED_IDS_KEY, JSON.stringify(arr));
  } catch (_) {}
}

export function getSavedReviewQueue(): ParsedBankNotificationItem[] {
  try {
    const raw = localStorage.getItem(BANK_NOTIF_REVIEW_QUEUE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

export function convertBankItemToTransaction(
  item: ParsedBankNotificationItem
): Omit<Transaction, 'id' | 'createdAt'> {
  return {
    amount: item.amount,
    type: item.type,
    date: item.date,
    note: item.note,
    categoryId: item.categoryId,
    ledgerId: item.ledgerId,
    walletId: item.walletId,
    toWalletId: item.toWalletId,
  };
}

export function saveReviewQueue(queue: ParsedBankNotificationItem[]): void {
  try {
    localStorage.setItem(BANK_NOTIF_REVIEW_QUEUE_KEY, JSON.stringify(queue));
  } catch (_) {}
}

/**
 * Định dạng timestamp (ms) sang chuỗi YYYY-MM-DDTHH:mm theo giờ địa phương
 */
function toLocalIsoMinute(ts: number): string {
  const d = new Date(ts || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/**
 * Đoán danh mục tự động từ nội dung chuyển khoản
 */
function guessCategory(
  content: string,
  type: 'expense' | 'income',
  categories: Category[]
): string {
  const lower = (content || '').toLowerCase();
  const valid = categories.filter((c) => c.type === type || c.type === 'both');
  if (valid.length === 0) return categories[0]?.id || 'cat-other';

  const findCat = (keywords: string[]) =>
    valid.find((c) => keywords.some((k) => c.name.toLowerCase().includes(k)));

  if (type === 'expense') {
    if (/(an |bun|pho|com|cafe|coffee|highlands|tra sua|kfc|lotteria|nuoc|banh|quan)/.test(lower)) {
      const m = findCat(['ăn', 'uống', 'thực phẩm']);
      if (m) return m.id;
    }
    if (/(xang|grab|be |xanh sm|gsm|gui xe|ve xe|taxi)/.test(lower)) {
      const m = findCat(['di chuyển', 'xăng', 'xe']);
      if (m) return m.id;
    }
    if (/(shopee|lazada|tiktok|mua|sieu thi|winmart|bach hoa|circle k)/.test(lower)) {
      const m = findCat(['mua sắm', 'chợ']);
      if (m) return m.id;
    }
    if (/(tien nha|tien tro|dien|nuoc|wifi|internet|viettel|vnpt|fpt)/.test(lower)) {
      const m = findCat(['trọ', 'nhà', 'hóa đơn', 'điện']);
      if (m) return m.id;
    }
  } else {
    if (/(luong|salary|thuong|bonus)/.test(lower)) {
      const m = findCat(['lương', 'thưởng']);
      if (m) return m.id;
    }
  }

  return valid[0].id;
}

/**
 * Khớp tên ứng dụng ngân hàng/ví điện tử với danh sách Ví của người dùng
 */
function matchWalletByAppName(appName: string, rawText: string, wallets: Wallet[]): string {
  if (wallets.length === 0) return 'wallet-bank';
  const lowerApp = (appName || '').toLowerCase();

  // 1. Khớp theo số tài khoản xuất hiện trong thông báo (nếu người dùng có điền số TK vào ví)
  for (const w of wallets) {
    if (w.accountNumber && w.accountNumber.trim().length >= 4) {
      const last4 = w.accountNumber.trim().slice(-4);
      if (rawText.includes(last4)) {
        return w.id;
      }
    }
  }

  // 1b. Khớp nếu là Túi Thần Tài của MoMo
  if (rawText.toLowerCase().includes('thần tài') || rawText.toLowerCase().includes('than tai')) {
    const tttWallet = wallets.find((w) => /(thần tài|than tai)/i.test(w.name));
    if (tttWallet) return tttWallet.id;
  }

  // 2. Khớp theo tên ứng dụng (MoMo, ZaloPay, MB, VCB, Techcombank...)
  for (const w of wallets) {
    const wName = w.name.toLowerCase();
    if (lowerApp.includes('momo') && wName.includes('momo')) return w.id;
    if (lowerApp.includes('zalopay') && wName.includes('zalo')) return w.id;
    if (lowerApp.includes('mb') && (wName.includes('mb') || wName.includes('quân đội'))) return w.id;
    if (lowerApp.includes('vietcombank') && (wName.includes('vcb') || wName.includes('vietcombank'))) return w.id;
    if (lowerApp.includes('techcombank') && (wName.includes('tcb') || wName.includes('techcom'))) return w.id;
    if (lowerApp.includes('bidv') && wName.includes('bidv')) return w.id;
    if (lowerApp.includes('vietin') && (wName.includes('vietin') || wName.includes('ctg'))) return w.id;
    if (lowerApp.includes('acb') && wName.includes('acb')) return w.id;
    if (lowerApp.includes('tpbank') && wName.includes('tpb')) return w.id;
    if (lowerApp.includes('vpbank') && wName.includes('vpb')) return w.id;
    if (lowerApp.includes('timo') && wName.includes('timo')) return w.id;
    if (lowerApp.includes('cake') && wName.includes('cake')) return w.id;
  }

  // 3. Nếu là ngân hàng nói chung -> tìm ví có chữ "Ngân hàng" hoặc "Bank"
  if (!lowerApp.includes('momo') && !lowerApp.includes('zalopay')) {
    const bankWallet = wallets.find((w) =>
      /(ngân hàng|bank|thẻ|atm)/i.test(w.name)
    );
    if (bankWallet) return bankWallet.id;
  }

  // 4. Nếu là ví điện tử -> tìm ví có chữ "Ví" hoặc "MoMo"
  const eWallet = wallets.find((w) => /(momo|zalo|ví điện tử)/i.test(w.name));
  if (eWallet && (lowerApp.includes('momo') || lowerApp.includes('zalo'))) {
    return eWallet.id;
  }

  return wallets[0].id;
}

/**
 * Lớp 1 & 2: Phân tích thông minh nội dung thông báo Ngân hàng / Ví điện tử
 * Trả về null nếu là thông báo quảng cáo, mã OTP hoặc không phải biến động số dư.
 */
export function parseRawBankNotification(
  notif: RawAndroidBankNotification,
  wallets: Wallet[],
  ledgers: Ledger[],
  categories: Category[]
): ParsedBankNotificationItem | null {
  const fullText = `${notif.title || ''} ${notif.text || ''}`.replace(/\s+/g, ' ').trim();
  const lower = fullText.toLowerCase();

  // 1. Chặn tuyệt đối thông báo OTP, khuyến mãi, quảng cáo
  if (
    /(mã otp|ma otp|mã xác thực|voucher|quà tặng|ưu đãi|giảm ngay|hoàn tiền lên đến|cơ hội trúng|vay nhanh|mở thẻ|đăng nhập|thông báo bảo mật)/i.test(
      lower
    )
  ) {
    return null;
  }

  // 2. Loại bỏ thông tin số dư (SD, Số dư, SD khả dụng, v.v.)
  let textWithoutBalance = fullText.replace(
    /(?:SD|Số dư|So du|SD KD)\s*(?:khả dụng|kha dung|cuối|cuoi|hiện tại|hien tai|mới|moi|tài khoản|tai khoan)?\s*[:=]?\s*[+-]?\s*[\d.,]+\s*(?:VND|VNĐ|đ|d\b)?/gi,
    ' '
  );

  // 2b. Loại bỏ số tài khoản / số thẻ (VD: TK 12345678, Tài khoản 0123xxx, Thẻ 9704...) để không nhầm thành số tiền
  textWithoutBalance = textWithoutBalance.replace(
    /(?:TK|tài khoản|tai khoan|số TK|so TK|thẻ|the)\s*(?:số|so)?\s*[:=]?\s*[0-9*xX.-]{4,}\b/gi,
    ' '
  );

  let amount = 0;
  let type: 'expense' | 'income' = 'expense';

  // Mẫu A: Có dấu +/- rõ ràng trước số tiền (VD: -45,000VND, +500.000, GD: -50,000 VND, TK -75.000)
  const signedMatch = textWithoutBalance.match(
    /(?:GD|giao dịch|thay đổi|biến động|TK|tài khoản)?\s*[:=]?\s*([+-])\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(?:VND|VNĐ|đ|d\b)?/i
  );

  if (signedMatch) {
    const sign = signedMatch[1];
    const rawNum = signedMatch[2].replace(/[.,]/g, '');
    amount = parseInt(rawNum, 10) || 0;
    type = sign === '+' ? 'income' : 'expense';
  }

  // Mẫu B: Cụm từ hành động hoặc chỉ định số tiền (Số tiền, nạp tiền, chuyển tiền, thanh toán, nhận được, về Túi Thần Tài...)
  if (!amount || amount < 1000) {
    const actionMatch = textWithoutBalance.match(
      /(ghi có|ghi co|cộng|cong|tăng|tang|nhận được|nhan duoc|nhận tiền|nhan tien|hoàn tiền|hoan tien|nạp tiền|nap tien|ghi nợ|ghi no|trừ|tru|giảm|giam|thanh toán|thanh toan|chuyển tiền|chuyen tien|chuyển khoản|chuyen khoan|chuyển thành công|chuyen thanh cong|chi tiêu|mua|rút tiền|rut tien|số tiền|so tien)\s*(?:thành công|thanh cong|TK|tài khoản|tai khoan|cho|tại|tai|vào|vao|đến|den|từ|tu|giao dịch|gd)?\s*[:=-]?\s*([+-]?)\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(?:VND|VNĐ|đ|d\b)?/i
    );

    if (actionMatch) {
      const action = actionMatch[1].toLowerCase();
      const sign = actionMatch[2];
      const rawNum = actionMatch[3].replace(/[.,]/g, '');
      amount = parseInt(rawNum, 10) || 0;

      if (
        /(ghi có|ghi co|cộng|cong|tăng|tang|nhận được|nhan duoc|nhận tiền|nhan tien|hoàn tiền|hoan tien|nạp tiền|nap tien)/.test(
          action
        ) ||
        sign === '+' ||
        /(về túi thần tài|ve tui than tai|về ví|ve vi|về tài khoản|ve tai khoan|về tk|ve tk|vào túi thần tài|vao tui than tai|vào ví|vao vi|vào tài khoản|nhận|cộng|tăng|ghi có|nạp|hoàn tiền|tiền vào|tiền về)/i.test(
          lower
        )
      ) {
        type = 'income';
      } else {
        type = 'expense';
      }
    }
  }

  // Mẫu C: Bất kỳ số tiền nào có đơn vị VND / VNĐ / đ / d
  if (!amount || amount < 1000) {
    const currencyMatch = textWithoutBalance.match(
      /(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(?:VND|VNĐ|đ|d\b)/i
    );
    if (currencyMatch) {
      const rawNum = currencyMatch[1].replace(/[.,]/g, '');
      amount = parseInt(rawNum, 10) || 0;
      if (
        /(về túi thần tài|ve tui than tai|về ví|ve vi|về tài khoản|ve tai khoan|về tk|ve tk|vào túi thần tài|vao tui than tai|vào ví|vao vi|vào tài khoản|nhận|cộng|tăng|ghi có|nạp|hoàn tiền|tiền vào|tiền về)/i.test(
          lower
        )
      ) {
        type = 'income';
      } else {
        type = 'expense';
      }
    }
  }

  if (!amount || amount < 1000) {
    return null;
  }

  // 3. Bóc tách Nội dung chuyển khoản (sau chữ ND:, Nội dung:, Lời nhắn:...)
  let extractedNote = '';
  const ndMatch = fullText.match(/(?:ND|Nội dung|Noi dung|Lời nhắn|Loi nhan|Mô tả)\s*[:=-]\s*([^.;]+)/i);
  if (ndMatch && ndMatch[1]) {
    extractedNote = ndMatch[1].trim();
  } else {
    extractedNote = notif.text.trim();
    if (extractedNote.length > 70) {
      extractedNote = extractedNote.slice(0, 70) + '...';
    }
  }

  const defaultLedger = ledgers.find((l) => l.isDefault) || ledgers[0];
  const ledgerId = defaultLedger?.id || 'ledger-personal';
  const walletId = matchWalletByAppName(notif.appName, fullText, wallets);
  const categoryId = guessCategory(extractedNote, type, categories);

  return {
    id: notif.id,
    appName: notif.appName || 'Ngân hàng',
    rawText: notif.text,
    amount,
    type,
    date: toLocalIsoMinute(notif.timestamp),
    note: `${extractedNote} (${notif.appName})`,
    categoryId,
    ledgerId,
    walletId,
    timestamp: notif.timestamp || Date.now(),
  };
}

/**
 * Lớp 3: Tự động gộp 2 biến động số dư ngược chiều (-X ở Ví A và +X ở Ví B trong vòng 3 phút)
 * thành 1 giao dịch Chuyển khoản nội bộ (transfer)
 */
function mergeInternalTransfers(items: ParsedBankNotificationItem[]): ParsedBankNotificationItem[] {
  const result: ParsedBankNotificationItem[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (usedIndices.has(i)) continue;
    const current = items[i];

    let matchedIdx = -1;
    for (let j = i + 1; j < items.length; j++) {
      if (usedIndices.has(j)) continue;
      const other = items[j];
      const sameAmount = current.amount === other.amount;
      const oppositeType =
        (current.type === 'expense' && other.type === 'income') ||
        (current.type === 'income' && other.type === 'expense');
      const differentWallet = current.walletId !== other.walletId || current.appName !== other.appName;
      const within3Minutes = Math.abs(current.timestamp - other.timestamp) <= 180000;

      if (sameAmount && oppositeType && differentWallet && within3Minutes) {
        matchedIdx = j;
        break;
      }
    }

    if (matchedIdx !== -1) {
      usedIndices.add(i);
      usedIndices.add(matchedIdx);
      const other = items[matchedIdx];
      const source = current.type === 'expense' ? current : other;
      const dest = current.type === 'income' ? current : other;

      result.push({
        ...source,
        type: 'transfer',
        walletId: source.walletId,
        toWalletId: dest.walletId,
        note: `Chuyển tiền từ ${source.appName} sang ${dest.appName}`,
      });
    } else {
      result.push(current);
    }
  }

  return result;
}

/**
 * Đọc các thông báo ngân hàng mới từ tầng Native Android, lọc & trả về danh sách mới
 */
export function pullNewBankNotificationsFromAndroid(params: {
  wallets: Wallet[];
  ledgers: Ledger[];
  categories: Category[];
}): ParsedBankNotificationItem[] {
  if (!window.AndroidUpdater?.getPendingBankNotifications) {
    return [];
  }

  try {
    const rawJson = window.AndroidUpdater.getPendingBankNotifications();
    const rawList: RawAndroidBankNotification[] = JSON.parse(rawJson || '[]');
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return [];
    }

    const processedIds = getProcessedNotifIds();
    const newlyParsed: ParsedBankNotificationItem[] = [];

    const cfg = getBankNotifConfig();
    for (const rawItem of rawList) {
      if (!rawItem || !rawItem.id || processedIds.has(rawItem.id)) continue;
      processedIds.add(rawItem.id);

      const parsed = parseRawBankNotification(
        rawItem,
        params.wallets,
        params.ledgers,
        params.categories
      );
      if (parsed) {
        newlyParsed.push(parsed);
        addBankNotifHistoryLog({
          id: rawItem.id,
          appName: rawItem.appName,
          title: rawItem.title,
          text: rawItem.text,
          timestamp: rawItem.timestamp || Date.now(),
          status: cfg.autoSave ? 'saved' : 'pending',
          amount: parsed.amount,
          type: parsed.type,
        });
      } else {
        addBankNotifHistoryLog({
          id: rawItem.id,
          appName: rawItem.appName,
          title: rawItem.title,
          text: rawItem.text,
          timestamp: rawItem.timestamp || Date.now(),
          status: 'ignored',
          reason: 'Không xác định được số tiền biến động',
        });
      }
    }

    saveProcessedNotifIds(processedIds);
    window.AndroidUpdater.clearPendingBankNotifications?.();

    return mergeInternalTransfers(newlyParsed);
  } catch (err) {
    console.warn('Lỗi đọc thông báo biến động số dư:', err);
    return [];
  }
}
