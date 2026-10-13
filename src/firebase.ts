import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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

    // BẬT OFFLINE PERSISTENCE CHO FIRESTORE
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache(),
        });
      } catch {
        db = getFirestore(app);
      }
    }
  } catch (err) {
    console.warn('Cảnh báo khởi tạo Firebase:', err);
  }
}

export async function shutdownAndClearFirebase(): Promise<void> {
  if (auth) {
    try {
      await auth.signOut();
    } catch (e) {
      console.warn('auth.signOut error:', e);
    }
  }
}

export { app, auth, db };
