import React, { useState } from 'react';
import {
  Cloud,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FirstTimeLoginModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

export const FirstTimeLoginModal: React.FC<FirstTimeLoginModalProps> = ({
  isOpen,
  onDismiss,
  onSuccess,
}) => {
  const { loginWithEmail, registerWithEmail, loginWithGoogleNative, isOnline } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  if (!isOpen) return null;

  // Xử lý khi người dùng chọn "Để sau / Bỏ qua"
  const handleSkip = () => {
    localStorage.setItem('hasSeenLoginPopup', 'true');
    onDismiss();
  };

  // Đăng nhập Google Native
  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogleNative();
      localStorage.setItem('hasSeenLoginPopup', 'true');
      onSuccess();
    } catch (err: any) {
      console.warn('Lỗi đăng nhập Google Native:', err);
      const detail =
        typeof err === 'object'
          ? err.message || JSON.stringify(err)
          : String(err);
      setError(detail);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // Đăng nhập / Đăng ký qua Email
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
      localStorage.setItem('hasSeenLoginPopup', 'true');
      onSuccess();
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
        msg = 'Email này đã được đăng ký. Vui lòng bấm Đăng nhập.';
      } else if (msg.includes('weak-password')) {
        msg = 'Mật khẩu cần tối thiểu 6 ký tự.';
      } else if (msg.includes('invalid-email')) {
        msg = 'Địa chỉ Email không hợp lệ.';
      } else if (msg.includes('network-request-failed')) {
        msg = 'Không thể kết nối mạng. Bạn có thể bấm "Để sau".';
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-[#fffdfa] border border-[#ebdcc9] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Dải gradient phía trên */}
        <div className="h-2 w-full bg-gradient-to-r from-[#ea580c] via-[#f59e0b] to-[#10b981]" />

        {/* Nút đóng / Để sau ở góc */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] transition cursor-pointer"
          title="Để sau"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Phần Header Onboarding */}
        <div className="px-6 pt-6 pb-2 text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#ea580c]/10 text-[#ea580c] flex items-center justify-center mx-auto shadow-xs border border-[#ea580c]/20">
            <Cloud className="w-7 h-7" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-[#3e332a] tracking-tight">
            Đồng bộ dữ liệu lên đám mây ☁️
          </h3>

          <p className="text-xs text-[#7a6a58] leading-relaxed max-w-sm mx-auto">
            Đăng nhập để sao lưu an toàn Sổ Chi Tiêu. Nếu bỏ qua bây giờ, bạn vẫn có thể đăng nhập lại bất cứ lúc nào trong mục <strong>Cài đặt</strong>.
          </p>
        </div>

        {/* Phần Thân: Khu vực Form & Nút Đăng nhập */}
        <div className="px-6 py-4 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-xl bg-[#fee2e2] border border-[#fca5a5] flex items-start gap-2 text-xs text-[#991b1b] animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isOnline && (
            <div className="p-2.5 rounded-xl bg-[#fef3c7] border border-[#fde68a] text-xs text-[#92400e]">
              Thiết bị đang ngoại tuyến. Bạn có thể chọn <strong>Để sau</strong> để sử dụng bình thường.
            </div>
          )}

          {/* 1. NÚT ĐĂNG NHẬP GOOGLE TRỰC TIẾP */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleSubmitting || isSubmitting}
            className="w-full py-2.5 px-3 rounded-xl border border-[#d8c8b4] bg-white hover:bg-[#fbf5eb] active:scale-[0.99] text-xs sm:text-sm font-semibold text-[#3e332a] transition shadow-xs flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
          >
            {isGoogleSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-[#a25832] border-t-transparent rounded-full animate-spin" />
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
                <span>Tiếp tục với Google</span>
              </>
            )}
          </button>

          {/* Dải phân cách */}
          <div className="relative my-2.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#ebdcc9]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-[#fffdfa] px-2.5 text-[#7a6a58] font-semibold">
                Hoặc bằng Email
              </span>
            </div>
          </div>

          {/* 2. FORM ĐĂNG NHẬP / ĐĂNG KÝ EMAIL */}
          <div className="space-y-2.5">
            {/* Tabs chuyển chế độ */}
            <div className="flex bg-[#f5ebe0] p-0.5 rounded-xl border border-[#ebdcc9]">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
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
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                    : 'text-[#7a6a58] hover:text-[#3e332a]'
                }`}
              >
                Tạo tài khoản
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2">
              <div>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#a89886] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Địa chỉ Email"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] placeholder-[#a89886] focus:bg-white focus:outline-none focus:border-[#a25832]"
                  />
                </div>
              </div>

              <div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#a89886] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] placeholder-[#a89886] focus:bg-white focus:outline-none focus:border-[#a25832]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isGoogleSubmitting}
                className="w-full py-2.5 rounded-xl bg-[#a25832] hover:bg-[#8c4623] active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xử lý...</span>
                  </span>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Đăng nhập ngay' : 'Đăng ký tài khoản'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* NÚT PHỤ Ở DƯỚI CÙNG: "Để sau / Bỏ qua" */}
        <div className="p-4 pt-1 bg-[#fbf5eb] border-t border-[#f0e4d5] flex flex-col items-center gap-1.5 text-center">
          <button
            onClick={handleSkip}
            className="text-xs text-[#7a6a58] hover:text-[#3e332a] font-medium py-1 px-3 hover:underline cursor-pointer transition"
          >
            Để sau / Bỏ qua
          </button>
          <div className="flex items-center justify-center gap-1 text-[11px] text-[#a89886]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Dữ liệu vẫn được lưu trữ an toàn trên thiết bị của bạn</span>
          </div>
        </div>
      </div>
    </div>
  );
};
