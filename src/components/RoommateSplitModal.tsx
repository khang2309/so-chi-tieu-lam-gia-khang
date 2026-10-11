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
} from 'lucide-react';
import { Ledger, Wallet, Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';

interface RoommateSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgers: Ledger[];
  wallets: Wallet[];
  onAddTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onAddBatchTransactions?: (items: Array<Omit<Transaction, 'id' | 'createdAt'>>) => void;
}

export const RoommateSplitModal: React.FC<RoommateSplitModalProps> = ({
  isOpen,
  onClose,
  ledgers,
  wallets,
  onAddTransaction,
  onAddBatchTransactions,
}) => {
  // Toàn bộ các con số đều để rỗng "" mặc định theo yêu cầu
  const [roomRent, setRoomRent] = useState<number | ''>('');

  // Điện
  const [electricOld, setElectricOld] = useState<number | ''>('');
  const [electricNew, setElectricNew] = useState<number | ''>('');
  const [electricPrice, setElectricPrice] = useState<number | ''>('');

  // Nước
  const [waterOld, setWaterOld] = useState<number | ''>('');
  const [waterNew, setWaterNew] = useState<number | ''>('');
  const [waterPrice, setWaterPrice] = useState<number | ''>('');

  // Wifi & Rác
  const [internetFee, setInternetFee] = useState<number | ''>('');
  const [garbageFee, setGarbageFee] = useState<number | ''>('');

  // Số người chia tiền (mặc định 3 người)
  const [roommatesCount, setRoommatesCount] = useState<number>(3);

  // Sổ và Ví
  const defaultRoomLedger = ledgers.find((l) => l.id === 'ledger-room') || ledgers[0];
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>(
    defaultRoomLedger?.id || ''
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    wallets[0]?.id || ''
  );

  useEffect(() => {
    if (isOpen) {
      const roomL = ledgers.find((l) => l.id === 'ledger-room') || ledgers[0];
      setSelectedLedgerId(roomL?.id || '');
    }
  }, [isOpen, ledgers]);

  const selectedLedger = ledgers.find((l) => l.id === selectedLedgerId) || defaultRoomLedger;

  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  // Tính toán
  const numRoomRent = Number(roomRent) || 0;
  const numElectricOld = Number(electricOld) || 0;
  const numElectricNew = Number(electricNew) || 0;
  const numElectricPrice = Number(electricPrice) || 0;
  const numWaterOld = Number(waterOld) || 0;
  const numWaterNew = Number(waterNew) || 0;
  const numWaterPrice = Number(waterPrice) || 0;
  const numInternetFee = Number(internetFee) || 0;
  const numGarbageFee = Number(garbageFee) || 0;

  const electricKwh = Math.max(0, numElectricNew - numElectricOld);
  const totalElectric = electricKwh * numElectricPrice;

  const waterM3 = Math.max(0, numWaterNew - numWaterOld);
  const totalWater = waterM3 * numWaterPrice;

  const totalRoomExpense =
    numRoomRent + totalElectric + totalWater + numInternetFee + numGarbageFee;
  const count = roommatesCount > 0 ? roommatesCount : 1;
  const perPersonAmount = Math.round(totalRoomExpense / count);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#fffdfa] border border-[#d8c8b4] shadow-paper-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e4d5] flex items-center justify-between bg-[#fbf5eb]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#3d7a5a]/15 text-[#3d7a5a] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3e332a]">
                Công Cụ Tính Tiền Trọ (Chia {count} Người)
              </h3>
              <p className="text-xs text-[#7a6a58]">
                Tự động tách thành nhiều giao dịch độc lập vào Sổ
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

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Room Rent */}
          <div className="p-3 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#3e332a] flex items-center gap-1.5">
                <Home className="w-4 h-4 text-[#a25832]" />
                Tiền phòng cơ bản
              </label>
              <span className="text-xs font-bold text-[#a25832]">
                {formatCurrency(numRoomRent)}
              </span>
            </div>
            <input
              type="number"
              value={roomRent}
              onChange={(e) => setRoomRent(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Nhập tiền phòng..."
              className="w-full px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:outline-none focus:border-[#a25832]"
            />
          </div>

          {/* Electricity Section */}
          <div className="p-3 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#3e332a] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#ca8a04]" />
                Tiền điện ({electricKwh} kWh = {formatCurrency(totalElectric)})
              </label>
              <span className="text-xs font-bold text-[#ca8a04]">
                {formatCurrency(totalElectric)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-[#7a6a58]">Số cũ:</span>
                <input
                  type="number"
                  value={electricOld}
                  onChange={(e) => setElectricOld(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#7a6a58]">Số mới:</span>
                <input
                  type="number"
                  value={electricNew}
                  onChange={(e) => setElectricNew(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#7a6a58]">Đơn giá/kWh:</span>
                <input
                  type="number"
                  value={electricPrice}
                  onChange={(e) => setElectricPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="3500"
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
            </div>
          </div>

          {/* Water Section */}
          <div className="p-3 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#3e332a] flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-[#0284c7]" />
                Tiền nước ({waterM3} khối = {formatCurrency(totalWater)})
              </label>
              <span className="text-xs font-bold text-[#0284c7]">
                {formatCurrency(totalWater)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-[#7a6a58]">Chỉ số cũ:</span>
                <input
                  type="number"
                  value={waterOld}
                  onChange={(e) => setWaterOld(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#7a6a58]">Chỉ số mới:</span>
                <input
                  type="number"
                  value={waterNew}
                  onChange={(e) => setWaterNew(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#7a6a58]">Đơn giá/khối:</span>
                <input
                  type="number"
                  value={waterPrice}
                  onChange={(e) => setWaterPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="25000"
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
            </div>
          </div>

          {/* Internet & Garbage Fees */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-1">
              <label className="text-[11px] font-semibold text-[#3e332a] flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-[#7c3aed]" />
                Tiền Wifi / Mạng
              </label>
              <input
                type="number"
                value={internetFee}
                onChange={(e) => setInternetFee(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
              />
            </div>
            <div className="p-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-1">
              <label className="text-[11px] font-semibold text-[#3e332a] flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-[#6b7280]" />
                Rác & Dịch vụ
              </label>
              <input
                type="number"
                value={garbageFee}
                onChange={(e) => setGarbageFee(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
              />
            </div>
          </div>

          {/* Roommates Count */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9]">
            <span className="text-xs font-semibold text-[#3e332a] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#3d7a5a]" />
              Số người chia tiền:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoommatesCount(Math.max(1, roommatesCount - 1))}
                className="w-7 h-7 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-bold text-[#3e332a]"
              >
                -
              </button>
              <span className="w-6 text-center text-sm font-bold text-[#3e332a]">
                {roommatesCount}
              </span>
              <button
                type="button"
                onClick={() => setRoommatesCount(roommatesCount + 1)}
                className="w-7 h-7 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-bold text-[#3e332a]"
              >
                +
              </button>
            </div>
          </div>

          {/* Calculation Summary Card */}
          <div className="p-4 rounded-xl bg-[#f5ebe0] border border-[#ebdcc9] space-y-2">
            <div className="flex items-center justify-between text-xs text-[#7a6a58]">
              <span>Tổng hóa đơn cả phòng:</span>
              <strong className="text-sm text-[#3e332a]">
                {formatCurrency(totalRoomExpense)}
              </strong>
            </div>

            <div className="pt-2 border-t border-[#ebdcc9] flex items-center justify-between">
              <div>
                <span className="text-xs font-serif italic text-[#7a6a58]">
                  Mỗi người phải đóng (chia {count}):
                </span>
                <div className="text-xl sm:text-2xl font-bold text-[#a25832]">
                  {formatCurrency(perPersonAmount)}
                </div>
              </div>

              {/* Copy breakdown button */}
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:text-[#3e332a] transition flex items-center gap-1.5 shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#2e7d32]" />
                    <span className="text-[#2e7d32]">Đã sao chép!</span>
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

          {/* Select wallet to record */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Trừ vào ví của Lâm Gia Khang:
            </label>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#f0e4d5] bg-[#fbf5eb] flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#ebdcc9] text-xs font-medium text-[#7a6a58] hover:bg-[#ebdcc9] transition"
          >
            Đóng
          </button>

          <button
            onClick={handleSaveToLedger}
            disabled={savedSuccess || totalRoomExpense <= 0}
            className="px-5 py-2 rounded-xl bg-[#3d7a5a] text-white text-xs font-semibold hover:bg-[#316248] active:scale-95 transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Đã lưu các khoản vào {selectedLedger?.name || 'sổ'}!</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Lưu các khoản trên vào {selectedLedger?.name || 'Sổ Tiền Trọ'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
