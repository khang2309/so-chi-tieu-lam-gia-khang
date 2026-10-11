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
    setIsAuthModalOpen(false);
  };

  const registerWithEmail = async (email: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase chưa được cấu hình khóa API trong file .env');
    }
    await createUserWithEmailAndPassword(auth, email, pass);
    setIsAuthModalOpen(false);
  };

  const loginWithGoogleNative = async () => {
    if (!auth) {
      throw new Error('Firebase chưa được cấu hình khóa API trong file .env');
    }
    try {
      await GoogleAuth.initialize();
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication?.idToken || (googleUser as any).idToken;
      if (!idToken) {
        throw new Error('Không nhận được mã xác thực idToken từ Google.');
      }
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      // Nếu người dùng đóng hộp thoại chọn tài khoản Google (cancel) thì không coi là lỗi nghiêm trọng
      if (
        msg.includes('cancel') ||
        msg.includes('canceled') ||
        msg.includes('cancelled') ||
        msg.includes('12501')
      ) {
        return;
      }
      console.warn('Lỗi xác thực Google Native:', err);
      throw err;
    }
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    try {
      await GoogleAuth.signOut();
    } catch {
      // Bỏ qua nếu chưa đăng nhập qua GoogleAuth
    }
    setUser(null);
    setIsOfflineMode(true);
    localStorage.setItem(STORAGE_OFFLINE_KEY, 'true');
  };

  const continueOffline = () => {
    setIsOfflineMode(true);
    localStorage.setItem(STORAGE_OFFLINE_KEY, 'true');
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
