import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  Cloud,
  WifiOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogleNative,
    continueOffline,
    isOnline,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogleNative();
    } catch (err: any) {
      console.warn('Lỗi đăng nhập Google Native:', err);
      const detail =
        typeof err === 'object'
          ? (err.message ? `${err.message} (${JSON.stringify(err)})` : JSON.stringify(err))
          : String(err);
      setError(detail);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }
    if (cleanPassword.length < 6) {
      setError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(cleanEmail, cleanPassword);
      } else {
        await registerWithEmail(cleanEmail, cleanPassword);
      }
    } catch (err: any) {
      console.warn('Lỗi xác thực:', err);
      let msg = err?.message || 'Đăng nhập không thành công.';
      if (
        msg.includes('user-not-found') ||
        msg.includes('wrong-password') ||
        msg.includes('invalid-credential')
      ) {
        msg = 'Email hoặc mật khẩu không chính xác.';
      } else if (msg.includes('email-already-in-use')) {
        msg = 'Email này đã được đăng ký trước đó. Vui lòng bấm Đăng nhập.';
      } else if (msg.includes('weak-password')) {
        msg = 'Mật khẩu cần tối thiểu 6 ký tự.';
      } else if (msg.includes('invalid-email')) {
        msg = 'Địa chỉ Email không hợp lệ.';
      } else if (msg.includes('network-request-failed')) {
        msg = 'Không thể kết nối mạng. Bạn có thể dùng chế độ Ngoại tuyến.';
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
        {/* Top binder strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#a25832] via-[#c28b38] to-[#3d7a5a]" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#3e332a] flex items-center gap-1.5">
                <span>Tài Khoản & Đồng Bộ</span>
                <Sparkles className="w-3.5 h-3.5 text-[#c28b38]" />
              </h3>
              <p className="text-[11px] text-[#7a6a58]">
                Bảo vệ dữ liệu chi tiêu cá nhân trên đám mây
              </p>
            </div>
          </div>

          <button
            onClick={() => continueOffline()}
            className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
            title="Đóng / Dùng ngoại tuyến"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Thông báo trạng thái ngoại tuyến nếu mất mạng */}
          {!isOnline && (
            <div className="p-3 rounded-xl bg-[#fef3c7] border border-[#fde68a] flex items-start gap-2 text-xs text-[#92400e]">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Thiết bị đang ngoại tuyến:</strong> Mọi thao tác thêm/sửa/xóa đều được lưu trên máy và tự động đồng bộ khi có mạng trở lại.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-[#fee2e2] border border-[#fca5a5] flex items-start gap-2 text-xs text-[#991b1b]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            {/* Tabs Đăng nhập / Đăng ký */}
            <div className="flex bg-[#f5ebe0] p-1 rounded-xl border border-[#ebdcc9]">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  mode === 'login'
                    ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                    : 'text-[#7a6a58] hover:text-[#3e332a]'
                }`}
              >
                Đăng nhập Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  mode === 'register'
                    ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                    : 'text-[#7a6a58] hover:text-[#3e332a]'
                }`}
              >
                Đăng ký tài khoản
              </button>
            </div>

            {/* Form Email / Pass */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58] flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#a25832]" />
                  <span>Địa chỉ Email:</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tenban@gmail.com"
                  required
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:outline-none focus:border-[#a25832]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58] flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#a25832]" />
                  <span>Mật khẩu:</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:outline-none focus:border-[#a25832]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-[#a25832] text-white text-xs sm:text-sm font-bold hover:bg-[#8c4623] active:scale-[0.99] disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xử lý...</span>
                  </span>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Đăng nhập vào Cloud' : 'Tạo tài khoản mới'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Phân cách và Nút Đăng nhập bằng Google (Native) */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#ebdcc9]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-[#fffdfa] px-2 text-[#7a6a58] font-medium">Hoặc tiếp tục với</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isSubmitting}
              className="w-full py-2.5 px-3 rounded-xl border border-[#d8c8b4] bg-white hover:bg-[#fbf5eb] active:scale-[0.99] text-xs sm:text-sm font-semibold text-[#3e332a] transition shadow-xs flex items-center justify-center gap-2.5 disabled:opacity-60"
            >
              {isGoogleSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#a25832] border-t-transparent rounded-full animate-spin" />
                  <span>Đang kết nối Google...</span>
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12c0 2.02.45 3.84 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Đăng nhập bằng Google</span>
                </>
              )}
            </button>
          </div>

          {/* Dùng ngoại tuyến không bắt buộc */}
          <div className="pt-3 border-t border-[#f0e4d5] flex flex-col gap-2">
            <button
              onClick={() => continueOffline()}
              className="w-full py-2 rounded-xl bg-[#ebdcc9]/40 border border-[#d8c8b4] text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] text-xs font-semibold transition"
            >
              Bỏ qua, tiếp tục dùng Ngoại tuyến (Offline)
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#7a6a58]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2e7d32]" />
              <span>Dữ liệu vẫn được bảo toàn an toàn trên máy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
