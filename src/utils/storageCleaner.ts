import { DEFAULT_CATEGORIES } from '../data/initialData';

/**
 * Tiện ích dọn dẹp sạch sâu bộ nhớ ứng dụng (Deep Storage Clear)
 * Dùng khi Đăng xuất để xóa triệt để dữ liệu người dùng trên thiết bị.
 */
export async function deepClearAllStorage(): Promise<void> {
  // BƯỚC 1: XÓA SẠCH VÀ RESET LOCALSTORAGE & SESSIONSTORAGE NGAY LẬP TỨC
  try {
    if (typeof localStorage !== 'undefined') {
      const savedPwdForLink = localStorage.getItem('sochitieu_saved_pwd_for_link');
      localStorage.clear();
      if (savedPwdForLink) {
        localStorage.setItem('sochitieu_saved_pwd_for_link', savedPwdForLink);
      }
      localStorage.setItem('user_is_logged_out', 'true');
      localStorage.setItem('sochitieu_user_offline_preference', 'true');
      localStorage.setItem('sochitieu_transactions_v2', '[]');
      localStorage.setItem('sochitieu_wallets_v2', '[]');
      localStorage.setItem('sochitieu_ledgers_v2', '[]');
      localStorage.setItem('sochitieu_categories_v2', JSON.stringify(DEFAULT_CATEGORIES));
      localStorage.setItem('sochitieu_active_ledger_v2', 'all');
      localStorage.setItem('sochitieu_active_wallet_v2', 'all');
      localStorage.setItem('hasSeenLoginPopup', 'true');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (e) {
    console.warn('Lỗi khi xóa Web Storage:', e);
  }

  // BƯỚC 2: XÓA PREFERENCES TRÊN CAPACITOR NATIVE (Timeout 200ms)
  try {
    const cap = (window as any)?.Capacitor;
    if (cap?.Plugins?.Preferences?.clear) {
      await Promise.race([
        cap.Plugins.Preferences.clear(),
        new Promise((r) => setTimeout(r, 200)),
      ]);
    }
    if (cap?.Plugins?.Storage?.clear) {
      await Promise.race([
        cap.Plugins.Storage.clear(),
        new Promise((r) => setTimeout(r, 200)),
      ]);
    }
  } catch (e) {
    console.warn('Lỗi khi xóa Preferences/Storage:', e);
  }
}
