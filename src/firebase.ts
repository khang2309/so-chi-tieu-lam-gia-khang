import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  Firestore,
} from 'firebase/firestore';

/**
 * Cấu hình Firebase: Sử dụng biến môi trường import.meta.env
 * Để trống mặc định để người dùng tự điền khóa API vào file .env
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBSwAvAYzffjqdTtMaB-9K1asxdK-b2yX8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sochitieu-khanglam.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sochitieu-khanglam',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sochitieu-khanglam.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1049457866930',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1049457866930:web:df621c7298b0e4e14d71ab',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey.trim().length > 0 &&
  firebaseConfig.projectId.trim().length > 0
);

let app: any = null;
let auth: any = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);

    // BẮT BUỘC: Kích hoạt bộ nhớ đệm cục bộ (Offline-First persistence)
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err) {
    console.warn('Cảnh báo khởi tạo Firebase:', err);
    try {
      if (app) db = getFirestore(app);
    } catch {
      // Fallback
    }
  }
}

export { app, auth, db };
export const googleProvider = new GoogleAuthProvider();
