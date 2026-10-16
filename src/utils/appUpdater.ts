import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const BUILTIN_APP_VERSION = '2.1.50';

export const GITHUB_VERSION_JSON_URL =
  'https://raw.githubusercontent.com/khang2309/so-chi-tieu-lam-gia-khang/main/version.json';

export interface AppReleaseConfig {
  version: string;
  updateType: 'ota' | 'apk';
  downloadUrl: string;
  minApkVersion?: string;
  apkDownloadUrl?: string;
  releaseNotes: string;
  allowSkip: boolean;
  updatedAt: string;
}

declare global {
  interface Window {
    AndroidUpdater?: {
      getInstalledOtaVersion: () => string;
      getNativeApkVersion?: () => string;
      resetOtaBundle: () => void;
      downloadAndApplyOtaZip: (zipUrl: string, version: string) => void;
      downloadAndInstallApk: (apkUrl: string) => void;
      isNotificationPermissionGranted?: () => boolean;
      openNotificationSettings?: () => void;
      getPendingBankNotifications?: () => string;
      clearPendingBankNotifications?: () => void;
      triggerActiveNotificationsScan?: () => void;
      simulateTestNotification?: () => void;
      simulateTestNotificationWithData?: (
        pkg: string,
        appName: string,
        title: string,
        text: string
      ) => void;
      isListenerConnected?: () => boolean;
      getRawNotificationLog?: () => string;
    };
  }
}

/**
 * Lấy phiên bản APK gốc được cài đặt trên máy (Native APK).
 * Phân biệt chính xác giữa bản native cài đặt và bản giao diện OTA.
 */
export function getNativeApkVersion(): string {
  try {
    if (window.AndroidUpdater) {
      if (typeof window.AndroidUpdater.getNativeApkVersion === 'function') {
        const native = window.AndroidUpdater.getNativeApkVersion();
        if (native && native.trim()) {
          return native.trim();
        }
      }
      // Đang chạy trên ứng dụng Android nhưng không có hàm getNativeApkVersion:
      // Chứng tỏ máy đang cài bản APK cũ (< 2.1.25, ví dụ 2.1.2, 2.1.7, 2.1.18)
      if (typeof window.AndroidUpdater.isNotificationPermissionGranted === 'function') {
        return '2.1.18';
      }
      return '2.1.2';
    }
  } catch (_) {}
  return BUILTIN_APP_VERSION;
}

export interface NativeCapabilitiesStatus {
  isAndroidNative: boolean;
  nativeApkVersion: string;
  hasNativeUpdater: boolean;
  hasNotificationListener: boolean;
  hasHotReloadOta: boolean;
  missingFeatures: string[];
  isFullyCapable: boolean;
}

/**
 * Kiểm tra trực quan toàn bộ năng lực native hệ điều hành của APK hiện tại trên máy.
 * Không chỉ dựa vào số phiên bản, hàm này kiểm tra trực tiếp các cầu nối Java/Android runtime.
 */
export function inspectNativeCapabilities(): NativeCapabilitiesStatus {
  const isAndroid = Boolean(window.AndroidUpdater);
  const nativeVer = getNativeApkVersion();
  const missing: string[] = [];

  const hasNativeUpdater = Boolean(
    window.AndroidUpdater &&
    typeof window.AndroidUpdater.downloadAndInstallApk === 'function' &&
    typeof window.AndroidUpdater.getNativeApkVersion === 'function'
  );
  if (isAndroid && !hasNativeUpdater) {
    missing.push('Cầu nối cập nhật APK tự động (AndroidUpdater v2)');
  }

  const hasNotificationListener = Boolean(
    window.AndroidUpdater &&
    typeof window.AndroidUpdater.isNotificationPermissionGranted === 'function'
  );
  if (isAndroid && !hasNotificationListener) {
    missing.push('Dịch vụ đọc biến động số dư ngân hàng (NotificationListener)');
  }

  const hasHotReloadOta = Boolean(
    window.AndroidUpdater &&
    typeof window.AndroidUpdater.downloadAndApplyOtaZip === 'function'
  );
  if (isAndroid && !hasHotReloadOta) {
    missing.push('Cơ chế cập nhật OTA siêu tốc (Hot Reload)');
  }

  return {
    isAndroidNative: isAndroid,
    nativeApkVersion: nativeVer,
    hasNativeUpdater,
    hasNotificationListener,
    hasHotReloadOta,
    missingFeatures: missing,
    isFullyCapable: !isAndroid || missing.length === 0,
  };
}

/**
 * Kiểm tra xem APK gốc trên máy có bị cũ hơn mức yêu cầu tối thiểu không
 */
export function isNativeApkOutdated(minApkVersion?: string): boolean {
  const caps = inspectNativeCapabilities();
  if (!caps.isAndroidNative) return false;
  if (!caps.isFullyCapable) return true;
  if (!minApkVersion) return false;
  return compareSemver(caps.nativeApkVersion, minApkVersion) < 0;
}

/**
 * Lấy phiên bản hiện tại đang chạy trên máy (ưu tiên bản OTA nếu đã cập nhật OTA mới hơn bản gốc)
 */
