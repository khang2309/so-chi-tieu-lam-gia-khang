import React, { useEffect, useState, useMemo } from 'react';
import {
  Sparkles,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Zap,
  Package,
  RefreshCw,
} from 'lucide-react';
import {
  AppReleaseConfig,
  getCurrentRunningVersion,
  inspectNativeCapabilities,
  normalizeDownloadUrl,
} from '../utils/appUpdater';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  release: AppReleaseConfig | null;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  isOpen,
  onClose,
  release,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setErrorText(null);
    setIsUpdating(false);
    setProgress(0);
  }, [isOpen, release]);

  useEffect(() => {
    const handleProgress = (e: Event) => {
      const custom = e as CustomEvent<{
        progress: number;
        status: string;
        error?: string;
      }>;
      const detail = custom.detail;
      if (!detail) return;

      if (detail.error) {
        setIsUpdating(false);
        setErrorText(detail.error);
        return;
      }

      setProgress(detail.progress || 0);
      if (detail.status === 'downloading') {
        setStatusText(`Đang tải bản cập nhật (${detail.progress}%)...`);
      } else if (detail.status === 'extracting') {
        setStatusText('Đang giải nén & áp dụng bản cập nhật...');
      } else if (detail.status === 'installing') {
        setStatusText('Đã tải xong! Đang mở trình cài đặt Android...');
        setTimeout(() => setIsUpdating(false), 1500);
      } else if (detail.status === 'completed') {
        setStatusText('Cập nhật hoàn tất! Đang làm mới ứng dụng...');
      }
    };

    window.addEventListener('app-update-progress', handleProgress);
    return () => window.removeEventListener('app-update-progress', handleProgress);
  }, []);

  const caps = useMemo(() => inspectNativeCapabilities(), [isOpen]);

  if (!isOpen) return null;

  const currentVersion = getCurrentRunningVersion();
  const canSkip = release?.allowSkip !== false;

  const handleStartUpdate = () => {
    if (!release || !release.downloadUrl) return;
    setErrorText(null);
    setIsUpdating(true);
    setProgress(5);
    setStatusText('Đang kết nối máy chủ tải bản cập nhật...');

    const directUrl = normalizeDownloadUrl(release.downloadUrl);

    if (window.AndroidUpdater) {
      if (release.updateType === 'ota') {
        window.AndroidUpdater.downloadAndApplyOtaZip(directUrl, release.version);
      } else {
        window.AndroidUpdater.downloadAndInstallApk(directUrl);
      }
    } else {
      window.open(directUrl, '_blank');
      setIsUpdating(false);
    }
  };

  const handleSkipThisVersion = () => {
    if (release?.version) {
      try {
        localStorage.setItem('sochitieu_skipped_update_version', release.version);
      } catch (_) {}
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#a25832] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a]">
                {release ? 'Có Bản Cập Nhật Mới!' : 'Kiểm Tra Cập Nhật'}
              </h3>
              <p className="text-xs text-[#7a6a58]">
                Đang chạy: v{currentVersion}
                {window.AndroidUpdater ? ` • APK gốc: v${caps.nativeApkVersion}` : ''}
              </p>
            </div>
          </div>
          {canSkip && !isUpdating && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {release ? (
            <>
              {release.updateType === 'apk' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-950">
                        Kiểm tra hệ thống: Cần cài đặt lại file APK
                      </div>
                      <div className="text-[11px] leading-relaxed text-amber-800 mt-0.5">
                        Bản cài đặt gốc trên máy của bạn (v{caps.nativeApkVersion}) cần nâng cấp qua APK để tích hợp các tính năng hệ điều hành mới. Sau khi cài bản APK này, các bản cập nhật sau sẽ được nạp qua OTA trong 2 giây!
                      </div>
                    </div>
                  </div>
                  {caps.missingFeatures.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-100/60 border border-amber-200/80 text-[11px] space-y-1">
                      <div className="font-semibold text-amber-950">Tính năng hệ điều hành cần bổ sung:</div>
                      {caps.missingFeatures.map((feat: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 text-amber-900">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {release.updateType === 'ota' && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <Zap className="w-4 h-4 shrink-0 text-emerald-600" />
                  <div className="text-[11px] leading-relaxed text-emerald-800">
                    <span className="font-bold text-emerald-950">Cập nhật OTA siêu tốc:</span> Thiết bị đã có APK nền tảng (v{caps.nativeApkVersion}), quá trình cập nhật sẽ nạp tức thì trong 2 giây mà không cần cài lại file APK!
                  </div>
                </div>
              )}
              {/* Version Badge & Mode Badge */}
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9]">
                <div>
                  <div className="text-[11px] font-semibold text-[#7a6a58]">
                    Phiên bản mới nhất
                  </div>
                  <div className="text-lg font-extrabold text-[#a25832]">
                    v{release.version}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartUpdate}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs ${
                    release.updateType === 'ota'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 ring-2 ring-emerald-200'
                      : 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-400'
                  }`}
                  title={release.updateType === 'ota' ? 'Bấm để cập nhật nhanh ngay' : 'Bấm để tải APK'}
                >
                  {release.updateType === 'ota' ? (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                      <span>Cập nhật nhanh ⚡</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-3.5 h-3.5" />
                      <span>Cài APK 📦</span>
                    </>
                  )}
                </button>
              </div>

              {/* Release Notes */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#3e332a]">
                  Nội dung cập nhật:
                </div>
                <div className="p-3.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs text-[#544639] whitespace-pre-line leading-relaxed">
                  {release.releaseNotes || 'Cải thiện hiệu năng và bổ sung tính năng mới.'}
                </div>
              </div>

              {/* Progress Bar when updating */}
              {isUpdating && (
                <div className="p-3.5 rounded-xl bg-[#f5ebe0] border border-[#d8c8b4] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#3e332a]">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#a25832]" />
                      <span>{statusText}</span>
                    </span>
                    <span className="text-[#a25832]">{progress}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[#ebdcc9] overflow-hidden">
                    <div
                      className="h-full bg-[#a25832] transition-all duration-200 rounded-full"
                      style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorText && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Không thể tự động cập nhật:</div>
                    <div>{errorText}</div>
                  </div>
                </div>
              )}

              {/* User Choice Actions */}
              {!isUpdating && (
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleStartUpdate}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                      release.updateType === 'ota'
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        : 'bg-[#a25832] hover:bg-[#8c4623] text-white'
                    }`}
                  >
                    {release.updateType === 'ota' ? (
                      <>
                        <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                        <span>Cập nhật nhanh ngay (Áp dụng trong 2 giây)</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Tải & Cài đặt APK mới</span>
                      </>
                    )}
                  </button>
                  {release.updateType === 'ota' && (
                    <p className="text-[11px] text-center text-emerald-700 font-medium">
                      ✓ Nạp trực tiếp trong ứng dụng, không cần tải file APK về máy.
                    </p>
                  )}

                  {release.apkDownloadUrl && release.updateType === 'ota' && (
                    <button
                      type="button"
                      onClick={() => {
                        const directApkUrl = normalizeDownloadUrl(release.apkDownloadUrl!);
                        if (window.AndroidUpdater) {
                          window.AndroidUpdater.downloadAndInstallApk(directApkUrl);
                        } else {
                          window.open(directApkUrl, '_blank');
                        }
                      }}
                      className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#a25832]/40 bg-[#fbf5eb] hover:bg-[#ebdcc9] text-[#a25832] font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer"
                    >
                      <Package className="w-4 h-4 text-[#a25832]" />
                      <span>Hoặc tải cài đè APK mới nhất (Nếu bản gốc quá cũ)</span>
                    </button>
                  )}

                  {canSkip && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="py-2 px-3 rounded-xl border border-[#d8c8b4] bg-[#fffdfa] hover:bg-[#f5ebe0] text-[#3e332a] font-semibold text-xs transition cursor-pointer"
                      >
                        Để sau
                      </button>
                      <button
                        type="button"
                        onClick={handleSkipThisVersion}
                        className="py-2 px-3 rounded-xl border border-[#ebdcc9] bg-[#fbf5eb] hover:bg-[#f5ebe0] text-[#7a6a58] font-medium text-xs transition cursor-pointer"
                      >
                        Bỏ qua bản v{release.version}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#2e6f40] mx-auto" />
              <div className="text-sm font-bold text-[#3e332a]">
                Bạn đang dùng phiên bản mới nhất (v{currentVersion})
              </div>
              <p className="text-xs text-[#7a6a58]">
                Chưa có bản cập nhật nào mới hơn tại thời điểm này.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
