import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { auth, isFirebaseConfigured } from '../firebase';
import { deepClearAllStorage } from '../utils/storageCleaner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isOfflineMode: boolean;
  isOnline: boolean;
  isFirebaseAvailable: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  loginWithGoogleNative: () => Promise<void>;
  logout: () => Promise<void>;
  continueOffline: () => void;
  openAuthModal: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_OFFLINE_KEY = 'sochitieu_user_offline_preference';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    // Nếu chưa cấu hình Firebase, mặc định là Offline mode
    if (!isFirebaseConfigured) return true;
    return localStorage.getItem(STORAGE_OFFLINE_KEY) === 'true';
  });
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Lắng nghe trạng thái online/offline của thiết bị
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Lắng nghe Firebase Auth State
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setIsOfflineMode(false);
        try {
          localStorage.removeItem(STORAGE_OFFLINE_KEY);
          localStorage.removeItem('user_is_logged_out');
        } catch {}
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase chưa được cấu hình khóa API trong file .env');
    }
    try {
      localStorage.removeItem('user_is_logged_out');
    } catch {}
    await signInWithEmailAndPassword(auth, email, pass);
    try {
      localStorage.removeItem('user_is_logged_out');
      localStorage.setItem('hasSeenLoginPopup', 'true');
    } catch {}
    setIsAuthModalOpen(false);
  };

  const registerWithEmail = async (email: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase chưa được cấu hình khóa API trong file .env');
    }
    try {
      localStorage.removeItem('user_is_logged_out');
    } catch {}
    await createUserWithEmailAndPassword(auth, email, pass);
    try {
      localStorage.removeItem('user_is_logged_out');
      localStorage.setItem('hasSeenLoginPopup', 'true');
    } catch {}
    setIsAuthModalOpen(false);
  };

  const sendPasswordReset = async (email: string) => {
    if (!auth) {
      throw new Error('Firebase chưa được cấu hình khóa API trong file .env');
    }
    await sendPasswordResetEmail(auth, email);
  };

  const loginWithGoogleNative = async () => {
    if (!auth) {
      const msg = 'Firebase chưa được cấu hình khóa API trong file .env';
      alert(msg);
      throw new Error(msg);
    }
    try {
      try {
        localStorage.removeItem('user_is_logged_out');
      } catch {}

      // 1. Nếu đang chạy trên Trình duyệt Web (Localhost / Web hosting)
      if (!Capacitor.isNativePlatform()) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
        try {
          localStorage.removeItem('user_is_logged_out');
          localStorage.setItem('hasSeenLoginPopup', 'true');
        } catch {}
        setIsAuthModalOpen(false);
        return;
      }

      // 2. Nếu đang chạy trên ứng dụng Android Native (APK qua Capacitor)
      await GoogleAuth.initialize({
        clientId: '1049457866930-8p1gu1bmhm5f8q6fs4k14s1meb2h5l6f.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication?.idToken || (googleUser as any).idToken;
      if (!idToken) {
        const tokenErr = 'Không nhận được mã xác thực idToken từ Google: ' + JSON.stringify(googleUser);
        alert(tokenErr);
        throw new Error(tokenErr);
      }
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      try {
        localStorage.removeItem('user_is_logged_out');
        localStorage.setItem('hasSeenLoginPopup', 'true');
      } catch {}
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.warn('Lỗi xác thực Google:', err);
      // Nếu người dùng đóng popup thì không bung alert gây phiền toái
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.error === 'popup_closed_by_user'
      ) {
        console.log('Người dùng đã đóng popup Google');
        throw err;
      }
      // Hiển thị trực tiếp toàn bộ mã lỗi chi tiết (alert JSON hoặc message) cho các lỗi kỹ thuật khác
      const errorStr =
        typeof err === 'object'
          ? (err.message ? `${err.message}\nChi tiết: ${JSON.stringify(err)}` : JSON.stringify(err))
          : String(err);
      alert(errorStr);
      throw err;
    }
  };

  const logout = async () => {
    try {
      localStorage.setItem(STORAGE_OFFLINE_KEY, 'true');
    } catch {}

    const isGoogleUser = user?.providerData?.some((p) => p.providerId === 'google.com');

    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Lỗi signOut:', e);
      }
    }

    if (Capacitor.isNativePlatform() && isGoogleUser) {
      try {
        await GoogleAuth.initialize({
          clientId: '1049457866930-8p1gu1bmhm5f8q6fs4k14s1meb2h5l6f.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
        await GoogleAuth.signOut();
      } catch (e) {
        console.warn('Bỏ qua GoogleAuth.signOut:', e);
      }
    }

    setUser(null);
    setIsOfflineMode(true);
    // Xóa sạch 100% bộ nhớ cứng (localStorage, Preferences, sessionStorage)
    await deepClearAllStorage();
  };

  const continueOffline = () => {
    setIsOfflineMode(true);
    localStorage.setItem(STORAGE_OFFLINE_KEY, 'true');
    localStorage.setItem('hasSeenLoginPopup', 'true');
    setIsAuthModalOpen(false);
  };

  const openAuthModal = () => {
    setIsAuthModalOpen(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isOfflineMode,
        isOnline,
        isFirebaseAvailable: isFirebaseConfigured,
        loginWithEmail,
        registerWithEmail,
        sendPasswordReset,
        loginWithGoogleNative,
        logout,
        continueOffline,
        openAuthModal,
        isAuthModalOpen,
        setIsAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
