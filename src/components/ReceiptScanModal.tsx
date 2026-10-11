import React, { useState } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Check,
  Receipt,
  ScanLine,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface SampleReceipt {
  id: string;
  name: string;
  store: string;
  amount: number;
  date: string;
  categoryId: string;
  note: string;
}

const SAMPLE_RECEIPTS: SampleReceipt[] = [
  {
    id: 'sample-gas',
    name: 'Hóa đơn Xăng Petrolimex',
    store: 'Cây xăng Petrolimex số 12',
    amount: 70000,
    date: new Date().toISOString().slice(0, 16),
    categoryId: 'cat-gas',
    note: 'Đổ xăng xe Yamaha Janus',
  },
  {
    id: 'sample-bhx',
    name: 'Hóa đơn Bách Hóa Xanh',
    store: 'Bách Hóa Xanh - Thực phẩm tươi sống',
    amount: 185000,
    date: new Date().toISOString().slice(0, 16),
    categoryId: 'cat-eat',
    note: 'Thịt bò, trứng gà và rau xanh',
  },
  {
    id: 'sample-cafe',
    name: 'Hóa đơn Highlands Coffee',
    store: 'Highlands Coffee',
    amount: 65000,
    date: new Date().toISOString().slice(0, 16),
    categoryId: 'cat-drink',
    note: 'Freeze trà xanh size M',
  },
  {
    id: 'sample-haircut',
    name: 'Hóa đơn Barbershop',
    store: '30Shine / Barbershop',
    amount: 90000,
    date: new Date().toISOString().slice(0, 16),
    categoryId: 'cat-haircut',
    note: 'Combo cắt gội sấy tóc',
  },
];

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyReceipt: (data: {
    amount: number;
    categoryId: string;
    note: string;
    date: string;
  }) => void;
}

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({
  isOpen,
  onClose,
  onApplyReceipt,
}) => {
  const [scanning, setScanning] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<SampleReceipt | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('sample-gas');
  const [customFilePreview, setCustomFilePreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartScan = (sample?: SampleReceipt) => {
    setScanning(true);
    setScannedResult(null);

    const target = sample || SAMPLE_RECEIPTS.find((s) => s.id === selectedSampleId) || SAMPLE_RECEIPTS[0];

    // Simulate OCR delay
    setTimeout(() => {
      setScanning(false);
      setScannedResult(target);
    }, 1200);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCustomFilePreview(reader.result as string);
        handleStartScan();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApply = () => {
    if (scannedResult) {
      onApplyReceipt({
        amount: scannedResult.amount,
        categoryId: scannedResult.categoryId,
        note: scannedResult.note,
        date: scannedResult.date,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a]">
                Quét Hóa Đơn Thông Minh (OCR)
              </h3>
              <p className="text-xs text-[#7a6a58]">
                Tự động bóc tách số tiền & danh mục
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
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Upload or Camera Area */}
          <div className="relative border-2 border-dashed border-[#ebdcc9] rounded-2xl p-6 text-center bg-[#fbf5eb] overflow-hidden flex flex-col items-center justify-center">
            {/* Laser scanning line animation */}
            {scanning && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#a25832]/20 to-transparent animate-pulse pointer-events-none flex items-center">
                <div className="w-full h-0.5 bg-[#a25832] shadow-[0_0_8px_#a25832]" />
              </div>
            )}

            {customFilePreview ? (
              <img
                src={customFilePreview}
                alt="Receipt Preview"
                className="max-h-40 rounded-lg object-contain shadow-sm mb-2"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#f5ebe0] text-[#a25832] flex items-center justify-center mb-2">
                <ScanLine className={`w-6 h-6 ${scanning ? 'animate-spin' : ''}`} />
              </div>
            )}

            <p className="text-xs font-semibold text-[#3e332a]">
              {scanning ? 'Đang phân tích ký tự OCR...' : 'Tải lên hóa đơn hoặc chụp từ điện thoại'}
            </p>
            <p className="text-[11px] text-[#7a6a58] mt-0.5">
              Hỗ trợ JPG, PNG, ảnh biên lai ngân hàng, hóa đơn đỏ
            </p>

            <div className="mt-3 flex items-center gap-2">
              <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] hover:bg-[#f5ebe0] transition shadow-xs flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#a25832]" />
                <span>Chọn ảnh từ máy</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => handleStartScan()}
                disabled={scanning}
                className="px-3.5 py-1.5 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quét ngay</span>
              </button>
            </div>
          </div>

          {/* Quick Sample Receipts for immediate testing */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[#7a6a58]">
              Hoặc chọn hóa đơn thực tế mẫu để thử nghiệm:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_RECEIPTS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    setSelectedSampleId(sample.id);
                    handleStartScan(sample);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedSampleId === sample.id
                      ? 'border-[#a25832] bg-[#fbf5eb] ring-1 ring-[#a25832]'
                      : 'border-[#ebdcc9] bg-[#fffdfa] hover:bg-[#fbf5eb]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium text-[#3e332a]">
                    <span className="truncate">{sample.name}</span>
                    <Receipt className="w-3.5 h-3.5 text-[#a25832] shrink-0" />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-[#7a6a58]">{sample.store}</span>
                    <span className="font-bold text-[#a25832]">
                      {formatCurrency(sample.amount)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* OCR Result Preview */}
          {scannedResult && (
            <div className="p-3.5 rounded-xl bg-[#2e7d32]/10 border border-[#2e7d32]/30 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-[#2e7d32] font-semibold">
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Bóc tách thành công từ hóa đơn!
                </span>
                <span>Độ chính xác: 99%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-[#fffdfa] p-2.5 rounded-lg border border-[#ebdcc9]">
                <div>
                  <span className="text-[10px] text-[#7a6a58]">Số tiền trích xuất:</span>
                  <div className="font-bold text-sm text-[#b94a3b]">
                    {formatCurrency(scannedResult.amount)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-[#7a6a58]">Nội dung:</span>
                  <div className="font-medium text-[#3e332a] truncate">
                    {scannedResult.note}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#ebdcc9] text-xs font-medium text-[#7a6a58] hover:bg-[#ebdcc9] transition"
          >
            Hủy
          </button>

          <button
            onClick={handleApply}
            disabled={!scannedResult}
            className="px-5 py-2 rounded-xl bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] active:scale-95 transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Áp dụng vào Giao dịch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
