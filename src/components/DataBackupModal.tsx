import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  RotateCcw,
  Tags,
  Sliders,
  ShieldCheck,
  Smartphone,
  FileSpreadsheet,
  Cloud,
  Mail,
  Lock,
  LogOut,
  CloudUpload,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Key,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSavedVisionConfig, saveVisionConfig } from '../utils/cloudVisionService';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onExportExcel?: () => void;
  onImport: (jsonString: string) => boolean;
  onReset: () => void;
  onClearUserData?: () => void;
  onOpenCategoryManager: () => void;
  onSyncToCloud?: () => Promise<{ success: boolean; count?: number; message?: string }>;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onExportExcel,
  onImport,
  onReset,
  onClearUserData,
  onOpenCategoryManager,
  onSyncToCloud,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, isOnline, loginWithEmail, registerWithEmail, loginWithGoogleNative, logout } = useAuth();

  // Auth in-app state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Manual cloud sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Gemini AI Vision & Parser Config
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => getSavedVisionConfig().apiKey || '');
  const [geminiSaved, setGeminiSaved] = useState<boolean>(false);

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    saveVisionConfig({
      provider: 'gemini',
      apiKey: geminiApiKey.trim(),
    });
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 3000);
  };

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const success = onImport(text);
          if (success) {
            alert('Khôi phục dữ liệu sao lưu thành công!');
            onClose();
          } else {
            alert('Tệp dữ liệu không hợp lệ hoặc cấu trúc không đúng!');
          }
        } catch (err) {
          alert('Không thể đọc file: ' + String(err));
        }
      };
      reader.onerror = () => {
        alert('Lỗi khi đọc file sao lưu.');
      };
      reader.readAsText(file);
    }
    // Đảm bảo reset giá trị để có thể chọn lại cùng một file
    e.target.value = '';
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSyncFeedback(null);
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogleNative();
    } catch (err: any) {
      console.warn('Lỗi đăng nhập Google Native:', err);
      alert('Lỗi Firebase: ' + (err?.message || JSON.stringify(err)));
      const detail =
        typeof err === 'object'
          ? (err.message ? `${err.message} (${JSON.stringify(err)})` : JSON.stringify(err))
          : String(err);
      setAuthError(detail);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSyncFeedback(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setAuthError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    if (cleanPassword.length < 6) {
      setAuthError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      if (authMode === 'login') {
        await loginWithEmail(cleanEmail, cleanPassword);
      } else {
        await registerWithEmail(cleanEmail, cleanPassword);
      }
      setEmail('');
      setPassword('');
      setAuthError(null);
    } catch (err: any) {
      console.warn('Lỗi xác thực:', err);
      alert('Lỗi Firebase: ' + (err?.message || String(err)));
      let msg = err?.message || 'Thao tác không thành công.';
      if (
        msg.includes('user-not-found') ||
        msg.includes('wrong-password') ||
        msg.includes('invalid-credential')
      ) {
        msg = 'Email hoặc mật khẩu không chính xác.';
      } else if (msg.includes('email-already-in-use')) {
        msg = 'Email này đã tồn tại. Vui lòng bấm tab Đăng nhập.';
      } else if (msg.includes('weak-password')) {
        msg = 'Mật khẩu phải từ 6 ký tự trở lên.';
      } else if (msg.includes('invalid-email')) {
        msg = 'Địa chỉ Email không hợp lệ.';
      } else if (msg.includes('network-request-failed')) {
        msg = 'Không thể kết nối mạng. Vui lòng kiểm tra WiFi/4G.';
      }
      setAuthError(msg);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    if (!onSyncToCloud) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await onSyncToCloud();
      if (res.success) {
        setSyncFeedback(`Đồng bộ thành công! Đã gộp và sao lưu ${res.count ?? 0} bản ghi.`);
      } else {
        const errorMsg = res.message || 'Lỗi không xác định khi đồng bộ';
        setSyncFeedback(errorMsg);
        alert('Lỗi Firebase: ' + errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      setSyncFeedback('Lỗi: ' + errorMsg);
      alert('Lỗi Firebase: ' + errorMsg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    if (onClearUserData) {
      onClearUserData();
    }
    await logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md max-h-[90vh] rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#3e332a]">
                Cài Đặt & Sao Lưu Dữ Liệu
              </h3>
              <p className="text-[11px] text-[#7a6a58]">
                Sổ Chi Tiêu của Lâm Gia Khang
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* SECTION 1: FIREBASE CLOUD & IN-APP AUTH */}
          <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] shadow-xs space-y-3">
            {user ? (
              /* ĐÃ ĐĂNG NHẬP */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#15803d]/10 text-[#15803d] flex items-center justify-center shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#3e332a] flex items-center gap-1.5">
                        <span>Tài Khoản Đám Mây</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#dcfce7] text-[#15803d] font-semibold">
                          Đã kết nối
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7a6a58] truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 text-[#7a6a58] shrink-0" />
                        <span className="font-semibold text-[#3e332a] truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="px-2.5 py-1.5 rounded-lg border border-[#fca5a5] bg-[#fef2f2] text-xs font-semibold text-[#b91c1c] hover:bg-[#fee2e2] active:scale-95 transition flex items-center gap-1 shrink-0"
                    title="Đăng xuất tài khoản"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>

                <div className="text-[11px] text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] p-2.5 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Dữ liệu đang được đồng bộ an toàn trên Firebase Cloud.</span>
                </div>

                {onSyncToCloud && (
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="w-full py-2 rounded-lg bg-[#3d7a5a] text-white text-xs font-semibold hover:bg-[#326449] active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ toàn bộ số liệu lên Cloud'}</span>
                  </button>
                )}

                {syncFeedback && (
                  <div className="text-[11px] text-center font-medium text-[#3d7a5a]">
                    {syncFeedback}
                  </div>
                )}
              </div>
            ) : (
              /* CHƯA ĐĂNG NHẬP */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#3e332a]">Tài Khoản & Đồng Bộ Cloud</div>
                      <div className="text-[10px] text-[#d97706] font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d97706] animate-pulse" />
                        <span>Đang dùng Offline (LocalStorage)</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabs chuyển Đăng nhập / Đăng ký */}
                  <div className="flex p-0.5 rounded-lg bg-[#f0e4d5] border border-[#d8c8b4]">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                        authMode === 'login'
                          ? 'bg-[#fffdfa] text-[#a25832] shadow-xs'
                          : 'text-[#7a6a58] hover:text-[#3e332a]'
                      }`}
                    >
                      Đăng nhập
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError(null);
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                        authMode === 'register'
                          ? 'bg-[#fffdfa] text-[#a25832] shadow-xs'
                          : 'text-[#7a6a58] hover:text-[#3e332a]'
                      }`}
                    >
                      Đăng ký
                    </button>
                  </div>
                </div>

                {!isOnline && (
                  <div className="p-2 rounded-lg bg-[#fef3c7] border border-[#fde68a] text-[11px] text-[#92400e]">
                    Thiết bị đang ngoại tuyến. Khi có mạng trở lại, bạn có thể đăng nhập để đồng bộ.
                  </div>
                )}

                {authError && (
                  <div className="p-2 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[11px] text-[#b91c1c] flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Form In-App */}
                <form onSubmit={handleAuthSubmit} className="space-y-2">
                  <div>
                    <label className="text-[11px] font-semibold text-[#5a4c3f] flex items-center gap-1 mb-1">
                      <Mail className="w-3 h-3 text-[#a25832]" />
                      <span>Email:</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nhap-email@gmail.com"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#ebdcc9] bg-[#fbf5eb] focus:bg-white focus:outline-none focus:border-[#a25832] text-[#3e332a]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#5a4c3f] flex items-center gap-1 mb-1">
                      <Lock className="w-3 h-3 text-[#a25832]" />
                      <span>Mật khẩu:</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#ebdcc9] bg-[#fbf5eb] focus:bg-white focus:outline-none focus:border-[#a25832] text-[#3e332a]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="w-full py-2 rounded-lg bg-[#a25832] text-white text-xs font-bold hover:bg-[#8c4623] active:scale-[0.99] disabled:opacity-60 transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {isAuthSubmitting ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang xử lý...</span>
                      </span>
                    ) : authMode === 'login' ? (
                      <span>Đăng nhập ngay</span>
                    ) : (
                      <span>Tạo tài khoản & Đồng bộ</span>
                    )}
                  </button>
                </form>

                {/* Phân cách và Nút Đăng nhập bằng Google (Native) */}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#ebdcc9]" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-[#fffdfa] px-2 text-[#7a6a58] font-medium">Hoặc</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleSubmitting || isAuthSubmitting}
                  className="w-full py-2 px-3 rounded-lg border border-[#d8c8b4] bg-white hover:bg-[#fbf5eb] active:scale-[0.99] text-xs font-semibold text-[#3e332a] transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isGoogleSubmitting ? (
                    <span className="flex items-center gap-1.5">
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
            )}
          </div>

          {/* SECTION: CẤU HÌNH AI (GOOGLE GEMINI) */}
          <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ea580c]/10 text-[#ea580c] flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#3e332a] flex items-center gap-1.5">
                    <span>Cấu hình AI (Google Gemini)</span>
                    {getSavedVisionConfig().apiKey ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#dcfce7] text-[#15803d] font-semibold border border-[#bbf7d0]">
                        Đã kích hoạt
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#fef3c7] text-[#b45309] font-semibold border border-[#fde68a]">
                        Chưa có Key
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#7a6a58]">
                    Dùng cho Quét Hóa Đơn (OCR) và Phân tích câu nói giọng nói
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveGeminiKey} className="space-y-2 pt-1 border-t border-[#f0e4d5]">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5a4c3f] mb-1">
                  <span className="flex items-center gap-1">
                    <Key className="w-3 h-3 text-[#a25832]" />
                    <span>Gemini API Key:</span>
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[#a25832] hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <span>Lấy key miễn phí (Google AI Studio)</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Dán Gemini API Key (AIzaSy...)"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[#ebdcc9] bg-[#fbf5eb] focus:bg-white focus:outline-none focus:border-[#a25832] text-[#3e332a]"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[10px] text-[#7a6a58] italic">
                  * Key lưu trực tiếp trong máy của bạn, không gửi đi đâu khác.
                </span>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-bold hover:bg-[#8c4623] active:scale-95 transition shadow-xs flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{geminiSaved ? 'Đã lưu thành công!' : 'Lưu Key'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 2: CATEGORY MANAGER */}
          <button
            onClick={() => {
              onClose();
              onOpenCategoryManager();
            }}
            className="w-full p-3 rounded-xl border border-[#ebdcc9] bg-[#fbf5eb] hover:bg-[#f5ebe0] text-left transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#d97706]/15 text-[#d97706] flex items-center justify-center">
                <Tags className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[#3e332a] block">
                  Quản lý Danh mục chi tiêu
                </span>
                <span className="text-[11px] text-[#7a6a58]">
                  Thêm, đổi tên, chọn biểu tượng
                </span>
              </div>
            </div>
            <span className="text-xs text-[#a25832] font-semibold">Chỉnh sửa →</span>
          </button>

          {/* SECTION 3: EXPORT EXCEL (.xlsx) */}
          {onExportExcel && (
            <div className="p-3.5 rounded-xl border border-[#107c41]/25 bg-[#fffdfa] space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#107c41]/10 text-[#107c41] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#3e332a]">
                    Xuất dữ liệu ra Excel (.xlsx)
                  </div>
                  <div className="text-[11px] text-[#7a6a58]">
                    Đầy đủ cột Ngày, Tên món, Danh mục, Số tiền, Sổ, Ví để xem bảng tính.
                  </div>
                </div>
              </div>
              <button
                onClick={onExportExcel}
                className="w-full py-2 rounded-lg bg-[#107c41]/10 border border-[#107c41]/30 text-xs font-bold text-[#107c41] hover:bg-[#107c41] hover:text-white transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Tải bảng tính Excel (.xlsx)</span>
              </button>
            </div>
          )}

          {/* SECTION 4: EXPORT JSON */}
          <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#2e7d32]/10 text-[#2e7d32] flex items-center justify-center shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#3e332a]">
                  Xuất dữ liệu dự phòng (JSON)
                </div>
                <div className="text-[11px] text-[#7a6a58]">
                  Lưu file JSON về máy để không lo mất số liệu.
                </div>
              </div>
            </div>
            <button
              onClick={onExport}
              className="w-full py-2 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] hover:bg-[#f5ebe0] transition flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#2e7d32]" />
              <span>Tải file sao lưu JSON về máy</span>
            </button>
          </div>

          {/* SECTION 5: IMPORT JSON */}
          <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#3b6e8c]/10 text-[#3b6e8c] flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#3e332a]">
                  Khôi phục dữ liệu từ file JSON
                </div>
                <div className="text-[11px] text-[#7a6a58]">
                  Tải lên tệp JSON đã lưu trước đó để khôi phục toàn bộ sổ & ví.
                </div>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json,text/plain"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] hover:bg-[#f5ebe0] transition flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-[#3b6e8c]" />
              <span>Chọn file sao lưu để nạp</span>
            </button>
          </div>

          {/* SECTION 6: FOOTER STATUS & RESET BUTTON */}
          <div className="pt-2 border-t border-[#f0e4d5] flex items-center justify-between">
            <div className="text-[11px] flex items-center gap-1.5 font-medium">
              {user ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#15803d]" />
                  <span className="text-[#15803d]">Dữ liệu đang được đồng bộ an toàn trên Firebase Cloud</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#d97706]" />
                  <span className="text-[#7a6a58]">Đang dùng Offline (LocalStorage)</span>
                </>
              )}
            </div>
            <button
              onClick={() => {
                onReset();
                onClose();
              }}
              className="text-xs text-[#b94a3b] font-medium hover:underline flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </button>
          </div>

          {/* SECTION 7: APP INFO */}
          <div className="p-2.5 rounded-xl bg-[#f5ebe0] text-center text-[11px] text-[#7a6a58]">
            <p className="font-semibold text-[#3e332a] flex items-center justify-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-[#a25832]" />
              Sổ Chi Tiêu - Kyouma 2.0
            </p>
            <p className="mt-0.5">Dành cho Web, Android APK (Capacitor)</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#3e332a] text-[#fdf8f0] text-xs font-semibold hover:bg-[#2c241d] transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
