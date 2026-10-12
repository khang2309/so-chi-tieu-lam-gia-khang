import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, ArrowRight, Sparkles, Volume2, AlertCircle, Loader2, Check, Wallet as WalletIcon } from 'lucide-react';
import { Category, Wallet } from '../types';
import { audioRecorder } from '../utils/audioRecorder';
import { speechService } from '../utils/speechService';
import { parseVoiceWithGemini, parseVoiceAudioWithGemini, ParsedVoiceResult } from '../utils/voiceParser';
import { getSavedVisionConfig } from '../utils/cloudVisionService';
import { formatCurrency } from '../utils/formatters';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  wallets: Wallet[];
  onParsedResult: (result: ParsedVoiceResult) => void;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  categories,
  wallets,
  onParsedResult,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ParsedVoiceResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Google Gemini AI đang nghe & phân tích...');

  useEffect(() => {
    if (!isOpen) {
      speechService.stopListening();
      audioRecorder.cancelRecording();
      setIsRecording(false);
      setIsAnalyzing(false);
      setRecordingDuration(0);
      setLiveTranscript('');
      setErrorMsg(null);
      setPreviewResult(null);
      setStatusMessage('Google Gemini AI đang nghe & phân tích...');
      return;
    }

    startRecording();

    return () => {
      speechService.stopListening();
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
    setLiveTranscript('');

    const cfg = getSavedVisionConfig();
    if (!cfg.apiKey || cfg.apiKey.trim().length === 0) {
      setErrorMsg('Chưa có Gemini API Key. Vui lòng vào Cài đặt -> Cấu hình AI để lưu API Key.');
      setIsRecording(false);
      return;
    }

    try {
      // 1. Khởi động SpeechRecognition cứng vi-VN
      await speechService.startListening({
        onPartialResult: (text) => {
          if (text) setLiveTranscript(text);
        },
        onFinalResult: (text) => {
          if (text) setLiveTranscript(text);
        },
        onError: (err) => {
          console.warn('SpeechRecognition callback warning:', err);
        },
      });

      // 2. Khởi động AudioRecorder dự phòng
      try {
        await audioRecorder.startRecording();
      } catch (e) {
        console.warn('AudioRecorder start warning:', e);
      }

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
    setStatusMessage('Google Gemini AI đang bóc tách giao dịch...');
    setErrorMsg(null);

    try {
      // Dừng Speech Recognition
      const speechText = await speechService.stopListening();
      const finalTranscript = (speechText || liveTranscript || '').trim();

      // Dừng AudioRecorder
      let audioResult = null;
      try {
        audioResult = await audioRecorder.stopRecording();
      } catch {}

      let parsed: ParsedVoiceResult;

      // 1. Ưu tiên cao nhất: Dùng transcript thu được từ Mic vi-VN
      if (finalTranscript) {
        setLiveTranscript(finalTranscript);
        parsed = await parseVoiceWithGemini(
          finalTranscript,
          categories,
          wallets,
          undefined,
          undefined,
          (modelName, reason) => {
            setStatusMessage(`Model ${modelName} ${reason}`);
          }
        );
      } else if (audioResult && audioResult.base64Data) {
        // 2. Dự phòng: Gửi audio lên Gemini Audio Multimodal
        parsed = await parseVoiceAudioWithGemini(
          audioResult.base64Data,
          audioResult.mimeType,
          categories,
          wallets,
          undefined,
          undefined,
          (modelName, reason) => {
            setStatusMessage(`Model ${modelName} ${reason}`);
          }
        );
        if (parsed.transcript) {
          setLiveTranscript(parsed.transcript);
        }
      } else {
        throw new Error('Chưa ghi nhận được âm thanh. Vui lòng bấm vào Micro và nói lại!');
      }

      setPreviewResult(parsed);
      // Hiển thị preview 700ms rồi tự động xác nhận điền vào form
      setTimeout(() => {
        handleConfirm(parsed);
      }, 700);
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMsg(err?.message || 'Không thể xử lý giọng nói với Gemini. Vui lòng thử lại!');
    }
  };

  const handleConfirm = (res: ParsedVoiceResult) => {
    speechService.stopListening();
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
            speechService.stopListening();
            audioRecorder.cancelRecording();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] rounded-full transition cursor-pointer"
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

        <h3 className="text-lg font-bold text-[#3e332a] mb-5">
          {isAnalyzing
            ? statusMessage
            : isRecording
            ? `Đang lắng nghe... (${recordingDuration}s)`
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
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 cursor-pointer ${
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

        {/* Khung hiển thị trực tiếp văn bản thu được từ Micro (Live Transcript - BẮT BUỘC HIỂN THỊ) */}
        {liveTranscript ? (
          <div className="w-full p-3.5 rounded-2xl bg-[#fff7ed] border border-[#fed7aa] text-left mb-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#c2410c] uppercase mb-1">
              <span className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#ea580c]" />
                <span>Micro đã thu được (vi-VN):</span>
              </span>
              <span className="text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full">
                ✓ Đã thu chữ
              </span>
            </div>
            <p className="text-sm font-bold text-[#3e332a] leading-relaxed break-words">
              "{liveTranscript}"
            </p>
          </div>
        ) : (
          <div className="w-full min-h-[56px] p-3 rounded-2xl bg-[#fbf5eb] border border-[#ebdcc9] flex flex-col justify-center items-center mb-4 transition">
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-1 py-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#ea580c] animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin text-[#ea580c]" />
                  <span>AI đang bóc tách số tiền, ví & danh mục...</span>
                </div>
              </div>
            ) : isRecording ? (
              <p className="text-xs text-[#7a6a58] flex items-center gap-1.5 animate-pulse">
                <Volume2 className="w-3.5 h-3.5 text-[#ea580c]" />
                <span>Nói câu lệnh (VD: "Ăn cơm thịt kho 25ca bằng momo")...</span>
              </p>
            ) : (
              <p className="text-xs text-[#7a6a58]">Bấm vào Micro để ghi âm câu nói</p>
            )}
          </div>
        )}

        {/* Xem trước bóc tách thông minh (Live Parser Preview) */}
        {previewResult && previewResult.amount > 0 && (
          <div className="w-full p-3.5 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] mb-4 text-left animate-in slide-in-from-bottom-2 duration-150">
            <div className="text-[11px] font-bold text-[#16a34a] uppercase mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kết quả bóc tách thông minh:</span>
              </span>
              <span className="text-[10px] text-[#15803d] font-bold bg-[#dcfce7] px-2 py-0.5 rounded-full">
                Thành công
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#7a6a58]">Số tiền: </span>
                <strong className="text-[#ea580c] text-sm font-bold block">
                  {formatCurrency(previewResult.amount)}
                </strong>
              </div>
              <div>
                <span className="text-[#7a6a58]">Ví tiền: </span>
                <strong className="text-[#0284c7] text-sm font-bold block flex items-center gap-1">
                  <WalletIcon className="w-3.5 h-3.5" />
                  {previewResult.walletName || 'Tiền mặt'}
                </strong>
              </div>
              <div className="col-span-2">
                <span className="text-[#7a6a58]">Ghi chú: </span>
                <strong className="text-[#3e332a] block">{previewResult.note || '—'}</strong>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 pt-1 border-t border-[#dcfce7]">
                <span className="text-[#7a6a58]">Danh mục: </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#dcfce7] text-[#15803d]">
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

        {/* Action button */}
        <div className="w-full mt-2 flex gap-2">
          <button
            onClick={() => {
              speechService.stopListening();
              audioRecorder.cancelRecording();
              onClose();
            }}
            className="flex-1 py-3 rounded-xl border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#f5ebe0] transition cursor-pointer"
          >
            Đóng
          </button>
          {isRecording ? (
            <button
              onClick={handleStopAndParse}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white text-xs font-bold hover:brightness-105 shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 animate-pulse cursor-pointer"
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
              className="flex-1 py-3 rounded-xl bg-[#ea580c] text-white text-xs font-semibold hover:bg-[#c2410c] shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <span>Điền vào hóa đơn</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="flex-1 py-3 rounded-xl bg-[#3e332a] text-white text-xs font-semibold hover:bg-[#2c241d] shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
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
