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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onExportExcel?: () => void;
  onImport: (jsonString: string) => boolean;
  onReset: () => void;
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
  onOpenCategoryManager,
  onSyncToCloud,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, isOnline, loginWithEmail, registerWithEmail, logout } = useAuth();

  // Auth in-app state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Manual cloud sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const success = onImport(text);
        if (success) {
          alert('Khôi phục dữ liệu sao lưu thành công!');
          onClose();
        } else {
          alert('Tệp dữ liệu không hợp lệ hoặc bị lỗi!');
        }
      };
      reader.readAsText(file);
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
        setSyncFeedback(`Đã tải lên và sao lưu ${res.count ?? 0} bản ghi lên Cloud!`);
      } else {
        setSyncFeedback(res.message || 'Đồng bộ thất bại, vui lòng thử lại.');
      }
    } catch {
      setSyncFeedback('Lỗi kết nối khi đồng bộ lên Cloud.');
    } finally {
      setIsSyncing(false);
    }
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
                    onClick={logout}
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
              </div>
            )}
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
              accept=".json"
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
              Sổ Chi Tiêu v1.0.0
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
