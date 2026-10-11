import React, { useRef } from 'react';
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
} from 'lucide-react';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onExportExcel?: () => void;
  onImport: (jsonString: string) => boolean;
  onReset: () => void;
  onOpenCategoryManager: () => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onExportExcel,
  onImport,
  onReset,
  onOpenCategoryManager,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a]">
                Cài Đặt & Sao Lưu Dữ Liệu
              </h3>
              <p className="text-xs text-[#7a6a58]">
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

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Category Manager button */}
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

          {/* Export Excel (.xlsx) */}
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

          {/* Export JSON */}
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
                  Lưu file JSON về điện thoại / máy tính để không lo mất số liệu.
                </div>
              </div>
            </div>
            <button
              onClick={onExport}
              className="w-full py-2 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] hover:bg-[#f5ebe0] transition flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#2e7d32]" />
              <span>Tải file sao lưu về máy</span>
            </button>
          </div>

          {/* Import JSON */}
          <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#3b6e8c]/10 text-[#3b6e8c] flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#3e332a]">
                  Khôi phục dữ liệu từ file
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

          {/* Reset button */}
          <div className="pt-2 border-t border-[#f0e4d5] flex items-center justify-between">
            <div className="text-[11px] text-[#7a6a58] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2e7d32]" />
              <span>Lưu an toàn trên LocalStorage</span>
            </div>
            <button
              onClick={() => {
                onReset();
                onClose();
              }}
              className="text-xs text-[#b94a3b] font-medium hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại dữ liệu mẫu</span>
            </button>
          </div>

          {/* App Info Badge */}
          <div className="p-2.5 rounded-xl bg-[#f5ebe0] text-center text-[11px] text-[#7a6a58]">
            <p className="font-semibold text-[#3e332a] flex items-center justify-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-[#a25832]" />
              Sổ Chi Tiêu v1.0.0
            </p>
            <p className="mt-0.5">Dành cho Web, Android APK (Capacitor)</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-end">
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
