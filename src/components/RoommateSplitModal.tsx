import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Zap,
  Droplets,
  Wifi,
  Home,
  Copy,
  Check,
  PlusCircle,
  Receipt,
  Calculator,
  ChevronDown,
} from 'lucide-react';
import { Ledger, Wallet, Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { CustomCalculatorKeyboard } from './CustomCalculatorKeyboard';
import {
  parseAmountOrExpression,
  evaluateMathExpression,
  isMathExpression,
  formatExpressionWithDots,
} from '../utils/mathExpression';

interface RoommateSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgers: Ledger[];
  wallets: Wallet[];
  onAddTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onAddBatchTransactions?: (items: Array<Omit<Transaction, 'id' | 'createdAt'>>) => void;
}

type ActiveField =
  | 'roomRent'
  | 'electricOld'
  | 'electricNew'
  | 'electricPrice'
  | 'waterOld'
  | 'waterNew'
  | 'waterPrice'
  | 'internetFee'
  | 'garbageFee'
  | null;

const FIELD_ORDER: Array<{ id: Exclude<ActiveField, null>; label: string }> = [
  { id: 'roomRent', label: 'Tiền phòng cơ bản' },
  { id: 'electricOld', label: 'Điện: Số cũ' },
  { id: 'electricNew', label: 'Điện: Số mới' },
  { id: 'electricPrice', label: 'Điện: Đơn giá/kWh' },
  { id: 'waterOld', label: 'Nước: Chỉ số cũ' },
  { id: 'waterNew', label: 'Nước: Chỉ số mới' },
  { id: 'waterPrice', label: 'Nước: Đơn giá/khối' },
  { id: 'internetFee', label: 'Tiền Wifi / Mạng' },
  { id: 'garbageFee', label: 'Rác & Dịch vụ' },
];

