import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, ArrowRight, Sparkles, Volume2, AlertCircle, Loader2, Check } from 'lucide-react';
import { Category } from '../types';
import { audioRecorder } from '../utils/audioRecorder';
import { parseVoiceAudioWithGemini, ParsedVoiceResult } from '../utils/voiceParser';
import { getSavedVisionConfig } from '../utils/cloudVisionService';
import { formatCurrency } from '../utils/formatters';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onParsedResult: (result: ParsedVoiceResult) => void;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  categories,
  onParsedResult,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ParsedVoiceResult | null>(null);

  useEffect(() => {
    if (!isOpen) {
      audioRecorder.cancelRecording();
      setIsRecording(false);
      setIsAnalyzing(false);
      setRecordingDuration(0);
      setErrorMsg(null);
      setPreviewResult(null);
      return;
    }

    startRecording();

    return () => {
      audioRecorder.cancelRecording();
    };
  }, [isOpen]);

  // Bộ đếm thời gian ghi âm
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = async () => {
    setErrorMsg(null);
    setPreviewResult(null);
    setIsAnalyzing(false);
    setRecordingDuration(0);

    const cfg = getSavedVisionConfig();
    if (!cfg.apiKey || cfg.apiKey.trim().length === 0) {
      setErrorMsg('Chưa có Gemini API Key. Vui lòng vào Cài đặt -> Cấu hình AI để lưu API Key.');
      setIsRecording(false);
      return;
    }

    try {
      await audioRecorder.startRecording();
      setIsRecording(true);
    } catch (err: any) {
      setIsRecording(false);
      setErrorMsg(err?.message || 'Không thể mở Microphone để ghi âm.');
    }
  };

  const handleStopAndParse = async () => {
    if (isAnalyzing) return;
    setIsRecording(false);
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const audioResult = await audioRecorder.stopRecording();
      if (!audioResult || !audioResult.base64Data) {
        throw new Error('Chưa ghi nhận được âm thanh. Vui lòng bấm vào Micro và nói lại!');
      }

      const parsed = await parseVoiceAudioWithGemini(
        audioResult.base64Data,
        audioResult.mimeType,
        categories
      );

      setPreviewResult(parsed);
      // Hiển thị preview 600ms rồi tự động xác nhận điền vào form
      setTimeout(() => {
        handleConfirm(parsed);
      }, 600);
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMsg(err?.message || 'Không thể xử lý âm thanh với Gemini. Vui lòng thử lại!');
    }
  };

  const handleConfirm = (res: ParsedVoiceResult) => {
    audioRecorder.cancelRecording();
    onParsedResult(res);
    onClose();
  };

  if (!isOpen) return null;

  const matchedCat = previewResult
    ? categories.find((c) => c.id === previewResult.categoryId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#fffdfa] rounded-t-3xl sm:rounded-3xl border border-[#ebdcc9] shadow-2xl p-6 overflow-hidden flex flex-col items-center text-center">
        {/* Nút đóng */}
        <button
          onClick={() => {
            audioRecorder.cancelRecording();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] rounded-full transition"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Icon */}
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#ea580c]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
            Tạo giao dịch bằng giọng nói
          </span>
        </div>

        <h3 className="text-lg font-bold text-[#3e332a] mb-6">
          {isAnalyzing
            ? 'Google Gemini AI đang nghe & phân tích...'
            : isRecording
            ? `Đang ghi âm... (${recordingDuration}s)`
            : 'Đã dừng ghi âm'}
        </h3>

        {/* Visualizer / Animated Microphone */}
        <div className="relative flex items-center justify-center mb-5">
          {(isRecording || isAnalyzing) && (
            <>
              <div className="absolute w-28 h-28 rounded-full bg-[#ea580c]/15 animate-ping" />
              <div className="absolute w-24 h-24 rounded-full bg-[#ea580c]/25 animate-pulse" />
            </>
          )}

          <button
            onClick={() => {
              if (isAnalyzing) return;
              if (isRecording) {
                handleStopAndParse();
              } else {
                startRecording();
              }
            }}
            disabled={isAnalyzing}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 ${
              isAnalyzing
                ? 'bg-[#ea580c] ring-4 ring-[#ea580c]/30 cursor-wait'
                : isRecording
                ? 'bg-gradient-to-tr from-[#ea580c] to-[#f97316] ring-4 ring-[#ea580c]/30'
                : 'bg-[#7a6a58] hover:bg-[#5c4f42]'
            }`}
            title={isAnalyzing ? 'Đang phân tích...' : isRecording ? 'Bấm để hoàn tất và phân tích' : 'Bấm để ghi âm lại'}
          >
            {isAnalyzing ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : isRecording ? (
              <Mic className="w-9 h-9 animate-bounce" />
            ) : (
              <MicOff className="w-9 h-9" />
            )}
          </button>
        </div>

        {/* Hộp trạng thái ghi âm */}
        <div className="w-full min-h-[64px] p-3.5 rounded-2xl bg-[#fbf5eb] border border-[#ebdcc9] flex flex-col justify-center items-center mb-4 transition">
          {isAnalyzing ? (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ea580c] animate-pulse">
                <Sparkles className="w-4 h-4 animate-spin text-[#ea580c]" />
                <span>Gemini 1.5 Flash đang xử lý đoạn âm thanh...</span>
              </div>
              <p className="text-[11px] text-[#7a6a58] italic">Đang bóc tách số tiền, ghi chú và danh mục</p>
            </div>
          ) : isRecording ? (
            <p className="text-xs text-[#7a6a58] flex items-center gap-1.5 animate-pulse">
              <Volume2 className="w-3.5 h-3.5 text-[#ea580c]" />
              <span>Hãy đọc số tiền và mục đích (VD: "Đổ xăng 50 nghìn", "Ăn phở 40k")...</span>
            </p>
          ) : (
            <p className="text-xs text-[#7a6a58]">Bấm vào biểu tượng Micro để ghi âm câu nói</p>
          )}
        </div>

        {/* Xem trước bóc tách thông minh (Live Parser Preview) */}
        {previewResult && previewResult.amount > 0 && (
          <div className="w-full p-3 rounded-xl bg-[#fff7ed] border border-[#fed7aa] mb-4 text-left animate-in slide-in-from-bottom-2 duration-150">
            <div className="text-[11px] font-bold text-[#c2410c] uppercase mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Kết quả bóc tách thông minh:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#7a6a58]">Số tiền: </span>
                <strong className="text-[#ea580c] text-sm font-bold">
                  {formatCurrency(previewResult.amount)}
                </strong>
              </div>
              <div>
                <span className="text-[#7a6a58]">Ghi chú: </span>
                <strong className="text-[#3e332a]">{previewResult.note || '—'}</strong>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 pt-0.5">
                <span className="text-[#7a6a58]">Danh mục: </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ffedd5] text-[#9a3412]">
                  {matchedCat ? matchedCat.name : 'Chi tiêu khác'}
                </span>
                <span className="text-[11px] text-[#7a6a58]">
                  ({previewResult.type === 'income' ? 'Thu nhập' : 'Chi tiêu'})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Thông báo lỗi nếu có */}
        {errorMsg && (
          <div className="w-full p-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-left">{errorMsg}</span>
          </div>
        )}

        {/* Action button - DUY NHẤT 1 HÀNG Ở DƯỚI CÙNG, KHÔNG BỊ TRÙNG LẶP */}
        <div className="w-full mt-2 flex gap-2">
          <button
            onClick={() => {
              audioRecorder.cancelRecording();
              onClose();
            }}
            className="flex-1 py-3 rounded-xl border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#f5ebe0] transition"
          >
            Đóng
          </button>
          {isRecording ? (
            <button
              onClick={handleStopAndParse}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white text-xs font-bold hover:brightness-105 shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 animate-pulse"
            >
              <Check className="w-4 h-4" />
              <span>Xong / Xử lý ngay</span>
            </button>
          ) : isAnalyzing ? (
            <button
              disabled
              className="flex-1 py-3 rounded-xl bg-[#ea580c]/60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-wait"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang phân tích...</span>
            </button>
          ) : previewResult && previewResult.amount > 0 ? (
            <button
              onClick={() => handleConfirm(previewResult)}
              className="flex-1 py-3 rounded-xl bg-[#ea580c] text-white text-xs font-semibold hover:bg-[#c2410c] shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <span>Điền vào hóa đơn</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="flex-1 py-3 rounded-xl bg-[#3e332a] text-white text-xs font-semibold hover:bg-[#2c241d] shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>Ghi âm lại</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
