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
  BookOpen,
  Wallet as WalletIcon,
  ChevronDown,
  Sparkles,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  ExtractedBatchItem,
  InvoiceType,
} from '../utils/ocrParser';
import {
  extractInvoiceDataWithCloudVision,
  getSavedVisionConfig,
  VisionConfig,
} from '../utils/cloudVisionService';
import { compressImageForOcr } from '../utils/imagePreprocessor';
import { Ledger, Wallet, Category, Transaction } from '../types';
import { formatCurrency, toLocalDateKey } from '../utils/formatters';
import { parseAmountOrExpression } from '../utils/mathExpression';
import { SmartAmountInput } from './SmartAmountInput';
import { DynamicIcon } from './DynamicIcon';



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
  onAddLedger?: (data: Omit<Ledger, 'id' | 'createdAt'>) => Ledger;
  onAddWallet?: (data: Omit<Wallet, 'id' | 'createdAt'>) => Wallet;
}

const BatchItemAmountInput: React.FC<{
  initialAmount: number;
  onCommit: (val: number) => void;
  isZero?: boolean;
}> = ({ initialAmount, onCommit, isZero }) => {
  const [val, setVal] = useState(initialAmount === 0 ? '' : initialAmount.toString());

  useEffect(() => {
    setVal(initialAmount === 0 ? '' : initialAmount.toString());
  }, [initialAmount]);

  return (
    <SmartAmountInput
      value={val}
      onChange={setVal}
      onEvaluated={onCommit}
      size="compact"
      placeholder="Nhập số tiền..."
      className={`text-right font-bold transition ${
        isZero ? 'text-amber-800 bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/60' : 'text-[#b94a3b]'
      }`}
    />
  );
};

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({
  isOpen,
  onClose,
  ledgers,
  wallets,
  categories,
  activeLedgerId,
  onSaveBatchTransactions,
  onAddLedger,
  onAddWallet,
}) => {
  const [step, setStep] = useState<'scan' | 'verify'>('scan');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cấu hình Cloud Vision API (Google Gemini)
  const [visionConfig, setVisionConfig] = useState<VisionConfig>(getSavedVisionConfig());
  const [scanMode, setScanMode] = useState<'split' | 'merge'>('split');

  // Cấu hình chung cho toàn bộ đợt quét
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');

  // Trạng thái modal picker chọn & tạo nhanh Sổ / Ví
  const [showLedgerPicker, setShowLedgerPicker] = useState(false);
  const [isCreatingLedgerInPicker, setIsCreatingLedgerInPicker] = useState(false);
  const [newLedgerName, setNewLedgerName] = useState('');

  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [isCreatingWalletInPicker, setIsCreatingWalletInPicker] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('');

  // Danh sách các giao dịch được tách ra (Batch items)
  const [batchItems, setBatchItems] = useState<ExtractedBatchItem[]>([]);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('TYPE_A_TABLE');
  const [invoiceTypeName, setInvoiceTypeName] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const cfg = getSavedVisionConfig();
    setVisionConfig(cfg);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsCreatingLedgerInPicker(false);
      setIsCreatingWalletInPicker(false);
      setNewLedgerName('');
      setNewWalletName('');
      setNewWalletBalance('');

      const defL =
        (activeLedgerId && activeLedgerId !== 'all'
          ? ledgers.find((l) => l.id === activeLedgerId)
          : null) ||
        ledgers.find((l) => l.isDefault) ||
        ledgers[0];
      setSelectedLedgerId(defL?.id || '');

      const defW = wallets.find((w) => w.isDefault) || wallets[0];
      setSelectedWalletId(defW?.id || '');
    }
  }, [isOpen, activeLedgerId, ledgers, wallets]);

  const handleQuickInitDefaultLedgerAndWallet = () => {
    if (ledgers.length === 0 && onAddLedger) {
      const created = onAddLedger({
        name: 'Chi tiêu cá nhân',
        description: 'Sổ chi tiêu cá nhân mặc định',
        icon: 'BookOpen',
        color: '#a25832',
        isDefault: true,
      });
      setSelectedLedgerId(created.id);
    }
    if (wallets.length === 0 && onAddWallet) {
      const created = onAddWallet({
        name: 'Tiền mặt',
        initialBalance: 0,
        icon: 'Wallet',
        color: '#2e7d32',
        isDefault: true,
      });
      setSelectedWalletId(created.id);
    }
  };

  const handleCreateNewLedger = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (onAddLedger) {
      const created = onAddLedger({
        name: trimmed,
        description: 'Sổ chi tiêu',
        icon: 'BookOpen',
        color: '#a25832',
        isDefault: ledgers.length === 0,
      });
      setSelectedLedgerId(created.id);
    }
    setIsCreatingLedgerInPicker(false);
    setNewLedgerName('');
  };

  const handleCreateNewWallet = (name: string, initialBalanceStr: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const initialBalance = parseAmountOrExpression(initialBalanceStr, 0);
    if (onAddWallet) {
      const created = onAddWallet({
        name: trimmed,
        initialBalance: initialBalance,
        icon: 'Wallet',
        color: '#2e7d32',
        isDefault: wallets.length === 0,
      });
      setSelectedWalletId(created.id);
    }
    setIsCreatingWalletInPicker(false);
    setNewWalletName('');
    setNewWalletBalance('');
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!isOpen) return null;

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
        alert(
          'Chưa có API Key! Vui lòng vào mục Cài đặt -> Cấu hình Trợ lý AI để lưu API Key.'
        );
        return;
      }

      setStatusMessage(
        scanMode === 'merge'
          ? 'Đang gửi ảnh lên Trợ lý AI Vision (Gộp thành 1 giao dịch)...'
          : 'Đang gửi ảnh lên Trợ lý AI Vision (Tách từng món)...'
      );
      const parsedResult = await extractInvoiceDataWithCloudVision(
        enhancedDataUrl,
        cfg,
        controller.signal,
        scanMode,
        (modelName, reason) => {
          setStatusMessage(`Model ${modelName} ${reason}`);
        }
      );

      if (controller.signal.aborted) return;

      setIsProcessing(false);
      setRawOcrText(parsedResult.rawText);
      setInvoiceType(parsedResult.invoiceType);
      setInvoiceTypeName(parsedResult.invoiceTypeName);
      const cleanedItems = (parsedResult.items || []).map((it) => ({
        ...it,
        note: (it.note || '').replace(/\\n/g, '\n'),
      }));
      setBatchItems(cleanedItems);

      const defaultLedger =
        activeLedgerId !== 'all' ? activeLedgerId : ledgers[0]?.id || '';
      setSelectedLedgerId(defaultLedger);
      setSelectedWalletId(wallets.find((w) => w.isDefault)?.id || wallets[0]?.id || '');

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
    const today = toLocalDateKey(new Date());
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

    const zeroItems = batchItems.filter((it) => (Number(it.amount) || 0) === 0);
    if (zeroItems.length > 0) {
      const confirmSave = window.confirm(
        `Phát hiện ${zeroItems.length} món hàng đang có số tiền là 0 đ (do phiếu giao hàng không in sẵn giá tiền).\n\nBạn có muốn tiếp tục lưu các khoản này với số tiền 0 đ không? (Nhấn Hủy nếu bạn muốn chạm vào để nhập giá tiền thực tế)`
      );
      if (!confirmSave) return;
    }

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    let finalLedgerId = selectedLedgerId;
    if (!finalLedgerId || !ledgers.some((l) => l.id === finalLedgerId)) {
      if (ledgers.length > 0) {
        finalLedgerId = (ledgers.find((l) => l.isDefault) || ledgers[0]).id;
      } else if (onAddLedger) {
        const created = onAddLedger({
          name: 'Chi tiêu cá nhân',
          description: 'Sổ chi tiêu cá nhân mặc định',
          icon: 'BookOpen',
          color: '#a25832',
          isDefault: true,
        });
        finalLedgerId = created.id;
      }
    }

    let finalWalletId = selectedWalletId;
    if (!finalWalletId || !wallets.some((w) => w.id === finalWalletId)) {
      if (wallets.length > 0) {
        finalWalletId = (wallets.find((w) => w.isDefault) || wallets[0]).id;
      } else if (onAddWallet) {
        const created = onAddWallet({
          name: 'Tiền mặt',
          initialBalance: 0,
          icon: 'Wallet',
          color: '#2e7d32',
          isDefault: true,
        });
        finalWalletId = created.id;
      }
    }

    // Chuyển đổi thành Transaction array
    const transactionsToSave = batchItems.map((item) => ({
      amount: Number(item.amount) || 0,
      type: 'expense' as const,
      date: new Date(`${item.date}T${hh}:${mm}:${ss}`).toISOString(),
      categoryId: item.categoryId,
      ledgerId: finalLedgerId,
      walletId: finalWalletId,
      note: item.note.trim() || 'Khoản chi tiêu quét hóa đơn',
    }));

    onSaveBatchTransactions(transactionsToSave);
    onClose();
    setStep('scan');
  };

  const totalCalculated = batchItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  const selectedLedger = ledgers.find((l) => l.id === selectedLedgerId);
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);

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
                      invoiceType === 'TYPE_D_DELIVERY'
                        ? 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]'
                        : invoiceType === 'TYPE_A_TABLE'
                        ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                        : invoiceType === 'TYPE_B_TRANSFER'
                        ? 'bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]'
                        : 'bg-[#fef3c7] text-[#b45309] border border-[#fde68a]'
                    }`}
                  >
                    {invoiceTypeName || (invoiceType === 'TYPE_D_DELIVERY' ? 'Phiếu giao hàng / Vận đơn TMĐT' : 'Hóa đơn in / Bảng')}
                  </span>
                </div>

                {processedImageUrl && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e0f2fe] text-[#0369a1] text-[10px] font-semibold border border-[#bae6fd]">
                    <Wand2 className="w-3 h-3 text-[#0284c7]" />
                    <span>Đã nén tối ưu & làm nét chất lượng cao</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cảnh báo nhắc nhở nếu có món hàng 0 đ (Đơn Shopee trả trước) */}
            {batchItems.some((it) => (Number(it.amount) || 0) === 0) && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                <span className="text-base shrink-0">💡</span>
                <div className="flex-1">
                  <strong className="font-bold text-amber-950">Đơn hàng Shopee/TMĐT trả trước (0 đ):</strong>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Phiếu giao hàng không in sẵn giá tiền từng món. Vui lòng bấm vào ô số tiền màu vàng bên dưới để nhập giá thực tế bạn đã thanh toán trước khi lưu.
                  </p>
                </div>
              </div>
            )}

            {/* Banner tạo nhanh 1 chạm nếu chưa có Sổ hoặc Ví */}
            {(ledgers.length === 0 || wallets.length === 0) && (
              <div className="p-3 rounded-xl bg-[#fff8ed] border border-[#ebdcc9] flex items-center justify-between gap-2.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs text-[#a25832]">
                  <Sparkles className="w-4 h-4 shrink-0 text-[#a25832]" />
                  <span className="font-semibold text-[11px] leading-tight">
                    {ledgers.length === 0 && wallets.length === 0
                      ? 'Bạn chưa có Sổ & Ví tiền nào'
                      : ledgers.length === 0
                      ? 'Bạn chưa có Sổ ghi chép nào'
                      : 'Bạn chưa có Ví tiền nào'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleQuickInitDefaultLedgerAndWallet}
                  className="px-2.5 py-1 rounded-lg bg-[#a25832] text-white text-[11px] font-bold hover:bg-[#8c4623] active:scale-95 transition shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                  <span>Tạo nhanh 1 chạm</span>
                </button>
              </div>
            )}

            {/* Bộ chọn chung: Sổ và Ví áp dụng cho toàn bộ đợt quét */}
            <div className="p-3.5 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#3e332a]">
                  <Layers className="w-4 h-4 text-[#a25832]" />
                  <span>Áp dụng chung cho toàn bộ đợt quét này:</span>
                </div>
                {(ledgers.length === 0 || wallets.length === 0) && (
                  <button
                    type="button"
                    onClick={handleQuickInitDefaultLedgerAndWallet}
                    className="text-[11px] text-[#a25832] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 fill-amber-400 text-amber-500" />
                    <span>Tạo nhanh 1 chạm</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Ledger */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[#7a6a58]">Ghi vào Sổ:</label>
                    {onAddLedger && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowLedgerPicker(true);
                          setIsCreatingLedgerInPicker(true);
                        }}
                        className="text-[11px] text-[#a25832] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tạo sổ mới</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowLedgerPicker(true);
                      setIsCreatingLedgerInPicker(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] flex items-center justify-between gap-2 hover:bg-[#fbf5eb] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedLedger ? (
                        <>
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: selectedLedger.color || '#a25832' }}
                          >
                            <DynamicIcon name={selectedLedger.icon || 'BookOpen'} className="w-3 h-3 text-white" />
                          </div>
                          <span className="font-semibold text-xs text-[#3e332a] truncate">{selectedLedger.name}</span>
                        </>
                      ) : (
                        <span className="text-[#a89886] italic">(Tự động tạo Sổ cá nhân)</span>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-[#7a6a58] shrink-0" />
                  </button>
                </div>

                {/* Wallet */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[#7a6a58]">Trừ từ Ví:</label>
                    {onAddWallet && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowWalletPicker(true);
                          setIsCreatingWalletInPicker(true);
                        }}
                        className="text-[11px] text-[#a25832] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tạo ví mới</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowWalletPicker(true);
                      setIsCreatingWalletInPicker(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] flex items-center justify-between gap-2 hover:bg-[#fbf5eb] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedWallet ? (
                        <>
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: selectedWallet.color || '#2e7d32' }}
                          >
                            <DynamicIcon name={selectedWallet.icon || 'Wallet'} className="w-3 h-3 text-white" />
                          </div>
                          <span className="font-semibold text-xs text-[#3e332a] truncate">{selectedWallet.name}</span>
                        </>
                      ) : (
                        <span className="text-[#a89886] italic">(Tự động tạo Ví tiền mặt)</span>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-[#7a6a58] shrink-0" />
                  </button>
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
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
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

                          {(Number(item.amount) || 0) === 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                              Chưa có giá / Đã trả trước
                            </span>
                          )}
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
                          <BatchItemAmountInput
                            initialAmount={item.amount}
                            isZero={(Number(item.amount) || 0) === 0}
                            onCommit={(val) => handleUpdateItem(item.id, 'amount', val)}
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
        {/* Modal / Popup chọn Sổ */}
        {showLedgerPicker && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {isCreatingLedgerInPicker ? (
                    <button
                      type="button"
                      onClick={() => setIsCreatingLedgerInPicker(false)}
                      className="p-1 -ml-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-[#a25832]/10 text-[#a25832] flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-sm font-bold text-[#3e332a]">
                    {isCreatingLedgerInPicker ? 'Tạo Sổ Ghi Chép Mới' : 'Chọn Sổ Chi Tiêu'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLedgerPicker(false);
                    setIsCreatingLedgerInPicker(false);
                  }}
                  className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isCreatingLedgerInPicker ? (
                <div className="p-4 space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#7a6a58]">
                      Tên sổ ghi chép <span className="text-[#b94a3b]">*</span>
                    </label>
                    <input
                      type="text"
                      value={newLedgerName}
                      onChange={(e) => setNewLedgerName(e.target.value)}
                      placeholder="VD: Chi tiêu cá nhân, Du lịch..."
                      className="w-full px-3 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#a25832] focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newLedgerName.trim()) {
                            handleCreateNewLedger(newLedgerName);
                            setIsCreatingLedgerInPicker(false);
                            setShowLedgerPicker(false);
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingLedgerInPicker(false)}
                      className="flex-1 py-2.5 rounded-xl border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#fbf5eb] transition cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={!newLedgerName.trim()}
                      onClick={() => {
                        handleCreateNewLedger(newLedgerName);
                        setIsCreatingLedgerInPicker(false);
                        setShowLedgerPicker(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-[#a25832] disabled:opacity-50 text-white text-xs font-bold hover:bg-[#8c4623] active:scale-95 transition cursor-pointer shadow-xs"
                    >
                      Tạo & Chọn ngay
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 overflow-y-auto space-y-2 flex-1 overscroll-contain">
                  {ledgers.map((l) => {
                    const isSelected = selectedLedgerId === l.id;
                    return (
                      <button
                        type="button"
                        key={l.id}
                        onClick={() => {
                          setSelectedLedgerId(l.id);
                          setShowLedgerPicker(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-[#a25832] bg-[#fbf5eb] ring-1 ring-[#a25832]'
                            : 'border-[#ebdcc9] hover:bg-[#fbf5eb]/60 bg-[#fffdfa]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: l.color || '#a25832' }}
                          >
                            <DynamicIcon name={l.icon || 'BookOpen'} className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#3e332a] truncate">{l.name}</div>
                            {l.description ? (
                              <div className="text-[11px] text-[#7a6a58] truncate">{l.description}</div>
                            ) : (
                              <div className="text-[10px] text-[#a89886] italic">Sổ chi tiêu</div>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#2e7d32] shrink-0" />}
                      </button>
                    );
                  })}

                  {onAddLedger && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingLedgerInPicker(true)}
                      className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#a25832] bg-[#fff8ed] text-xs font-bold text-[#a25832] hover:bg-[#faebd7] transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tạo sổ mới...</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal / Popup chọn Ví */}
        {showWalletPicker && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {isCreatingWalletInPicker ? (
                    <button
                      type="button"
                      onClick={() => setIsCreatingWalletInPicker(false)}
                      className="p-1 -ml-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-[#2e7d32]/10 text-[#2e7d32] flex items-center justify-center">
                      <WalletIcon className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-sm font-bold text-[#3e332a]">
                    {isCreatingWalletInPicker ? 'Tạo Ví Tiền Mới' : 'Chọn Nguồn Tiền / Ví'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowWalletPicker(false);
                    setIsCreatingWalletInPicker(false);
                  }}
                  className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isCreatingWalletInPicker ? (
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#7a6a58]">
                      Tên ví tiền <span className="text-[#b94a3b]">*</span>
                    </label>
                    <input
                      type="text"
                      value={newWalletName}
                      onChange={(e) => setNewWalletName(e.target.value)}
                      placeholder="VD: Tiền mặt, Techcombank, MoMo..."
                      className="w-full px-3 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#2e7d32] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#7a6a58]">
                      Số dư khởi tạo (VNĐ)
                    </label>
                    <input
                      type="text"
                      value={newWalletBalance}
                      onChange={(e) => setNewWalletBalance(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-white focus:border-[#2e7d32] focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newWalletName.trim()) {
                            handleCreateNewWallet(newWalletName, newWalletBalance);
                            setIsCreatingWalletInPicker(false);
                            setShowWalletPicker(false);
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingWalletInPicker(false)}
                      className="flex-1 py-2.5 rounded-xl border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#fbf5eb] transition cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={!newWalletName.trim()}
                      onClick={() => {
                        handleCreateNewWallet(newWalletName, newWalletBalance);
                        setIsCreatingWalletInPicker(false);
                        setShowWalletPicker(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-[#2e7d32] disabled:opacity-50 text-white text-xs font-bold hover:bg-[#256629] active:scale-95 transition cursor-pointer shadow-xs"
                    >
                      Tạo & Chọn ngay
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 overflow-y-auto space-y-2 flex-1 overscroll-contain">
                  {wallets.map((w) => {
                    const isSelected = selectedWalletId === w.id;
                    return (
                      <button
                        type="button"
                        key={w.id}
                        onClick={() => {
                          setSelectedWalletId(w.id);
                          setShowWalletPicker(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-[#2e7d32] bg-[#fbf5eb] ring-1 ring-[#2e7d32]'
                            : 'border-[#ebdcc9] hover:bg-[#fbf5eb]/60 bg-[#fffdfa]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: w.color || '#2e7d32' }}
                          >
                            <DynamicIcon name={w.icon || 'Wallet'} className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#3e332a] truncate">{w.name}</div>
                            <div className="text-[11px] text-[#2e7d32] font-semibold">
                              Số dư: {formatCurrency(w.initialBalance || 0)}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#2e7d32] shrink-0" />}
                      </button>
                    );
                  })}

                  {onAddWallet && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingWalletInPicker(true)}
                      className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#2e7d32] bg-[#f0fdf4] text-xs font-bold text-[#2e7d32] hover:bg-[#dcfce7] transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tạo ví mới...</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
