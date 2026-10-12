import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
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
      // Nếu người dùng đã chủ động đăng xuất, tuyệt đối không tự động phục hồi phiên đăng nhập
      if (typeof localStorage !== 'undefined' && localStorage.getItem('user_is_logged_out') === 'true') {
        if (currentUser) {
          signOut(auth).catch(() => {});
        }
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setIsOfflineMode(false);
        localStorage.removeItem(STORAGE_OFFLINE_KEY);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase chưa được cấu hình khóa API trong file .env');
    }
    await signInWithEmailAndPassword(auth, email, pass);
    localStorage.removeItem('user_is_logged_out');
    localStorage.setItem('hasSeenLoginPopup', 'true');
    setIsAuthModalOpen(false);
  };

  const registerWithEmail = async (email: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase chưa được cấu hình khóa API trong file .env');
    }
    await createUserWithEmailAndPassword(auth, email, pass);
    localStorage.removeItem('user_is_logged_out');
    localStorage.setItem('hasSeenLoginPopup', 'true');
    setIsAuthModalOpen(false);
  };

  const loginWithGoogleNative = async () => {
    if (!auth) {
      const msg = 'Firebase chưa được cấu hình khóa API trong file .env';
      alert(msg);
      throw new Error(msg);
    }
    try {
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
      localStorage.removeItem('user_is_logged_out');
      localStorage.setItem('hasSeenLoginPopup', 'true');
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.warn('Lỗi xác thực Google Native:', err);
      // Hiển thị trực tiếp toàn bộ mã lỗi chi tiết (alert JSON hoặc message) theo yêu cầu
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
      localStorage.setItem('user_is_logged_out', 'true');
      localStorage.setItem(STORAGE_OFFLINE_KEY, 'true');
    } catch {}

    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Lỗi signOut:', e);
      }
    }
    try {
      await GoogleAuth.signOut();
    } catch {
      // Bỏ qua nếu chưa đăng nhập qua GoogleAuth
    }
    setUser(null);
    setIsOfflineMode(true);
    // Xóa sạch 100% bộ nhớ cứng (localStorage, Preferences, IndexedDB, sessionStorage)
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
