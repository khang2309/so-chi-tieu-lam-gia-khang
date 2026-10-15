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
  LogOut,
  CloudUpload,
  CheckCircle2,
  Cpu,
  Key,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSavedVisionConfig, saveVisionConfig } from '../utils/cloudVisionService';
import { getCurrentRunningVersion } from '../utils/appUpdater';
import {
  getBankNotifConfig,
  saveBankNotifConfig,
  isNotificationPermissionGranted,
  openAndroidNotificationSettings,
  getBankNotifHistoryLog,
  BankNotifConfig,
  BankNotifHistoryItem,
} from '../utils/bankNotificationService';

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
  onCheckUpdate?: () => void;
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
  onCheckUpdate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, isOnline, logout, openAuthModal } = useAuth();

  // Manual cloud sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Gemini AI Vision & Parser Config
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    try {
      return getSavedVisionConfig().apiKey || '';
    } catch {
      return '';
    }
  });
  const [geminiSaved, setGeminiSaved] = useState<boolean>(false);

  // Bank Notification Listener Config
  const [bankNotifConfig, setBankNotifConfig] = useState<BankNotifConfig>(() =>
    getBankNotifConfig()
  );
  const [notifPermGranted, setNotifPermGranted] = useState<boolean>(() =>
    isNotificationPermissionGranted()
  );
  const [notifHistory, setNotifHistory] = useState<BankNotifHistoryItem[]>(() =>
    getBankNotifHistoryLog()
  );
  const [isListenerConnected, setIsListenerConnected] = useState<boolean>(() => {
    try {
      return Boolean(window.AndroidUpdater?.isListenerConnected?.());
    } catch {
      return false;
    }
  });
  const [rawSystemLogs, setRawSystemLogs] = useState<any[]>(() => {
    try {
      const raw = window.AndroidUpdater?.getRawNotificationLog?.() || '[]';
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  // Logout Confirmation state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (onClearUserData) {
        onClearUserData();
      }
      await logout();
      setShowLogoutConfirm(false);
      onClose();
    } catch (err: any) {
      console.warn('Lỗi khi đăng xuất:', err);
      if (onClearUserData) onClearUserData();
      setShowLogoutConfirm(false);
      onClose();
    } finally {
      setIsLoggingOut(false);
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
                    onClick={() => setShowLogoutConfirm(true)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#fca5a5] bg-[#fef2f2] text-xs font-semibold text-[#b91c1c] hover:bg-[#fee2e2] active:scale-95 transition flex items-center gap-1 shrink-0 cursor-pointer"
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
              /* CHƯA ĐĂNG NHẬP: Gọn gàng, điều hướng mở AuthModal duy nhất ở Root */
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center shrink-0">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#3e332a]">Tài Khoản & Đồng Bộ Đám Mây</div>
                    <div className="text-[11px] text-[#7a6a58]">
                      Đăng nhập để đồng bộ và sao lưu dữ liệu tự động
                    </div>
                  </div>
                </div>

                {!isOnline && (
                  <div className="p-2 rounded-lg bg-[#fef3c7] border border-[#fde68a] text-[11px] text-[#92400e]">
                    Thiết bị đang ngoại tuyến. Khi có mạng trở lại, bạn có thể đăng nhập để đồng bộ.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthModal();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#a25832] hover:bg-[#8c4623] active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Đăng nhập / Đăng ký tài khoản</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION: CẤU HÌNH TRỢ LÝ AI */}
          <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ea580c]/10 text-[#ea580c] flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#3e332a] flex items-center gap-1.5">
                    <span>Cấu hình Trợ lý AI</span>
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
                    <span>Khóa API (API Key):</span>
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[#a25832] hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <span>Lấy key miễn phí</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Dán API Key (AIzaSy...)"
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

          {/* SECTION: TỰ ĐỘNG ĐỌC BIẾN ĐỘNG SỐ DƯ NGÂN HÀNG & VÍ ĐIỆN TỬ */}
          <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#0284c7]/10 text-[#0284c7] flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#3e332a] flex items-center gap-1.5 flex-wrap">
                    <span>Đọc Biến Động Số Dư (Ngân hàng & Ví)</span>
                    {notifPermGranted ? (
                      isListenerConnected ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#dcfce7] text-[#15803d] font-semibold border border-[#bbf7d0]">
                          Đang kết nối ngầm ✅
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#fef3c7] text-[#b45309] font-semibold border border-[#fde68a]">
                          Chờ kích hoạt lại ⚠️
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-semibold border border-red-200">
                        Chưa cấp quyền ❌
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#7a6a58]">
                    Tự động bắt thông báo từ Timo, MB Bank, VCB, MoMo, ZaloPay...
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#f0e4d5]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    openAndroidNotificationSettings();
                    setTimeout(() => {
                      const perm = isNotificationPermissionGranted();
                      setNotifPermGranted(perm);
                      setIsListenerConnected(Boolean(window.AndroidUpdater?.isListenerConnected?.()));
                    }, 2000);
                  }}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>
                    {notifPermGranted
                      ? 'Cài đặt Quyền đọc thông báo'
                      : 'Bật Quyền đọc thông báo trên máy'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const perm = isNotificationPermissionGranted();
                    setNotifPermGranted(perm);
                    window.AndroidUpdater?.triggerActiveNotificationsScan?.();
                    window.dispatchEvent(
                      new CustomEvent('show-app-toast', {
                        detail: 'Đang làm mới trạng thái & quét lại thông báo trên máy...',
                      })
                    );
                    setTimeout(() => {
                      setIsListenerConnected(Boolean(window.AndroidUpdater?.isListenerConnected?.()));
                      setNotifHistory(getBankNotifHistoryLog());
                      const raw = window.AndroidUpdater?.getRawNotificationLog?.() || '[]';
                      try { setRawSystemLogs(JSON.parse(raw)); } catch (_) {}
                    }, 500);
                  }}
                  className="p-2 rounded-lg border border-[#d8c8b4] bg-[#fbf5eb] text-[#3e332a] hover:bg-[#f5ebe0] transition cursor-pointer"
                  title="Làm mới trạng thái & Quét lại thông báo trên máy"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cảnh báo khi quyền đã bật nhưng Android/Xiaomi chưa bind lại Service */}
              {notifPermGranted && !isListenerConnected && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Hệ thống Android đang tạm ngắt kết nối dịch vụ</span>
                  </div>
                  <div className="text-[10.5px] leading-relaxed text-amber-800">
                    👉 <b>Cách kích hoạt trong 5 giây:</b> Bấm nút <b>"Cài đặt Quyền đọc thông báo"</b> ở trên ➔ Gạt <b>TẮT</b> quyền của Sổ Chi Tiêu rồi gạt <b>BẬT LẠI</b> ➔ Quay lại đây bấm nút 🔄 là trạng thái sẽ chuyển sang <b>"Đang kết nối ngầm ✅"</b> ngay lập tức!
                  </div>
                </div>
              )}

              {/* Hướng dẫn quan trọng cho điện thoại Xiaomi / Redmi / POCO */}
              <div className="p-2.5 rounded-lg bg-[#fefce8] border border-[#fef08a] text-[11px] text-[#854d0e] space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>💡 Lưu ý quan trọng cho điện thoại Xiaomi / HyperOS:</span>
                </div>
                <div className="text-[10.5px] leading-relaxed text-[#713f12]">
                  1. Vào Cài đặt máy ➔ Ứng dụng ➔ Quản lý ứng dụng ➔ <b>Sổ Chi Tiêu</b> ➔ Bật <b>"Tự khởi chạy" (Autostart)</b>.<br/>
                  2. Mục <b>Tiết kiệm pin</b> ➔ Chọn <b>"Không hạn chế" (No restrictions)</b> để hệ thống không tự ngắt dịch vụ đọc thông báo khi khóa màn hình.
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={bankNotifConfig.autoSave}
                  onChange={(e) => {
                    const next = { autoSave: e.target.checked };
                    setBankNotifConfig(next);
                    saveBankNotifConfig(next);
                  }}
                  className="w-4 h-4 rounded accent-[#a25832] mt-0.5"
                />
                <span className="text-xs font-semibold text-[#3e332a] leading-tight">
                  Tự động lưu và cập nhật số dư ví ngay lập tức (Nếu bỏ tích, thông báo sẽ nằm ở khay "Chờ duyệt" trên trang chủ để bạn bấm duyệt)
                </span>
              </label>

              {/* Nút thử nghiệm giả lập biến động số dư */}
              <div className="pt-1 space-y-1.5">
                <div className="text-[11px] font-bold text-[#5c4d3c] flex items-center justify-between">
                  <span>⚡ Thử nghiệm giả lập biến động số dư:</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.AndroidUpdater?.simulateTestNotification) {
                        window.AndroidUpdater.simulateTestNotification();
                        setTimeout(() => {
                          setNotifHistory(getBankNotifHistoryLog());
                          const raw = window.AndroidUpdater?.getRawNotificationLog?.() || '[]';
                          try { setRawSystemLogs(JSON.parse(raw)); } catch (_) {}
                        }, 400);
                      } else {
                        alert('Tính năng thử nghiệm hoạt động trên file cài đặt Android APK.');
                      }
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span>Test MB (+50.000đ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.AndroidUpdater?.simulateTestNotificationWithData) {
                        window.AndroidUpdater.simulateTestNotificationWithData(
                          'io.lifestyle.plus',
                          'Timo',
                          'Timo by BVBank',
                          'Bạn vừa nhận được 100.000đ từ NGUYEN VAN A. ND: Chuyen tien thu nghiem Timo'
                        );
                        setTimeout(() => {
                          setNotifHistory(getBankNotifHistoryLog());
                          const raw = window.AndroidUpdater?.getRawNotificationLog?.() || '[]';
                          try { setRawSystemLogs(JSON.parse(raw)); } catch (_) {}
                        }, 400);
                      } else {
                        alert('Tính năng thử nghiệm hoạt động trên file cài đặt Android APK.');
                      }
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Test Timo (+100.000đ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.AndroidUpdater?.simulateTestNotificationWithData) {
                        window.AndroidUpdater.simulateTestNotificationWithData(
                          'com.mservice.momopay',
                          'MoMo',
                          'MoMo',
                          'Số tiền: 15.000 đ về Túi Thần Tài. Vào Chat để phản hồi người gửi'
                        );
                        setTimeout(() => {
                          setNotifHistory(getBankNotifHistoryLog());
                          const raw = window.AndroidUpdater?.getRawNotificationLog?.() || '[]';
                          try { setRawSystemLogs(JSON.parse(raw)); } catch (_) {}
                        }, 400);
                      } else {
                        alert('Tính năng thử nghiệm hoạt động trên file cài đặt Android APK.');
                      }
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg border border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-800 text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                    <span>Test MoMo (+15k)</span>
                  </button>
                </div>
              </div>

              {/* Nhật ký đọc thông báo gần nhất (Debug Log) */}
              <div className="pt-2 border-t border-[#f0e4d5]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-[#5c4d3c] flex items-center gap-1">
                    📋 Nhật ký đọc thông báo gần nhất ({notifHistory.length})
                  </span>
                  {notifHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('sochitieu_bank_notif_history_log_v1');
                        setNotifHistory([]);
                      }}
                      className="text-[10px] text-stone-500 hover:text-stone-700 underline cursor-pointer"
                    >
                      Xóa nhật ký
                    </button>
                  )}
                </div>

                {notifHistory.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-center text-[10.5px] text-[#7a6a58]">
                    Chưa có thông báo nào được nhận. Khi máy nhận thông báo ngân hàng, thông tin sẽ hiển thị chi tiết tại đây!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {notifHistory.slice(0, 5).map((log) => (
                      <div
                        key={log.id}
                        className="p-2 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-[10.5px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-[#3e332a]">{log.appName}</span>
                          <span
                            className={
                              log.status === 'saved'
                                ? 'text-emerald-600'
                                : log.status === 'pending'
                                ? 'text-amber-600'
                                : 'text-stone-400'
                            }
                          >
                            {log.status === 'saved'
                              ? `Đã lưu: ${log.type === 'income' ? '+' : '-'}${log.amount?.toLocaleString()}đ`
                              : log.status === 'pending'
                              ? `Chờ duyệt: ${log.type === 'income' ? '+' : '-'}${log.amount?.toLocaleString()}đ`
                              : 'Bỏ qua (không khớp số tiền)'}
                          </span>
                        </div>
                        <div className="text-[#7a6a58] truncate">{log.text}</div>
                        <div className="text-[9.5px] text-stone-400">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {rawSystemLogs.length > 0 && (
                  <div className="pt-2 border-t border-[#f0e4d5]/60 mt-2">
                    <span className="text-[10.5px] font-bold text-stone-600 block mb-1">
                      📱 Log nhận diện từ hệ thống ({rawSystemLogs.length}):
                    </span>
                    <div className="space-y-1 max-h-28 overflow-y-auto font-mono text-[9.5px]">
                      {rawSystemLogs.slice(0, 5).map((r, i) => (
                        <div key={i} className="p-1.5 rounded bg-stone-100 text-stone-700">
                          <span className="font-bold">[{r.matchedApp || r.pkg}]</span> {r.title}: {r.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
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

          {/* SECTION 7: APP INFO & SMART 2-IN-1 UPDATER */}
          <div className="p-3.5 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#a25832]/15 text-[#a25832] flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#3e332a]">
                  Sổ Chi Tiêu — v{getCurrentRunningVersion()}
                </div>
                <div className="text-[11px] text-[#7a6a58] truncate">
                  Cập nhật thông minh 2 trong 1
                </div>
              </div>
            </div>

            {onCheckUpdate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCheckUpdate();
                }}
                className="py-2 px-3 rounded-lg bg-[#fffdfa] border border-[#d8c8b4] hover:bg-[#fbf5eb] text-xs font-bold text-[#3e332a] flex items-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#a25832]" />
                <span>Kiểm tra cập nhật</span>
              </button>
            )}
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

      {/* POPUP XÁC NHẬN ĐĂNG XUẤT & XÓA DỮ LIỆU CỤC BỘ */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl p-5 space-y-4 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#fef2f2] text-[#b91c1c] border border-[#fca5a5] flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-bold text-[#3e332a]">
                Xác nhận Đăng xuất?
              </h4>
              <p className="text-xs text-[#7a6a58] mt-1.5 leading-relaxed">
                Bạn có chắc muốn đăng xuất khỏi tài khoản{' '}
                <strong className="text-[#3e332a]">{user?.email}</strong>?
              </p>
              <div className="text-[11px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] p-3 rounded-xl mt-3 text-left space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>⚠️ Lưu ý quan trọng:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#991b1b]">
                  Dữ liệu trên máy này sẽ được dọn sạch hoàn toàn để bảo vệ riêng tư. Dữ liệu trên <strong>Cloud</strong> vẫn được bảo toàn 100% và sẽ đồng bộ lại đầy đủ khi bạn đăng nhập lại.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#d8c8b4] bg-[#fbf5eb] text-xs font-semibold text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isLoggingOut ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang đăng xuất...</span>
                  </span>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
