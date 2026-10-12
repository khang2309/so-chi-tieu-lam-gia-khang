import { shutdownAndClearFirebase } from '../firebase';
import { DEFAULT_LEDGERS, DEFAULT_WALLETS, DEFAULT_CATEGORIES } from '../data/initialData';

/**
 * Tiện ích dọn dẹp sạch sâu bộ nhớ ứng dụng (Deep Storage Clear)
 * Dùng khi Đăng xuất để xóa triệt để dữ liệu người dùng, tokens và cache offline.
 */
export async function deepClearAllStorage(): Promise<void> {
  // 1. Ngắt kết nối Firebase và giải phóng locks IndexedDB
  try {
    await shutdownAndClearFirebase();
  } catch (e) {
    console.warn('Lỗi shutdown Firebase:', e);
  }

  // 2. Xóa sạch Capacitor Preferences / Storage (nếu có trên Native Android)
  try {
    const cap = (window as any)?.Capacitor;
    if (cap?.Plugins?.Preferences?.clear) {
      await cap.Plugins.Preferences.clear();
    }
    if (cap?.Plugins?.Storage?.clear) {
      await cap.Plugins.Storage.clear();
    }
  } catch (e) {
    console.warn('Lỗi khi xóa Preferences/Storage:', e);
  }

  // 3. Xóa sạch toàn bộ databases trong IndexedDB
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      if (typeof window.indexedDB.databases === 'function') {
        const dbs = await window.indexedDB.databases();
        await Promise.all(
          dbs.map((db) => {
            if (db.name) {
              return new Promise<void>((resolve) => {
                const req = window.indexedDB.deleteDatabase(db.name!);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              });
            }
            return Promise.resolve();
          })
        );
      }

      // Danh sách dự phòng các tên DB offline của Firebase Auth / Firestore SDK
      const knownDbs = [
        'firebaseLocalStorageDb',
        'firebase-heartbeat-database',
        'firebase-installations-database',
        'firestore/[DEFAULT]/[project-id]/main',
        'firestore/[DEFAULT]/app-qlct/main',
        'firestore/[DEFAULT]/sochitieu-khanglam/main',
        'firestore/[DEFAULT]/fir-69b55/main',
        'firestore/[DEFAULT]/fir-69b55/documents',
        'firestore/[DEFAULT]/app-qlct/documents',
        'firestore/[DEFAULT]/sochitieu-khanglam/documents',
      ];
      await Promise.all(
        knownDbs.map(
          (name) =>
            new Promise<void>((resolve) => {
              const req = window.indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })
        )
      );
    }
  } catch (e) {
    console.warn('Lỗi khi xóa IndexedDB:', e);
  }

  // 4. Xóa sạch LocalStorage và SessionStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      // Đánh dấu cờ đã đăng xuất và đưa ứng dụng về trạng thái trắng tinh ban đầu (0 giao dịch)
      localStorage.setItem('user_is_logged_out', 'true');
      localStorage.setItem('sochitieu_user_offline_preference', 'true');
      localStorage.setItem('sochitieu_transactions_v2', '[]');
      localStorage.setItem('sochitieu_wallets_v2', JSON.stringify(DEFAULT_WALLETS));
      localStorage.setItem('sochitieu_ledgers_v2', JSON.stringify(DEFAULT_LEDGERS));
      localStorage.setItem('sochitieu_categories_v2', JSON.stringify(DEFAULT_CATEGORIES));
      localStorage.setItem('hasSeenLoginPopup', 'true');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (e) {
    console.warn('Lỗi khi xóa Web Storage:', e);
  }
}
