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
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    continueOffline,
    isFirebaseAvailable,
    isOnline,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      console.warn('Lỗi xác thực:', err);
      let msg = err?.message || 'Đăng nhập không thành công.';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        msg = 'Email hoặc mật khẩu không chính xác.';
      } else if (msg.includes('email-already-in-use')) {
        msg = 'Email này đã được đăng ký trước đó.';
      } else if (msg.includes('weak-password')) {
        msg = 'Mật khẩu cần tối thiểu 6 ký tự.';
      } else if (msg.includes('network-request-failed')) {
        msg = 'Không thể kết nối mạng. Bạn có thể dùng chế độ Ngoại tuyến.';
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.warn('Lỗi Google Sign In:', err);
      setError(err?.message || 'Đăng nhập Google thất bại.');
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
          {/* Thông báo trạng thái ngoại tuyến nếu mất mạng hoặc chưa cấu hình */}
          {!isOnline && (
            <div className="p-3 rounded-xl bg-[#fef3c7] border border-[#fde68a] flex items-start gap-2 text-xs text-[#92400e]">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Thiết bị đang ngoại tuyến:</strong> Mọi thao tác thêm/sửa/xóa đều được lưu trên máy và tự động đồng bộ khi có mạng trở lại.
              </div>
            </div>
          )}

          {!isFirebaseAvailable && (
            <div className="p-3 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] text-xs text-[#7a6a58] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#3e332a]">
                <ShieldCheck className="w-4 h-4 text-[#a25832]" />
                <span>Chế độ Ngoại tuyến cục bộ đang hoạt động</span>
              </div>
              <p className="text-[11px]">
                Bạn có thể điền các biến cấu hình Firebase vào file <code>.env</code> bất cứ lúc nào để kích hoạt đồng bộ đám mây cá nhân.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-[#fee2e2] border border-[#fecaca] text-xs text-[#b91c1c] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isFirebaseAvailable ? (
            <>
              {/* Nút Đăng nhập Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] hover:bg-[#fbf5eb] active:scale-[0.99] transition font-semibold text-xs sm:text-sm text-[#3e332a] shadow-xs flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Đăng nhập với Google</span>
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-[#ebdcc9] w-full" />
                <span className="bg-[#fffdfa] px-2 text-[11px] text-[#a89886] uppercase font-bold tracking-wider">
                  Hoặc Email
                </span>
              </div>

              {/* Tabs Đăng nhập / Đăng ký */}
              <div className="flex bg-[#f5ebe0] p-0.5 rounded-xl border border-[#ebdcc9]">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    mode === 'login'
                      ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                      : 'text-[#7a6a58] hover:text-[#3e332a]'
                  }`}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    mode === 'register'
                      ? 'bg-[#fffdfa] text-[#3e332a] shadow-xs'
                      : 'text-[#7a6a58] hover:text-[#3e332a]'
                  }`}
                >
                  Đăng ký mới
                </button>
              </div>

              {/* Form Email / Pass */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#7a6a58] flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#a25832]" />
                    <span>Email:</span>
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
                    placeholder="Tối thiểu 6 ký tự..."
                    required
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:outline-none focus:border-[#a25832]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#a25832] text-white text-xs sm:text-sm font-bold hover:bg-[#8c4623] active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>{mode === 'login' ? 'Đăng nhập vào sổ' : 'Tạo tài khoản mới'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : null}

          {/* Nút BỎ QUA, DÙNG OFFLINE (Bắt buộc theo yêu cầu) */}
          <div className="pt-2 border-t border-[#f0e4d5]">
            <button
              type="button"
              onClick={() => continueOffline()}
              className="w-full py-2.5 px-4 rounded-xl border border-[#d8c8b4] bg-[#fbf5eb] hover:bg-[#f5ebe0] text-[#3e332a] text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <WifiOff className="w-4 h-4 text-[#7a6a58]" />
              <span>Bỏ qua, dùng Offline (Lưu trên thiết bị)</span>
            </button>
            <p className="text-[10px] text-[#a89886] text-center mt-1.5 italic">
              Không cần tài khoản, bạn vẫn có thể sử dụng đầy đủ mọi tính năng offline 100%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
