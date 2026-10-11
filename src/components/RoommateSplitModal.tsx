import React, { useState } from 'react';
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
import { Ledger, Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';

interface RoommateSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgers: Ledger[];
  wallets: Wallet[];
  onAddTransaction: (data: {
    amount: number;
    type: 'expense';
    date: string;
    categoryId: string;
    ledgerId: string;
    walletId: string;
    note: string;
    splitInfo: {
      totalRoomExpense: number;
      roommateCount: number;
      perPersonAmount: number;
      details: string;
    };
  }) => void;
}

export const RoommateSplitModal: React.FC<RoommateSplitModalProps> = ({
  isOpen,
  onClose,
  ledgers,
  wallets,
  onAddTransaction,
}) => {
  // Roommate calculation inputs
  const [roomRent, setRoomRent] = useState<number>(3600000);

  // Electricity
  const [electricOld, setElectricOld] = useState<number>(1450);
  const [electricNew, setElectricNew] = useState<number>(1550);
  const [electricPrice, setElectricPrice] = useState<number>(3500);

  // Water
  const [waterOld, setWaterOld] = useState<number>(85);
  const [waterNew, setWaterNew] = useState<number>(91);
  const [waterPrice, setWaterPrice] = useState<number>(25000);

  // Internet & other
  const [internetFee, setInternetFee] = useState<number>(240000);
  const [garbageFee, setGarbageFee] = useState<number>(60000);

  // Number of people
  const [roommatesCount, setRoommatesCount] = useState<number>(3);

  // Target wallet & ledger
  const roomLedger = ledgers.find((l) => l.id === 'ledger-room') || ledgers[0];
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    wallets[1]?.id || wallets[0]?.id || ''
  );

  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  // Computations
  const electricKwh = Math.max(0, electricNew - electricOld);
  const totalElectric = electricKwh * electricPrice;

  const waterM3 = Math.max(0, waterNew - waterOld);
  const totalWater = waterM3 * waterPrice;

  const totalRoomExpense =
    roomRent + totalElectric + totalWater + internetFee + garbageFee;
  const count = roommatesCount > 0 ? roommatesCount : 1;
  const perPersonAmount = Math.round(totalRoomExpense / count);

  const breakdownSummary = `🏠 BẢNG TÍNH TIỀN TRỌ THÁNG (CHIA ${count} NGƯỜI):
----------------------------------
1. Tiền phòng: ${formatCurrency(roomRent)}
2. Tiền điện: (${electricNew} - ${electricOld} = ${electricKwh} kWh x ${formatCurrency(electricPrice)}/kWh) = ${formatCurrency(totalElectric)}
3. Tiền nước: (${waterNew} - ${waterOld} = ${waterM3} khối x ${formatCurrency(waterPrice)}/m³) = ${formatCurrency(totalWater)}
4. Tiền Wifi/Internet: ${formatCurrency(internetFee)}
5. Phí rác & dịch vụ: ${formatCurrency(garbageFee)}
----------------------------------
👉 TỔNG CỘNG CẢ PHÒNG: ${formatCurrency(totalRoomExpense)}
👉 MỖI BẠN ĐÓNG: ${formatCurrency(perPersonAmount)}/người
(Lâm Gia Khang + 2 bạn)`;

  const handleCopy = () => {
    navigator.clipboard.writeText(breakdownSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveToLedger = () => {
    onAddTransaction({
      amount: perPersonAmount,
      type: 'expense',
      date: new Date().toISOString(),
      categoryId: 'cat-bills',
      ledgerId: roomLedger?.id || 'ledger-room',
      walletId: selectedWalletId,
      note: `Tiền trọ tháng: Điện ${electricKwh}kWh, Nước ${waterM3}m3, Wifi chia ${count} người`,
      splitInfo: {
        totalRoomExpense,
        roommateCount: count,
        perPersonAmount,
        details: breakdownSummary,
      },
    });

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
                Công Cụ Tính Tiền Trọ (Chia 3 Người)
              </h3>
              <p className="text-xs text-[#7a6a58]">
                Sổ Tiền Trọ của Lâm Gia Khang
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
                {formatCurrency(roomRent)}
              </span>
            </div>
            <input
              type="number"
              value={roomRent}
              onChange={(e) => setRoomRent(Number(e.target.value) || 0)}
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
                  onChange={(e) => setElectricOld(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#7a6a58]">Số mới:</span>
                <input
                  type="number"
                  value={electricNew}
                  onChange={(e) => setElectricNew(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#7a6a58]">Đơn giá/kWh:</span>
                <input
                  type="number"
                  value={electricPrice}
                  onChange={(e) => setElectricPrice(Number(e.target.value) || 0)}
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
                  onChange={(e) => setWaterOld(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#7a6a58]">Chỉ số mới:</span>
                <input
                  type="number"
                  value={waterNew}
                  onChange={(e) => setWaterNew(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-medium text-[#3e332a]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#7a6a58]">Đơn giá/khối:</span>
                <input
                  type="number"
                  value={waterPrice}
                  onChange={(e) => setWaterPrice(Number(e.target.value) || 0)}
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
                onChange={(e) => setInternetFee(Number(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-[#fffdfa] border border-[#ebdcc9] text-xs font-semibold text-[#3e332a]"
              />
            </div>
            <div className="p-2.5 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] space-y-1">
              <label className="text-[11px] font-semibold text-[#3e332a] flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-[#6b7280]" />
                Rác & Vệ sinh
              </label>
              <input
                type="number"
                value={garbageFee}
                onChange={(e) => setGarbageFee(Number(e.target.value) || 0)}
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

          {/* Select wallet to record */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#7a6a58]">
              Trừ vào ví của Lâm Gia Khang:
            </label>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#fbf5eb] border border-[#ebdcc9] text-xs font-medium text-[#3e332a] focus:bg-[#fffdfa] focus:border-[#a25832] focus:outline-none"
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
            disabled={savedSuccess}
            className="px-5 py-2 rounded-xl bg-[#3d7a5a] text-white text-xs font-semibold hover:bg-[#316248] active:scale-95 transition shadow-xs flex items-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Đã ghi vào sổ Tiền trọ!</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Ghi {formatCurrency(perPersonAmount)} vào Sổ Trọ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
