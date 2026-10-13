import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const BUILTIN_APP_VERSION = '2.1.4';

export const GITHUB_VERSION_JSON_URL =
  'https://raw.githubusercontent.com/khang2309/so-chi-tieu-lam-gia-khang/main/version.json';

export interface AppReleaseConfig {
  version: string;
  updateType: 'ota' | 'apk';
  downloadUrl: string;
  releaseNotes: string;
  allowSkip: boolean;
  updatedAt: string;
}

declare global {
  interface Window {
    AndroidUpdater?: {
      getInstalledOtaVersion: () => string;
      resetOtaBundle: () => void;
      downloadAndApplyOtaZip: (zipUrl: string, version: string) => void;
      downloadAndInstallApk: (apkUrl: string) => void;
      isNotificationPermissionGranted?: () => boolean;
      openNotificationSettings?: () => void;
      getPendingBankNotifications?: () => string;
      clearPendingBankNotifications?: () => void;
      triggerActiveNotificationsScan?: () => void;
      simulateTestNotification?: () => void;
    };
  }
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

  const hasUpdate = compareSemver(bestRelease.version, currentVersion) > 0;
  return {
    hasUpdate,
    currentVersion,
    release: bestRelease,
  };
}