export function getCurrentRunningVersion(): string {
  try {
    const otaVer = window.AndroidUpdater?.getInstalledOtaVersion?.() || '';
    if (otaVer && compareSemver(otaVer, BUILTIN_APP_VERSION) > 0) {
      return otaVer;
    }
  } catch (_) {}
  return BUILTIN_APP_VERSION;
}

/**
 * So sánh 2 chuỗi phiên bản (VD: "2.2.0" > "2.1.0" => trả về 1)
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1
    .replace(/^v/i, '')
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const clean2 = v2
    .replace(/^v/i, '')
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(clean1.length, clean2.length, 3);
  for (let i = 0; i < len; i++) {
    const a = clean1[i] || 0;
    const b = clean2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Tự động chuẩn hóa link tải (hỗ trợ cả link Google Drive chia sẻ lẫn GitHub)
 */
export function normalizeDownloadUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=download&confirm=t&id=${driveMatch[1]}`;
  }
  return url;
}

/**
 * Kiểm tra bản cập nhật mới nhất từ GitHub (version.json) và Firebase Firestore (app_config/release)
 */
export async function checkAppUpdateFromCloud(): Promise<{
  hasUpdate: boolean;
  currentVersion: string;
  release?: AppReleaseConfig;
}> {
  const currentVersion = getCurrentRunningVersion();

  // Trên nền tảng trình duyệt Web (Vercel, Safari, Chrome...), người dùng chỉ cần F5 làm mới trang web.
  // Hoàn toàn tắt việc hiển thị popup và kiểm tra cập nhật phiên bản trên Web.
  const caps = inspectNativeCapabilities();
  if (!caps.isAndroidNative) {
    return { hasUpdate: false, currentVersion };
  }

  let bestRelease: AppReleaseConfig | null = null;

  // 1. Kiểm tra từ GitHub repo (nhanh, không cần đăng nhập)
  try {
    const res = await fetch(`${GITHUB_VERSION_JSON_URL}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const ghData = (await res.json()) as AppReleaseConfig;
      if (ghData && ghData.version && ghData.downloadUrl) {
        bestRelease = {
          ...ghData,
          allowSkip: ghData.allowSkip !== false,
        };
      }
    }
  } catch (_) {}

  // 2. Kiểm tra thêm từ Firebase Firestore (nếu có)
  if (db) {
    try {
      const ref = doc(db, 'app_config', 'release');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const fbData = snap.data() as AppReleaseConfig;
        if (fbData && fbData.version && fbData.downloadUrl) {
          if (!bestRelease || compareSemver(fbData.version, bestRelease.version) > 0) {
            bestRelease = {
              ...fbData,
              allowSkip: fbData.allowSkip !== false,
            };
          }
        }
      }
    } catch (_) {}
  }

  if (!bestRelease) {
    return { hasUpdate: false, currentVersion };
  }

  // Kiểm tra toàn diện năng lực native APK trực tiếp trên máy
  const isSemverOutdated =
    Boolean(bestRelease.minApkVersion) &&
    compareSemver(caps.nativeApkVersion, bestRelease.minApkVersion!) < 0;

  // Máy cần cài lại APK nếu:
  // - Đang chạy Android native nhưng thiếu bất kỳ hàm nền tảng nào
  // - HOẶC phiên bản APK thấp hơn minApkVersion yêu cầu
  const needApkFirst = caps.isAndroidNative && (!caps.isFullyCapable || isSemverOutdated);

  if (needApkFirst) {
    // Bắt buộc chuyển sang hình thức APK vì bản gốc trên máy đã quá cũ hoặc thiếu hàm native
    bestRelease.updateType = 'apk';
    if (bestRelease.apkDownloadUrl) {
      bestRelease.downloadUrl = bestRelease.apkDownloadUrl;
    }
    bestRelease.allowSkip = false;
    const reasonText = !caps.isFullyCapable
      ? `Thiếu tính năng nền tảng: ${caps.missingFeatures.join(', ')}`
      : `Bản cài đặt gốc trên máy (v${caps.nativeApkVersion}) thấp hơn yêu cầu tối thiểu (v${bestRelease.minApkVersion})`;
    const alertPrefix = `[⚠️ CẦN CÀI ĐẶT LẠI APK GỐC]\n${reasonText}.\nBạn cần cài đặt file APK mới để nâng cấp hệ thống. Sau khi cài xong, mọi bản cập nhật tiếp theo sẽ được tự động nâng cấp qua OTA nhanh trong 2 giây!\n\n`;
    if (!bestRelease.releaseNotes.includes('[⚠️ CẦN CÀI ĐẶT LẠI APK GỐC]')) {
      bestRelease.releaseNotes = alertPrefix + (bestRelease.releaseNotes || '');
    }
  }

  // Có bản cập nhật nếu phiên bản mới hơn bản đang chạy HOẶC cần nâng cấp APK gốc
  const hasUpdate =
    compareSemver(bestRelease.version, currentVersion) > 0 || needApkFirst;

  return {
    hasUpdate,
    currentVersion,
    release: bestRelease,
  };
}
