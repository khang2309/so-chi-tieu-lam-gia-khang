import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  Cloud,
  WifiOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../utils/toast';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogleNative,
    sendPasswordReset,
    continueOffline,
    isOnline,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Vui lòng nhập địa chỉ Email vào ô bên dưới trước, rồi bấm "Quên mật khẩu".');
      return;
    }
    setError(null);
    setIsResettingPassword(true);
    try {
      await sendPasswordReset(cleanEmail);
      showToast('Đã gửi email đặt lại mật khẩu! Vui lòng kiểm tra hộp thư của bạn 📩');
    } catch (err: any) {
      console.warn('Lỗi gửi email đặt lại mật khẩu:', err);
      let msg = err?.message || 'Không thể gửi email đặt lại mật khẩu.';
      if (msg.includes('user-not-found')) {
        msg = 'Không tìm thấy tài khoản với email này.';
      } else if (msg.includes('invalid-email')) {
        msg = 'Địa chỉ Email không hợp lệ.';
      }
      setError(msg);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('hasSeenLoginPopup', 'true');
    continueOffline();
    showToast('Bạn có thể đăng nhập sau tại mục Cài đặt ⚙️');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogleNative();
      showToast('Đăng nhập Google thành công! ☁️');
    } catch (err: any) {
      console.warn('Lỗi đăng nhập Google:', err);
      // Nếu người dùng chủ động đóng popup hoặc hủy, không báo lỗi đỏ
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.error === 'popup_closed_by_user'
      ) {
        return;
      }
      let detail =
        typeof err === 'object'
          ? (err.message ? `${err.message}` : JSON.stringify(err))
          : String(err);

      if (err?.code === 'auth/popup-blocked') {
        detail = 'Trình duyệt đang chặn popup. Vui lòng cho phép mở popup trên trang này để đăng nhập Google.';
      } else if (err?.code === 'auth/unauthorized-domain') {
        detail = 'Tên miền chưa được cấp phép trong Firebase Auth (Authorized Domains).';
      }
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

    // Lưu mật khẩu người dùng vừa nhập để sẵn sàng tự động liên kết với Google ngầm
    try {
      localStorage.setItem('sochitieu_saved_pwd_for_link', cleanPassword);
    } catch {}

    try {
      if (mode === 'login') {
        await loginWithEmail(cleanEmail, cleanPassword);
        showToast('Đăng nhập thành công! ☁️');
      } else {
        await registerWithEmail(cleanEmail, cleanPassword);
        showToast('Đăng ký tài khoản thành công! ☁️');
      }
    } catch (err: any) {
      console.warn('Lỗi xác thực:', err);
      let msg = err?.message || 'Đăng nhập không thành công.';
      if (
        msg.includes('user-not-found') ||
        msg.includes('wrong-password') ||
        msg.includes('invalid-credential')
      ) {
        msg = 'Email hoặc mật khẩu chưa khớp. Nếu bạn đã từng đăng nhập bằng Google, bạn chỉ cần bấm nút "Đăng nhập nhanh bằng Google" ở trên 1 lần, hệ thống sẽ tự động kết nối mật khẩu này cho bạn!';
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

        {/* Header Onboarding */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-start justify-between bg-[#fbf5eb]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#a25832]/10 text-[#a25832] flex items-center justify-center shrink-0 mt-0.5">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#3e332a] flex items-center gap-1.5">
                <span>Đồng bộ dữ liệu lên đám mây ☁️</span>
              </h3>
              <p className="text-xs text-[#7a6a58] mt-1 leading-relaxed">
                Đăng nhập để sao lưu an toàn Sổ Chi Tiêu. Nếu bỏ qua bây giờ, bạn vẫn có thể đăng nhập lại bất cứ lúc nào trong mục Cài đặt.
              </p>
            </div>
          </div>

          <button
            onClick={handleSkip}
            className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition shrink-0 ml-1"
            title="Bỏ qua / Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Thông báo trạng thái ngoại tuyến nếu mất mạng */}
          {!isOnline && (
            <div className="p-3 rounded-xl bg-[#fef3c7] border border-[#fde68a] flex items-start gap-2 text-xs text-[#92400e]">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Thiết bị đang ngoại tuyến:</strong> Mọi thao tác đều được lưu trên máy và tự động đồng bộ khi có mạng trở lại.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-[#fee2e2] border border-[#fca5a5] flex items-start gap-2 text-xs text-[#991b1b]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. NÚT GOOGLE NỔI BẬT TO BẢN Ở TRÊN CÙNG */}
          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isSubmitting}
              className="w-full py-3 px-4 rounded-xl border-2 border-[#d8c8b4] bg-white hover:bg-[#fbf5eb] active:scale-[0.99] text-xs sm:text-sm font-bold text-[#3e332a] transition shadow-xs flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
            >
              {isGoogleSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#a25832] border-t-transparent rounded-full animate-spin" />
                  <span>Đang kết nối Google...</span>
                </span>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                  <span>Đăng nhập nhanh bằng Google</span>
                </>
              )}
            </button>
          </div>

          {/* Phân cách */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#ebdcc9]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold">
              <span className="bg-[#fffdfa] px-2 text-[#7a6a58]">Hoặc sử dụng Email</span>
            </div>
          </div>

          {/* 2. FORM EMAIL / MẬT KHẨU */}
          <div className="space-y-3">
            <div className="flex bg-[#f5ebe0] p-1 rounded-xl border border-[#ebdcc9]">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                    : 'text-[#7a6a58] hover:text-[#3e332a]'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                    : 'text-[#7a6a58] hover:text-[#3e332a]'
                }`}
              >
                Đăng ký tài khoản
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-[#7a6a58] flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#a25832]" />
                  <span>Địa chỉ Email:</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vidu@gmail.com"
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
                {mode === 'login' && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isResettingPassword}
                      className="text-[11px] font-semibold text-[#a25832] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {isResettingPassword ? 'Đang gửi email...' : 'Quên mật khẩu?'}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-[#a25832] text-white text-xs sm:text-sm font-bold hover:bg-[#8c4623] active:scale-[0.99] disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
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
          </div>

          {/* 3. NÚT ĐỂ SAU / TIẾP TỤC NGOẠI TUYẾN */}
          <div className="pt-2 border-t border-[#f0e4d5] flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-2.5 rounded-xl bg-[#f5ebe0] hover:bg-[#ebdcc9] active:scale-[0.99] text-[#7a6a58] hover:text-[#3e332a] text-xs font-bold transition cursor-pointer"
            >
              Để sau / Bỏ qua (Dùng ngoại tuyến)
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
