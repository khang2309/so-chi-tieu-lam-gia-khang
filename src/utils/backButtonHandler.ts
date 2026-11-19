import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export type BackActionHandler = () => boolean | void;

interface RegisteredHandler {
  id: string;
  handler: BackActionHandler;
  priority: number;
}

const backHandlers: RegisteredHandler[] = [];
let lastBackPressTime = 0;
let isInitialized = false;

/**
 * Đăng ký một bộ xử lý khi người dùng bấm nút / vuốt cử chỉ quay lại (Android back gesture).
 * @param id Định danh duy nhất của bộ xử lý (vd: 'TransactionModal')
 * @param handler Hàm xử lý. Trả về `true` (hoặc void) nếu đã xử lý xong để chặn thoát app; trả về `false` để nhường cho cấp tiếp theo.
 * @param priority Độ ưu tiên (số càng lớn càng được ưu tiên chạy trước, vd: modal 50, sheet 25, tab 10)
 */
export function registerBackHandler(
  id: string,
  handler: BackActionHandler,
  priority: number = 10
): () => void {
  initBackButtonService();

  // Xóa bộ xử lý trùng ID trước đó (nếu có)
  const existingIdx = backHandlers.findIndex((h) => h.id === id);
  if (existingIdx !== -1) {
    backHandlers.splice(existingIdx, 1);
  }

  backHandlers.push({ id, handler, priority });
  // Sắp xếp giảm dần theo priority (độ ưu tiên cao nhất đứng đầu)
  backHandlers.sort((a, b) => b.priority - a.priority);

  return () => {
    unregisterBackHandler(id);
  };
}

export function unregisterBackHandler(id: string) {
  const existingIdx = backHandlers.findIndex((h) => h.id === id);
  if (existingIdx !== -1) {
    backHandlers.splice(existingIdx, 1);
  }
}

/**
 * Kích hoạt chuỗi xử lý quay lại theo thứ tự ưu tiên
 */
export function triggerBack(): boolean {
  // Chạy lần lượt từ handler có priority cao nhất
  for (const item of [...backHandlers]) {
    try {
      const handled = item.handler();
      // Nếu handler trả về true hoặc void, sự kiện được coi là đã xử lý
      if (handled !== false) {
        return true;
      }
    } catch (err) {
      console.warn(`[BackButton] Lỗi khi thực thi handler "${item.id}":`, err);
    }
  }

  // Nếu không còn modal/sheet/tab nào cần đóng (đang ở màn hình chính):
  handleRootExit();
  return false;
}

/**
 * Xử lý thoát app an toàn ở màn hình chính (yêu cầu vuốt 2 lần để tránh vô tình thoát mất dữ liệu)
 */
function handleRootExit() {
  const now = Date.now();
  if (now - lastBackPressTime < 2000) {
    // Lần bấm thứ 2 trong vòng 2 giây -> Thu nhỏ hoặc đóng app
    try {
      if (window.AndroidUpdater?.minimizeApp) {
        window.AndroidUpdater.minimizeApp();
      } else if (window.AndroidUpdater?.exitApp) {
        window.AndroidUpdater.exitApp();
      } else if (Capacitor.isNativePlatform()) {
        CapApp.minimizeApp().catch(() => CapApp.exitApp());
      }
    } catch (_) {
      try {
        CapApp.exitApp();
      } catch (_) {}
    }
  } else {
    // Lần bấm đầu tiên -> Hiện toast thông báo
    lastBackPressTime = now;
    window.dispatchEvent(
      new CustomEvent('show-app-toast', {
        detail: 'Vuốt lần nữa để thoát ứng dụng',
      })
    );
  }
}

/**
 * Khởi tạo lắng nghe sự kiện từ Capacitor Native, Android WebView interface và DOM
 */
export function initBackButtonService() {
  if (isInitialized) return;
  isInitialized = true;

  // 1. Lắng nghe từ Capacitor App Plugin (chính thức & chuẩn nhất cho Android)
  try {
    CapApp.addListener('backButton', () => {
      triggerBack();
    });
  } catch (_) {}

  // 2. Cầu nối trực tiếp từ MainActivity.java (qua evaluateJavascript)
  (window as any).__onAndroidBackPressed = () => {
    triggerBack();
  };

  // 3. Sự kiện custom & Cordova/Capacitor document fallback
  window.addEventListener('android-back-button', () => {
    triggerBack();
  });
  document.addEventListener('backbutton', () => {
    triggerBack();
  });
}

/**
 * React hook giúp component tự động đăng ký và hủy đăng ký back handler theo vòng đời
 */
export function useBackHandler(
  id: string,
  handler: BackActionHandler,
  priority: number = 10,
  enabled: boolean = true
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    return registerBackHandler(id, () => handlerRef.current(), priority);
  }, [id, priority, enabled]);
}