export const RoommateSplitModal: React.FC<RoommateSplitModalProps> = ({
  isOpen,
  onClose,
  ledgers,
  wallets,
  onAddTransaction,
  onAddBatchTransactions,
}) => {
  // Toàn bộ các con số đều để rỗng "" mặc định theo yêu cầu
  const [roomRent, setRoomRent] = useState<string>('');
  const [electricOld, setElectricOld] = useState<string>('');
  const [electricNew, setElectricNew] = useState<string>('');
  const [electricPrice, setElectricPrice] = useState<string>('');
  const [waterOld, setWaterOld] = useState<string>('');
  const [waterNew, setWaterNew] = useState<string>('');
  const [waterPrice, setWaterPrice] = useState<string>('');
  const [internetFee, setInternetFee] = useState<string>('');
  const [garbageFee, setGarbageFee] = useState<string>('');

  // Bàn phím máy tính Custom Calculator Keyboard (giống bên Thêm Giao Dịch)
  const [activeField, setActiveField] = useState<ActiveField>('roomRent');

  // Số người chia tiền
  const [roommatesCount, setRoommatesCount] = useState<number>(1);

  // Sổ và Ví: Luôn chọn đúng ví mặc định (isDefault === true)
  const defaultRoomLedger = ledgers.find((l) => l.id === 'ledger-room') || ledgers[0];
  const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];

  const [selectedLedgerId, setSelectedLedgerId] = useState<string>(
    defaultRoomLedger?.id || ''
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    defaultWallet?.id || ''
  );

  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Cập nhật Sổ & Ví khi mở modal (Tự động chọn đúng ví mặc định)
  useEffect(() => {
    if (isOpen) {
      const roomL = ledgers.find((l) => l.id === 'ledger-room') || ledgers[0];
      setSelectedLedgerId(roomL?.id || '');

      const defW = wallets.find((w) => w.isDefault) || wallets[0];
      setSelectedWalletId(defW?.id || '');
      setActiveField('roomRent');
    }
  }, [isOpen, ledgers, wallets]);

  if (!isOpen) return null;

  // ---- Tính toán số liệu (Hỗ trợ phép toán +, −, ×, ÷ cho toàn bộ các ô) ----
  const numRoomRent = parseAmountOrExpression(roomRent, 0);
  const numElectricOld = parseAmountOrExpression(electricOld, 0);
  const numElectricNew = parseAmountOrExpression(electricNew, 0);
  const numElectricPrice = parseAmountOrExpression(electricPrice, 0);
  const numWaterOld = parseAmountOrExpression(waterOld, 0);
  const numWaterNew = parseAmountOrExpression(waterNew, 0);
  const numWaterPrice = parseAmountOrExpression(waterPrice, 0);
  const numInternetFee = parseAmountOrExpression(internetFee, 0);
  const numGarbageFee = parseAmountOrExpression(garbageFee, 0);

  const electricKwh = Math.max(0, numElectricNew - numElectricOld);
  const totalElectric = electricKwh * numElectricPrice;

  const waterM3 = Math.max(0, numWaterNew - numWaterOld);
  const totalWater = waterM3 * numWaterPrice;

  const totalRoomExpense =
    numRoomRent + totalElectric + totalWater + numInternetFee + numGarbageFee;
  const count = roommatesCount > 0 ? roommatesCount : 1;
  const perPersonAmount = Math.round(totalRoomExpense / count);

  const selectedLedger = ledgers.find((l) => l.id === selectedLedgerId) || defaultRoomLedger;

  // Lấy giá trị hiện tại của ô đang focus vào bàn phím
  const getActiveValue = (): string => {
    switch (activeField) {
      case 'roomRent':
        return roomRent;
      case 'electricOld':
        return electricOld;
      case 'electricNew':
        return electricNew;
      case 'electricPrice':
        return electricPrice;
      case 'waterOld':
        return waterOld;
      case 'waterNew':
        return waterNew;
      case 'waterPrice':
        return waterPrice;
      case 'internetFee':
        return internetFee;
      case 'garbageFee':
        return garbageFee;
      default:
        return '';
    }
  };

  // Tính toán và định dạng lại giá trị nếu ô đang chứa biểu thức toán học
  const resolveMathValue = (val: string): string => {
    if (!val) return '';
    if (isMathExpression(val)) {
      const ev = evaluateMathExpression(val);
      if (ev !== null && !isNaN(ev) && isFinite(ev)) {
        return formatExpressionWithDots(Math.round(ev).toString());
      }
    }
    return val;
  };

  const evaluateField = (field: ActiveField) => {
    if (!field) return;
    switch (field) {
      case 'roomRent':
        setRoomRent((v) => resolveMathValue(v));
        break;
      case 'electricOld':
        setElectricOld((v) => resolveMathValue(v));
        break;
      case 'electricNew':
        setElectricNew((v) => resolveMathValue(v));
        break;
      case 'electricPrice':
        setElectricPrice((v) => resolveMathValue(v));
        break;
      case 'waterOld':
        setWaterOld((v) => resolveMathValue(v));
        break;
      case 'waterNew':
        setWaterNew((v) => resolveMathValue(v));
        break;
      case 'waterPrice':
        setWaterPrice((v) => resolveMathValue(v));
        break;
      case 'internetFee':
        setInternetFee((v) => resolveMathValue(v));
        break;
      case 'garbageFee':
        setGarbageFee((v) => resolveMathValue(v));
        break;
    }
  };

  // Chuyển trường: Tự động tính toán biểu thức ở trường cũ trước khi chuyển
  const switchField = (nextField: ActiveField) => {
    if (activeField && activeField !== nextField) {
      evaluateField(activeField);
    }
    setActiveField(nextField);
  };

  // Cập nhật giá trị từ bàn phím Custom (hỗ trợ đầy đủ số và các phép tính +, −, ×, ÷)
  const handleKeyboardChange = (newVal: string) => {
    if (!activeField) return;

    switch (activeField) {
      case 'roomRent':
        setRoomRent(newVal);
        break;
      case 'electricOld':
        setElectricOld(newVal);
        break;
      case 'electricNew':
        setElectricNew(newVal);
        break;
      case 'electricPrice':
        setElectricPrice(newVal);
        break;
      case 'waterOld':
        setWaterOld(newVal);
        break;
      case 'waterNew':
        setWaterNew(newVal);
        break;
      case 'waterPrice':
        setWaterPrice(newVal);
        break;
      case 'internetFee':
        setInternetFee(newVal);
        break;
      case 'garbageFee':
        setGarbageFee(newVal);
        break;
    }
  };

  // Nút Done (mũi tên xanh) trên bàn phím: Tính toán xong và chuyển sang ô kế tiếp
  const handleDone = () => {
    if (!activeField) return;
    evaluateField(activeField);
    const currentIdx = FIELD_ORDER.findIndex((f) => f.id === activeField);
    if (currentIdx !== -1 && currentIdx < FIELD_ORDER.length - 1) {
      setActiveField(FIELD_ORDER[currentIdx + 1].id);
    } else {
      setActiveField(null);
    }
  };

  // Gợi ý nhanh các mốc tiền cho từng ô
  const getActiveQuickAmounts = (): number[] => {
    switch (activeField) {
      case 'roomRent':
        return [500000, 1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000];
      case 'electricPrice':
        return [2500, 3000, 3500, 3800, 4000, 4500];
      case 'waterPrice':
        return [15000, 18000, 20000, 25000, 30000];
      case 'internetFee':
        return [50000, 80000, 100000, 150000, 200000, 250000];
      case 'garbageFee':
        return [20000, 30000, 40000, 50000, 60000, 80000];
      default:
        return [];
    }
  };

  const breakdownSummary = `🏠 BẢNG TÍNH TIỀN TRỌ THÁNG (CHIA ${count} NGƯỜI):
----------------------------------
1. Tiền phòng: ${formatCurrency(numRoomRent)}
2. Tiền điện: (${numElectricNew} - ${numElectricOld} = ${electricKwh} kWh x ${formatCurrency(numElectricPrice)}/kWh) = ${formatCurrency(totalElectric)}
3. Tiền nước: (${numWaterNew} - ${numWaterOld} = ${waterM3} khối x ${formatCurrency(numWaterPrice)}/m³) = ${formatCurrency(totalWater)}
4. Tiền Wifi/Internet: ${formatCurrency(numInternetFee)}
5. Phí rác & dịch vụ: ${formatCurrency(numGarbageFee)}
----------------------------------
👉 TỔNG CỘNG CẢ PHÒNG: ${formatCurrency(totalRoomExpense)}
👉 MỖI BẠN ĐÓNG: ${formatCurrency(perPersonAmount)}/người
(Lâm Gia Khang + ${count - 1} bạn)`;

  const handleCopy = () => {
    navigator.clipboard.writeText(breakdownSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // TÁCH RIÊNG TỪNG GIAO DỊCH VÀO SỔ ĐÃ CHỌN
  const handleSaveToLedger = () => {
    if (activeField) {
      evaluateField(activeField);
    }
    const itemsToSave: Array<Omit<Transaction, 'id' | 'createdAt'>> = [];
    const nowIso = new Date().toISOString();
    const targetLedgerId = selectedLedgerId || defaultRoomLedger?.id || 'ledger-room';

    // 1. Tiền phòng
    const roomRentShare = Math.round(numRoomRent / count);
    if (roomRentShare > 0) {
      itemsToSave.push({
        amount: roomRentShare,
        type: 'expense',
        date: nowIso,
        categoryId: 'cat-bills',
        ledgerId: targetLedgerId,
        walletId: selectedWalletId,
        note: `Tiền phòng trọ (chia ${count} người - tổng ${formatCurrency(numRoomRent)})`,
      });
    }

    // 2. Tiền điện
    const electricShare = Math.round(totalElectric / count);
    if (electricShare > 0) {
      itemsToSave.push({
        amount: electricShare,
        type: 'expense',
        date: nowIso,
        categoryId: 'cat-bills',
        ledgerId: targetLedgerId,
        walletId: selectedWalletId,
        note: `Tiền điện (${electricKwh} kWh, chia ${count} người - tổng ${formatCurrency(totalElectric)})`,
      });
    }

    // 3. Tiền nước
    const waterShare = Math.round(totalWater / count);
    if (waterShare > 0) {
      itemsToSave.push({
        amount: waterShare,
        type: 'expense',
        date: nowIso,
        categoryId: 'cat-bills',
        ledgerId: targetLedgerId,
        walletId: selectedWalletId,
        note: `Tiền nước (${waterM3} m³, chia ${count} người - tổng ${formatCurrency(totalWater)})`,
      });
    }

    // 4. Tiền Wifi
    const internetShare = Math.round(numInternetFee / count);
    if (internetShare > 0) {
      itemsToSave.push({
        amount: internetShare,
        type: 'expense',
        date: nowIso,
        categoryId: 'cat-bills',
        ledgerId: targetLedgerId,
        walletId: selectedWalletId,
        note: `Tiền wifi / internet (chia ${count} người - tổng ${formatCurrency(numInternetFee)})`,
      });
    }

    // 5. Tiền rác & dịch vụ
    const garbageShare = Math.round(numGarbageFee / count);
    if (garbageShare > 0) {
      itemsToSave.push({
        amount: garbageShare,
        type: 'expense',
        date: nowIso,
        categoryId: 'cat-bills',
        ledgerId: targetLedgerId,
        walletId: selectedWalletId,
        note: `Tiền rác & dịch vụ trọ (chia ${count} người - tổng ${formatCurrency(numGarbageFee)})`,
      });
    }

    if (itemsToSave.length === 0) {
      alert('Chưa có khoản chi nào lớn hơn 0 để lưu!');
      return;
    }

    if (onAddBatchTransactions) {
      onAddBatchTransactions(itemsToSave);
    } else {
      itemsToSave.forEach((it) => onAddTransaction(it));
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full sm:max-w-lg sm:m-3 rounded-t-2xl sm:rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150"
        style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 8px)' }}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb] rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#3d7a5a]/15 text-[#3d7a5a] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[#3e332a] truncate">
                Tính Tiền Trọ (Chia {count} Người)
              </h3>
              <p className="text-[11px] text-[#7a6a58] truncate">
                Tách giao dịch độc lập vào Sổ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Nút lưu nhanh ngay trên Header */}
            <button
              onClick={handleSaveToLedger}
              disabled={savedSuccess || totalRoomExpense <= 0}
              className="px-3 py-1.5 rounded-lg bg-[#3d7a5a] text-white text-xs font-bold hover:bg-[#316248] active:scale-95 transition shadow-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Đã lưu!</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Lưu</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#ebdcc9] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body — scrollable */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3 overscroll-contain">
          {/* Room Rent */}
          <div
            onClick={() => switchField('roomRent')}
            className={`p-3 rounded-xl border transition cursor-pointer select-none ${
              activeField === 'roomRent'
                ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25 shadow-xs'
                : 'bg-[#fbf5eb] border-[#ebdcc9] hover:bg-[#f5ebe0]/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#3e332a] flex items-center gap-1.5 cursor-pointer">
                <Home className="w-4 h-4 text-[#a25832]" />
                <span>Tiền phòng cơ bản</span>
              </label>
              <span className="text-xs font-bold text-[#a25832]">
                {formatCurrency(numRoomRent)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-3 py-2 rounded-lg bg-[#fffdfa] border border-[#ebdcc9]">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className={`text-xs font-bold truncate ${roomRent ? 'text-[#3e332a]' : 'text-[#a89886]'}`}>
                  {roomRent || 'Nhập tiền phòng...'}
                </span>
                {isMathExpression(roomRent) && (
                  <span className="text-[11px] font-bold text-emerald-600 shrink-0">
                    = {formatExpressionWithDots(Math.round(numRoomRent).toString())}
                  </span>
                )}
              </div>
              {activeField === 'roomRent' && (
                <span className="w-1.5 h-4 bg-[#a25832] rounded-full animate-pulse shrink-0 ml-1" />
              )}
            </div>
          </div>

          {/* Electricity Section */}
          <div className="p-3 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#3e332a] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#ca8a04]" />
                <span>Tiền điện ({electricKwh} kWh = {formatCurrency(totalElectric)})</span>
              </label>
              <span className="text-xs font-bold text-[#ca8a04]">
                {formatCurrency(totalElectric)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div
                onClick={() => switchField('electricOld')}
                className={`p-2 rounded-lg border transition cursor-pointer select-none ${
                  activeField === 'electricOld'
                    ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25'
                    : 'bg-[#fffdfa] border-[#ebdcc9]'
                }`}
              >
                <span className="text-[10px] text-[#7a6a58] block">Số cũ:</span>
                <div className="text-xs font-bold text-[#3e332a] truncate mt-0.5 flex items-center gap-1">
                  <span className="truncate">{electricOld || <span className="text-[#a89886] font-normal">0</span>}</span>
                  {isMathExpression(electricOld) && (
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                      = {formatExpressionWithDots(Math.round(numElectricOld).toString())}
                    </span>
                  )}
                </div>
              </div>

              <div
                onClick={() => switchField('electricNew')}
                className={`p-2 rounded-lg border transition cursor-pointer select-none ${
                  activeField === 'electricNew'
                    ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25'
                    : 'bg-[#fffdfa] border-[#ebdcc9]'
                }`}
              >
                <span className="text-[10px] text-[#7a6a58] block">Số mới:</span>
                <div className="text-xs font-bold text-[#3e332a] truncate mt-0.5 flex items-center gap-1">
                  <span className="truncate">{electricNew || <span className="text-[#a89886] font-normal">0</span>}</span>
                  {isMathExpression(electricNew) && (
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                      = {formatExpressionWithDots(Math.round(numElectricNew).toString())}
                    </span>
                  )}
                </div>
              </div>

              <div
                onClick={() => switchField('electricPrice')}
                className={`p-2 rounded-lg border transition cursor-pointer select-none ${
                  activeField === 'electricPrice'
                    ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25'
                    : 'bg-[#fffdfa] border-[#ebdcc9]'
                }`}
              >
                <span className="text-[10px] text-[#7a6a58] block">Đơn giá/kWh:</span>
                <div className="text-xs font-bold text-[#3e332a] truncate mt-0.5 flex items-center gap-1">
                  <span className="truncate">{electricPrice || <span className="text-[#a89886] font-normal">3.500</span>}</span>
                  {isMathExpression(electricPrice) && (
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                      = {formatExpressionWithDots(Math.round(numElectricPrice).toString())}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Water Section */}
          <div className="p-3 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#3e332a] flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-[#0284c7]" />
                <span>Tiền nước ({waterM3} khối = {formatCurrency(totalWater)})</span>
              </label>
              <span className="text-xs font-bold text-[#0284c7]">
                {formatCurrency(totalWater)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div
                onClick={() => switchField('waterOld')}
                className={`p-2 rounded-lg border transition cursor-pointer select-none ${
                  activeField === 'waterOld'
                    ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25'
                    : 'bg-[#fffdfa] border-[#ebdcc9]'
                }`}
              >
                <span className="text-[10px] text-[#7a6a58] block">Chỉ số cũ:</span>
                <div className="text-xs font-bold text-[#3e332a] truncate mt-0.5 flex items-center gap-1">
                  <span className="truncate">{waterOld || <span className="text-[#a89886] font-normal">0</span>}</span>
                  {isMathExpression(waterOld) && (
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                      = {formatExpressionWithDots(Math.round(numWaterOld).toString())}
                    </span>
                  )}
                </div>
              </div>

              <div
                onClick={() => switchField('waterNew')}
                className={`p-2 rounded-lg border transition cursor-pointer select-none ${
                  activeField === 'waterNew'
                    ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25'
                    : 'bg-[#fffdfa] border-[#ebdcc9]'
                }`}
              >
                <span className="text-[10px] text-[#7a6a58] block">Chỉ số mới:</span>
                <div className="text-xs font-bold text-[#3e332a] truncate mt-0.5 flex items-center gap-1">
                  <span className="truncate">{waterNew || <span className="text-[#a89886] font-normal">0</span>}</span>
                  {isMathExpression(waterNew) && (
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                      = {formatExpressionWithDots(Math.round(numWaterNew).toString())}
                    </span>
                  )}
                </div>
              </div>

              <div
                onClick={() => switchField('waterPrice')}
                className={`p-2 rounded-lg border transition cursor-pointer select-none ${
                  activeField === 'waterPrice'
                    ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25'
                    : 'bg-[#fffdfa] border-[#ebdcc9]'
                }`}
              >
                <span className="text-[10px] text-[#7a6a58] block">Đơn giá/khối:</span>
                <div className="text-xs font-bold text-[#3e332a] truncate mt-0.5 flex items-center gap-1">
                  <span className="truncate">{waterPrice || <span className="text-[#a89886] font-normal">25.000</span>}</span>
                  {isMathExpression(waterPrice) && (
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                      = {formatExpressionWithDots(Math.round(numWaterPrice).toString())}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Internet & Garbage Fees */}
          <div className="grid grid-cols-2 gap-2">
            <div
              onClick={() => switchField('internetFee')}
              className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                activeField === 'internetFee'
                  ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25'
                  : 'bg-[#fbf5eb] border-[#ebdcc9]'
              }`}
            >
              <label className="text-[11px] font-semibold text-[#3e332a] flex items-center gap-1 cursor-pointer">
                <Wifi className="w-3.5 h-3.5 text-[#7c3aed]" />
                <span>Tiền Wifi / Mạng</span>
              </label>
              <div className="text-xs font-bold text-[#3e332a] truncate mt-1 flex items-center gap-1">
                <span className="truncate">{internetFee || <span className="text-[#a89886] font-normal">0</span>}</span>
                {isMathExpression(internetFee) && (
                  <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                    = {formatExpressionWithDots(Math.round(numInternetFee).toString())}
                  </span>
                )}
              </div>
            </div>

            <div
              onClick={() => switchField('garbageFee')}
              className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                activeField === 'garbageFee'
                  ? 'bg-white border-[#a25832] ring-2 ring-[#a25832]/25'
                  : 'bg-[#fbf5eb] border-[#ebdcc9]'
              }`}
            >
              <label className="text-[11px] font-semibold text-[#3e332a] flex items-center gap-1 cursor-pointer">
                <Receipt className="w-3.5 h-3.5 text-[#6b7280]" />
                <span>Rác & Dịch vụ</span>
              </label>
              <div className="text-xs font-bold text-[#3e332a] truncate mt-1 flex items-center gap-1">
                <span className="truncate">{garbageFee || <span className="text-[#a89886] font-normal">0</span>}</span>
                {isMathExpression(garbageFee) && (
                  <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                    = {formatExpressionWithDots(Math.round(numGarbageFee).toString())}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Roommates Count */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9]">
            <span className="text-xs font-semibold text-[#3e332a] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#3d7a5a]" />
              <span>Số người chia tiền:</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoommatesCount(Math.max(1, roommatesCount - 1))}
                className="w-7 h-7 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-bold text-[#3e332a] active:scale-95 transition"
              >
                -
              </button>
              <span className="w-6 text-center text-sm font-bold text-[#3e332a]">
                {roommatesCount}
              </span>
              <button
                type="button"
                onClick={() => setRoommatesCount(roommatesCount + 1)}
                className="w-7 h-7 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-bold text-[#3e332a] active:scale-95 transition"
              >
                +
              </button>
            </div>
          </div>

          {/* Calculation Summary Card */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] space-y-2">
            <div className="flex items-center justify-between text-xs text-[#7a6a58]">
              <span>Tổng hóa đơn cả phòng:</span>
              <strong className="text-sm text-[#3e332a]">
                {formatCurrency(totalRoomExpense)}
              </strong>
            </div>

            <div className="pt-2 border-t border-[#ebdcc9] flex items-center justify-between">
              <div>
                <span className="text-xs font-serif italic text-[#7a6a58]">
                  Mỗi người đóng (chia {count}):
                </span>
                <div className="text-xl sm:text-2xl font-bold text-[#a25832]">
                  {formatCurrency(perPersonAmount)}
                </div>
              </div>

              {/* Copy breakdown button */}
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:text-[#3e332a] transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#2e7d32]" />
                    <span className="text-[#2e7d32] font-bold">Đã chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép Zalo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Select ledger to record */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Lưu vào sổ:
            </label>
            <select
              value={selectedLedgerId}
              onChange={(e) => setSelectedLedgerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            >
              {ledgers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select wallet to record (Chọn đúng ví mặc định ⭐) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#7a6a58]">
                Trừ vào ví của Lâm Gia Khang:
              </label>
              {wallets.find((w) => w.id === selectedWalletId)?.isDefault && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                  ⭐ Ví mặc định
                </span>
              )}
            </div>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isDefault ? '⭐ (Mặc định)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Calculator Keypad Docked at Bottom (Bàn phím máy tính giống Thêm Giao Dịch) */}
        {activeField ? (
          <div className="shrink-0 border-t border-[#e5e7eb] bg-[#f9fafb] animate-in slide-in-from-bottom-2 duration-150">
            {/* Header thanh điều khiển bàn phím */}
            <div className="px-3 py-1.5 flex items-center justify-between bg-[#f3f4f6] border-b border-[#e5e7eb]">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Calculator className="w-3.5 h-3.5 text-[#0284c7] shrink-0" />
                <span className="text-xs font-bold text-gray-700 truncate">
                  Đang nhập: {FIELD_ORDER.find((f) => f.id === activeField)?.label}
                </span>
                {isMathExpression(getActiveValue()) && (
                  <span className="text-xs font-bold text-emerald-600 truncate ml-1">
                    = {formatExpressionWithDots(Math.round(evaluateMathExpression(getActiveValue()) || 0).toString())}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isMathExpression(getActiveValue()) && (
                  <button
                    type="button"
                    onClick={() => evaluateField(activeField)}
                    className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 active:scale-95 transition flex items-center gap-0.5 cursor-pointer shadow-2xs"
                    title="Bấm để tính kết quả"
                  >
                    <span>= Tính</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => switchField(null)}
                  className="px-2 py-0.5 rounded-md bg-white border border-gray-300 text-[11px] font-bold text-gray-600 hover:text-gray-900 transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Ẩn bàn phím</span>
                </button>
              </div>
            </div>

            <CustomCalculatorKeyboard
              value={getActiveValue()}
              onChange={handleKeyboardChange}
              onDone={handleDone}
              quickAmounts={getActiveQuickAmounts()}
            />
          </div>
        ) : (
          /* Footer khi bàn phím đã ẩn */
          <div
            className="px-4 pt-3 pb-3 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between gap-2 shrink-0"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={() => switchField('roomRent')}
              className="px-3 py-2 rounded-xl border border-[#ebdcc9] bg-[#fffdfa] text-xs font-semibold text-[#7a6a58] hover:bg-[#ebdcc9] transition flex items-center gap-1 cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Mở bàn phím số</span>
            </button>

            <button
              onClick={handleSaveToLedger}
              disabled={savedSuccess || totalRoomExpense <= 0}
              className="px-5 py-2 rounded-xl bg-[#3d7a5a] text-white text-xs font-semibold hover:bg-[#316248] active:scale-95 transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Đã lưu vào {selectedLedger?.name || 'sổ'}!</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Lưu vào {selectedLedger?.name || 'Sổ Tiền Trọ'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
