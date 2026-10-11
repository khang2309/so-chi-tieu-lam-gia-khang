import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera as CameraIcon,
  Upload,
  Check,
  ScanLine,
  FileText,
  Trash2,
  Plus,
  Calendar,
  Layers,
  Wand2,
  Key,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  ExtractedBatchItem,
  InvoiceType,
} from '../utils/ocrParser';
import {
  extractInvoiceDataWithCloudVision,
  getSavedVisionConfig,
  saveVisionConfig,
  VisionConfig,
} from '../utils/cloudVisionService';
import { compressImageForOcr } from '../utils/imagePreprocessor';
import { Ledger, Wallet, Category, Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';



interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgers: Ledger[];
  wallets: Wallet[];
  categories: Category[];
  activeLedgerId: string;
  onSaveBatchTransactions: (
    items: Array<Omit<Transaction, 'id' | 'createdAt'>>
  ) => void;
}

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({
  isOpen,
  onClose,
  ledgers,
  wallets,
  categories,
  activeLedgerId,
  onSaveBatchTransactions,
}) => {
  const [step, setStep] = useState<'scan' | 'verify'>('scan');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cấu hình Cloud Vision API (Google Gemini)
  const [visionConfig, setVisionConfig] = useState<VisionConfig>(getSavedVisionConfig());
  const [showConfig, setShowConfig] = useState<boolean>(!getSavedVisionConfig().apiKey);
  const [apiKeyInput, setApiKeyInput] = useState<string>(getSavedVisionConfig().apiKey);
  const [scanMode, setScanMode] = useState<'split' | 'merge'>('split');

  // Cấu hình chung cho toàn bộ đợt quét
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');

  // Danh sách các giao dịch được tách ra (Batch items)
  const [batchItems, setBatchItems] = useState<ExtractedBatchItem[]>([]);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('TYPE_A_TABLE');
  const [invoiceTypeName, setInvoiceTypeName] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const cfg = getSavedVisionConfig();
    setVisionConfig(cfg);
    setApiKeyInput(cfg.apiKey);
    if (!cfg.apiKey) {
      setShowConfig(true);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleSaveVisionConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newCfg: VisionConfig = {
      provider: 'gemini',
      apiKey: apiKeyInput.trim(),
    };
    saveVisionConfig(newCfg);
    setVisionConfig(newCfg);
    setShowConfig(false);
  };

  // Hủy tiến trình quét AI Vision ngay lập tức
  const handleCancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setStatusMessage('');
    const input = document.getElementById('batch-receipt-file-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  // Phân tích hóa đơn bằng Cloud LLM Vision (Google Gemini Flash / OpenAI)
  const runCloudVisionOnImage = async (dataUrl: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProcessing(true);
    setStatusMessage('Đang nén ảnh (≤ 1024px) & làm nét chữ...');

    try {
      // 1. Nén ảnh cục bộ bằng Canvas API: tối đa 1024px, JPEG quality 0.7
      const enhancedDataUrl = await compressImageForOcr(dataUrl, 1024, 0.7);

      if (controller.signal.aborted) return;
      setProcessedImageUrl(enhancedDataUrl);

      // 2. Kiểm tra API Key
      const cfg = visionConfig.apiKey ? visionConfig : getSavedVisionConfig();
      if (!cfg.apiKey || cfg.apiKey.trim().length === 0) {
        setIsProcessing(false);
        setShowConfig(true);
        alert(
          'Chưa có API Key! Vui lòng dán Google Gemini API Key (miễn phí từ Google AI Studio) để AI phân tích hóa đơn.'
        );
        return;
      }

      setStatusMessage(
        scanMode === 'merge'
          ? 'Đang gửi ảnh lên Google Gemini Vision (Gộp thành 1 giao dịch)...'
          : 'Đang gửi ảnh lên Google Gemini Vision (Tách từng món)...'
      );
      const parsedResult = await extractInvoiceDataWithCloudVision(
        enhancedDataUrl,
        cfg,
        controller.signal,
        scanMode
      );

      if (controller.signal.aborted) return;

      setIsProcessing(false);
      setRawOcrText(parsedResult.rawText);
      setInvoiceType(parsedResult.invoiceType);
      setInvoiceTypeName(parsedResult.invoiceTypeName);
      setBatchItems(parsedResult.items);

      const defaultLedger =
        activeLedgerId !== 'all' ? activeLedgerId : ledgers[0]?.id || 'ledger-personal';
      setSelectedLedgerId(defaultLedger);
      setSelectedWalletId(wallets[0]?.id || 'wallet-cash');

      setStep('verify');
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted') || controller.signal.aborted) {
        console.log('Quá trình quét hóa đơn đã được hủy.');
        setIsProcessing(false);
        setStatusMessage('');
        return;
      }
      console.warn('Lỗi gọi Cloud Vision API:', err);
      setIsProcessing(false);
      alert(`Lỗi nhận diện Cloud AI: ${err?.message || err}. Vui lòng kiểm tra lại API Key hoặc kết nối mạng.`);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // Chụp ảnh bằng Capacitor Camera
  const handleTakePhoto = async () => {
    if (isProcessing) return;
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (photo.dataUrl) {
        await runCloudVisionOnImage(photo.dataUrl);
      }
    } catch {
      const input = document.getElementById('batch-receipt-file-input') as HTMLInputElement;
      input?.click();
    }
  };

  // Tải ảnh từ thư viện
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await runCloudVisionOnImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    // Reset file input để có thể chọn lại nếu muốn
    e.target.value = '';
  };


  // Cập nhật từng trường trong danh sách giao dịch
  const handleUpdateItem = (
    id: string,
    field: keyof ExtractedBatchItem,
    value: any
  ) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Xóa một dòng khỏi danh sách
  const handleDeleteItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Thêm thủ công 1 dòng vào danh sách
  const handleAddNewItem = () => {
    const today = new Date().toISOString().slice(0, 10);
    const newItem: ExtractedBatchItem = {
      id: 'batch-manual-' + Date.now(),
      date: today,
      amount: 50000,
      note: 'Khoản chi mới',
      categoryId: categories.find((c) => c.type === 'expense')?.id || 'cat-eat',
      rawLine: '',
    };
    setBatchItems((prev) => [...prev, newItem]);
  };

  // Bấm "Lưu tất cả"
  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchItems.length === 0) {
      alert('Danh sách giao dịch đang trống!');
      return;
    }

    // Chuyển đổi thành Transaction array
    const transactionsToSave = batchItems.map((item) => ({
      amount: Number(item.amount) || 0,
      type: 'expense' as const,
      date: new Date(`${item.date}T12:00:00`).toISOString(),
      categoryId: item.categoryId,
      ledgerId: selectedLedgerId,
      walletId: selectedWalletId,
      note: item.note.trim() || 'Khoản chi tiêu quét hóa đơn',
    }));

    onSaveBatchTransactions(transactionsToSave);
    onClose();
    setStep('scan');
  };

  const totalCalculated = batchItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
              <CameraIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a] flex items-center gap-2">
                {step === 'scan' ? (
                  'Quét Hóa Đơn Nhiều Dòng (Smart OCR)'
                ) : (
                  <>
                    <span>Kiểm Tra & Xác Nhận Hàng Loạt</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#a25832] text-white font-medium">
                      {batchItems.length} mục
                    </span>
                  </>
                )}
              </h3>
              <p className="text-xs text-[#7a6a58]">
                {step === 'scan'
                  ? 'Quét 1 tờ giấy tách thành nhiều giao dịch & tự động gán danh mục'
                  : 'Kiểm tra lại từng khoản chi trước khi lưu vào sổ'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleCancelScan();
              onClose();
              setStep('scan');
            }}
            className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BƯỚC 1: QUÉT ẢNH HOẶC CHỌN MẪU */}
        {step === 'scan' ? (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Hộp cấu hình Cloud AI Vision */}
            <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#3e332a] flex items-center gap-1.5">
                      <span>Động cơ: Google Gemini AI Vision</span>
                      {visionConfig.apiKey ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#dcfce7] text-[#15803d] font-semibold border border-[#bbf7d0]">
                          Đã kích hoạt
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#fee2e2] text-[#b91c1c] font-semibold border border-[#fecaca]">
                          Chưa có API Key
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#7a6a58]">
                      Nhận diện hóa đơn thông minh (Gemini 1.5 Flash / 2.0 Flash)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="text-xs font-semibold text-[#a25832] hover:underline flex items-center gap-1"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{showConfig ? 'Đóng' : 'Cấu hình Key'}</span>
                </button>
              </div>

              {showConfig && (
                <form onSubmit={handleSaveVisionConfig} className="pt-2 border-t border-[#f0e4d5] space-y-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-[#7a6a58] flex items-center justify-between">
                      <span>Google Gemini API Key:</span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#a25832] hover:underline flex items-center gap-0.5 font-medium"
                      >
                        <span>Lấy key miễn phí (Google AI Studio)</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Dán Gemini API Key (AIzaSy...)"
                      className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-mono text-[#3e332a] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-[10px] text-[#7a6a58] italic">
                      * Key được lưu bảo mật trong LocalStorage trình duyệt/thiết bị của bạn.
                    </p>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-[#a25832] text-white text-xs font-semibold hover:bg-[#8c4623] transition shadow-xs"
                    >
                      Lưu Key
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Tùy chọn Tách/Gộp hóa đơn */}
            <div className="p-3.5 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#3e332a] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#a25832]" />
                  <span>Chế độ trích xuất hóa đơn:</span>
                </div>
                <p className="text-[11px] text-[#7a6a58] mt-0.5">
                  {scanMode === 'split'
                    ? 'Tách chi tiết từng dòng mặt hàng thành nhiều khoản chi riêng lẻ'
                    : 'Gộp toàn bộ thành 1 khoản chi duy nhất với số tiền Tổng cộng'}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#fbf5eb] border border-[#ebdcc9] rounded-xl self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setScanMode('split')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    scanMode === 'split'
                      ? 'bg-[#a25832] text-white shadow-xs'
                      : 'text-[#7a6a58] hover:text-[#3e332a]'
                  } ${isProcessing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <span>Tách từng món</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-medium ${scanMode === 'split' ? 'bg-white/20 text-white' : 'bg-[#ebdcc9] text-[#7a6a58]'}`}>
                    Mặc định
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setScanMode('merge')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    scanMode === 'merge'
                      ? 'bg-[#a25832] text-white shadow-xs'
                      : 'text-[#7a6a58] hover:text-[#3e332a]'
                  } ${isProcessing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <span>Gộp 1 giao dịch</span>
                </button>
              </div>
            </div>

            {/* Vùng chụp / upload */}
            <div className="relative border-2 border-dashed border-[#ebdcc9] rounded-2xl p-6 text-center bg-[#fbf5eb] flex flex-col items-center justify-center overflow-hidden">
              {isProcessing && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#a25832]/25 to-transparent animate-pulse pointer-events-none flex items-center">
                  <div className="w-full h-1 bg-[#a25832] shadow-[0_0_12px_#a25832]" />
                </div>
              )}

              <div className="w-12 h-12 rounded-full bg-[#f5ebe0] text-[#a25832] flex items-center justify-center mb-2 shadow-xs">
                <ScanLine className={`w-6 h-6 ${isProcessing ? 'animate-spin' : ''}`} />
              </div>

              <p className="text-xs sm:text-sm font-semibold text-[#3e332a]">
                {isProcessing
                  ? statusMessage
                  : 'Chụp hoặc tải ảnh hóa đơn / biên lai'}
              </p>
              <p className="text-[11px] text-[#7a6a58] mt-0.5">
                AI Vision tự động nhận diện chữ tiếng Việt, bóc tách mặt hàng, giá tiền và phân loại danh mục
              </p>

              {/* Nút bấm màu đỏ "Hủy" (Cancel) ngay dưới thông báo đang gửi ảnh lên Gemini */}
              {isProcessing && (
                <div className="mt-3 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleCancelScan}
                    className="px-4 py-1.5 rounded-xl bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] text-xs font-bold border border-[#fca5a5] shadow-xs transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Hủy (Cancel)</span>
                  </button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-xl bg-[#a25832] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs ${
                    isProcessing
                      ? 'opacity-50 cursor-not-allowed pointer-events-none'
                      : 'hover:bg-[#8c4623] cursor-pointer'
                  }`}
                >
                  <CameraIcon className="w-4 h-4" />
                  <span>Chụp máy ảnh</span>
                </button>

                <label
                  className={`px-4 py-2 rounded-xl bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] transition shadow-xs flex items-center gap-1.5 ${
                    isProcessing
                      ? 'opacity-50 cursor-not-allowed pointer-events-none'
                      : 'hover:bg-[#f5ebe0] cursor-pointer'
                  }`}
                >
                  <Upload className="w-4 h-4 text-[#7a6a58]" />
                  <span>Chọn ảnh từ máy</span>
                  <input
                    id="batch-receipt-file-input"
                    type="file"
                    accept="image/*"
                    disabled={isProcessing}
                    onChange={handleUploadFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

          </div>
        ) : (
          /* BƯỚC 2: MÀN HÌNH XÁC NHẬN HÀNG LOẠT (BATCH CONFIRMATION UI) */
          <form onSubmit={handleSaveAll} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Banner tổng kết & Kiểu hóa đơn đã nhận diện */}
            <div className="p-3.5 rounded-xl bg-[#2e7d32]/10 border border-[#2e7d32]/25 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2e7d32] shrink-0" />
                  <span className="text-xs text-[#2e7d32] font-semibold">
                    Tách thành công {batchItems.length} giao dịch độc lập
                  </span>
                </div>
                <div className="text-xs text-[#3e332a] font-medium">
                  Tổng cộng:{' '}
                  <strong className="text-sm text-[#b94a3b] font-bold">
                    {formatCurrency(totalCalculated)}
                  </strong>
                </div>
              </div>

              {/* Kiểu hóa đơn & Tiền xử lý ảnh */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#2e7d32]/15 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#7a6a58] font-medium text-[11px]">Kiểu nhận diện:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                      invoiceType === 'TYPE_A_TABLE'
                        ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                        : invoiceType === 'TYPE_B_TRANSFER'
                        ? 'bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]'
                        : 'bg-[#fef3c7] text-[#b45309] border border-[#fde68a]'
                    }`}
                  >
                    {invoiceTypeName || 'Hóa đơn tự do'}
                  </span>
                </div>

                {processedImageUrl && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e0f2fe] text-[#0369a1] text-[10px] font-semibold border border-[#bae6fd]">
                    <Wand2 className="w-3 h-3 text-[#0284c7]" />
                    <span>Đã tiền xử lý: Grayscale + Tương phản 70% + Làm nét</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bộ chọn chung: Sổ và Ví áp dụng cho toàn bộ đợt quét */}
            <div className="p-3.5 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#3e332a]">
                <Layers className="w-4 h-4 text-[#a25832]" />
                <span>Áp dụng chung cho toàn bộ đợt quét này:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-[#7a6a58]">
                    Ghi vào Sổ:
                  </label>
                  <select
                    value={selectedLedgerId}
                    onChange={(e) => setSelectedLedgerId(e.target.value)}
                    className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
                  >
                    {ledgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#7a6a58]">
                    Trừ từ Ví:
                  </label>
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Danh sách các giao dịch tách được */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3e332a]">
                  Chi tiết từng khoản chi tiêu:
                </span>
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="text-xs text-[#a25832] font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng</span>
                </button>
              </div>

              <div className="space-y-2">
                {batchItems.map((item, index) => {
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] space-y-2 shadow-xs hover:border-[#d8c8b4] transition"
                    >
                      {/* Top row: Order, Date & Delete Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-5 h-5 rounded-full bg-[#f5ebe0] text-[#7a6a58] text-[10px] font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          {/* Ngày tháng */}
                          <div className="flex items-center gap-1 bg-[#fbf5eb] px-2 py-1 rounded-md border border-[#ebdcc9]">
                            <Calendar className="w-3 h-3 text-[#a25832]" />
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) =>
                                handleUpdateItem(item.id, 'date', e.target.value)
                              }
                              className="text-xs bg-transparent text-[#3e332a] font-medium focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Nút xóa dòng bị nhận diện nhầm */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 rounded text-[#a89886] hover:text-[#b94a3b] hover:bg-[#f5ebe0] transition"
                          title="Xóa dòng này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Middle row: Note & Amount */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Ghi chú */}
                        <div className="sm:col-span-2">
                          <textarea
                            rows={item.note && item.note.includes('\n') ? Math.min(6, item.note.split('\n').length) : 1}
                            value={item.note}
                            onChange={(e) =>
                              handleUpdateItem(item.id, 'note', e.target.value)
                            }
                            placeholder="Nội dung khoản chi..."
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none resize-y"
                          />
                        </div>

                        {/* Số tiền */}
                        <div>
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                'amount',
                                Number(e.target.value) || 0
                              )
                            }
                            placeholder="Số tiền..."
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-bold text-[#b94a3b] text-right focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Bottom row: Category Dropdown (AI auto-picked) */}
                      <div className="flex items-center gap-2 pt-1 border-t border-[#f0e4d5]/60">
                        <span className="text-[11px] text-[#7a6a58] font-medium shrink-0">
                          Danh mục:
                        </span>
                        <select
                          value={item.categoryId}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'categoryId', e.target.value)
                          }
                          className="flex-1 px-2.5 py-1 rounded-md bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:outline-none"
                        >
                          {categories
                            .filter((c) => c.type === 'expense' || c.type === 'both')
                            .map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Xem trước văn bản OCR gốc & Ảnh đã tiền xử lý */}
            {(rawOcrText || processedImageUrl) && (
              <details className="text-xs text-[#7a6a58] border border-[#ebdcc9] rounded-xl p-2.5 bg-[#fbf5eb]/60">
                <summary className="cursor-pointer font-medium flex items-center gap-1.5 text-[#3e332a]">
                  <FileText className="w-3.5 h-3.5" />
                  Xem chi tiết văn bản đọc được & ảnh đã tiền xử lý
                </summary>
                <div className="mt-2 space-y-2">
                  {processedImageUrl && (
                    <div>
                      <span className="text-[11px] font-semibold text-[#7a6a58]">
                        Ảnh sau khi tiền xử lý (Grayscale + Tương phản + Làm nét):
                      </span>
                      <img
                        src={processedImageUrl}
                        alt="Hóa đơn sau tiền xử lý"
                        className="mt-1 max-h-48 rounded-lg border border-[#ebdcc9] object-contain bg-white"
                      />
                    </div>
                  )}
                  {rawOcrText && (
                    <div>
                      <span className="text-[11px] font-semibold text-[#7a6a58]">
                        Văn bản thô OCR:
                      </span>
                      <pre className="mt-1 text-[10px] whitespace-pre-wrap font-mono p-2 rounded bg-[#fffdfa] border border-[#ebdcc9] max-h-24 overflow-y-auto">
                        {rawOcrText}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Actions Footer */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('scan')}
                className="px-3.5 py-2 rounded-xl border border-[#ebdcc9] text-xs font-medium text-[#7a6a58] hover:bg-[#f5ebe0]"
              >
                Quét lại
              </button>

              <button
                type="submit"
                disabled={batchItems.length === 0}
                className="px-5 py-2 rounded-xl bg-[#a25832] text-white text-xs font-bold hover:bg-[#8c4623] active:scale-95 transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Lưu tất cả ({batchItems.length} giao dịch)</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
