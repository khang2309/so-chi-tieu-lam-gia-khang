import React, { useState, useEffect } from 'react';
import {
  Mic,
  X,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
  Wallet as WalletIcon,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Category, Wallet } from '../types';
import { audioRecorder } from '../utils/audioRecorder';
import {
  parseVoiceWithGemini,
  parseVoiceAudioWithGemini,
  ParsedVoiceResult,
} from '../utils/voiceParser';
import { getSavedVisionConfig, DEFAULT_GEMINI_API_KEY } from '../utils/cloudVisionService';
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
  const [statusMessage, setStatusMessage] = useState<string>('Chạm vào Micro để bắt đầu nói');

  // Reset state mỗi khi mở/đóng modal
  useEffect(() => {
    if (!isOpen) {
      audioRecorder.cancelRecording();
      setIsRecording(false);
      setIsAnalyzing(false);
      setRecordingDuration(0);
      setLiveTranscript('');
      setErrorMsg(null);
      setPreviewResult(null);
      setStatusMessage('Chạm vào Micro để bắt đầu nói');
      return;
    }

    setIsRecording(false);
    setIsAnalyzing(false);
    setRecordingDuration(0);
    setLiveTranscript('');
    setErrorMsg(null);
    setPreviewResult(null);
    setStatusMessage('Chạm vào Micro để bắt đầu nói');

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

  // Ghi âm trực tiếp qua Microphone phần cứng gửi lên Google Gemini Multimodal Audio
  const handleStartAudioRecording = async () => {
    setErrorMsg(null);
    setPreviewResult(null);
    setIsAnalyzing(false);
    setRecordingDuration(0);

    const cfg = getSavedVisionConfig();
    const apiKey = cfg.apiKey && cfg.apiKey.trim().length > 0 ? cfg.apiKey : DEFAULT_GEMINI_API_KEY;
    if (!apiKey) {
      setErrorMsg('Chưa có API Key. Vui lòng vào Cài đặt để cấu hình.');
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const permStatus = await SpeechRecognition.checkPermissions().catch(() => null);
          if (permStatus?.speechRecognition !== 'granted') {
            await SpeechRecognition.requestPermissions().catch(() => {});
          }
        } catch {}
      }

      await audioRecorder.startRecording();
      setIsRecording(true);
      setStatusMessage('Đang lắng nghe âm thanh...');
    } catch (err: any) {
      setIsRecording(false);
      setErrorMsg(err?.message || 'Không thể mở Microphone. Vui lòng kiểm tra quyền truy cập Microphone.');
    }
  };

  const handleStopAndParseAudio = async () => {
    if (isAnalyzing) return;
    setIsRecording(false);
    setIsAnalyzing(true);
    setStatusMessage('Trợ lý AI đang nghe & bóc tách giao dịch...');
    setErrorMsg(null);

    try {
      const audioResult = await audioRecorder.stopRecording();
      if (!audioResult || !audioResult.base64Data) {
        throw new Error('Chưa ghi nhận được âm thanh. Vui lòng bấm Micro và nói lại!');
      }

      const parsed = await parseVoiceAudioWithGemini(
        audioResult.base64Data,
        audioResult.mimeType,
        categories,
        wallets,
        undefined,
        undefined,
        () => {
          setStatusMessage('Trợ lý AI đang xử lý âm thanh...');
        }
      );

      if (parsed.transcript) {
        setLiveTranscript(parsed.transcript);
      }
      setPreviewResult(parsed);
      setStatusMessage('Đã bóc tách giao dịch thành công!');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể phân tích âm thanh. Vui lòng thử lại!');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Phân tích văn bản khi người dùng chỉnh sửa trong ô text
  const handleAnalyzeText = async () => {
    if (isAnalyzing) return;
    const textToProcess = liveTranscript.trim();
    if (!textToProcess) {
      setErrorMsg('Vui lòng nói hoặc nhập nội dung chi tiêu trước khi phân tích!');
      return;
    }

    setIsRecording(false);
    setIsAnalyzing(true);
    setStatusMessage('Trợ lý AI đang bóc tách giao dịch...');
    setErrorMsg(null);

    try {
      audioRecorder.cancelRecording();

      const parsed = await parseVoiceWithGemini(
        textToProcess,
        categories,
        wallets,
        undefined,
        undefined,
        () => {
          setStatusMessage('Trợ lý AI đang phân tích...');
        }
      );

      setPreviewResult(parsed);
      setStatusMessage('Đã bóc tách giao dịch thành công!');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể xử lý văn bản. Vui lòng thử lại!');
    } finally {
      setIsAnalyzing(false);
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

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#fffdfa] rounded-t-3xl sm:rounded-3xl border border-[#ebdcc9] shadow-2xl p-5 sm:p-6 overflow-hidden flex flex-col items-center text-center max-h-[92vh] overflow-y-auto">
        {/* Nút đóng */}
        <button
          onClick={() => {
            audioRecorder.cancelRecording();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-[#7a6a58] hover:text-[#3e332a] hover:bg-[#f5ebe0] rounded-full transition cursor-pointer"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Icon */}
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-4 h-4 text-[#ea580c]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
            Tạo giao dịch bằng giọng nói
          </span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-[#3e332a] mb-5">
          {isAnalyzing
            ? statusMessage
            : isRecording
            ? `Đang lắng nghe... (${formatTimer(recordingDuration)})`
            : statusMessage}
        </h3>

        {/* DUY NHẤT 1 NÚT MICROPHONE TRUNG TÂM */}
        <div className="relative flex items-center justify-center mb-5">
          {isRecording && (
            <>
              <div className="absolute w-28 h-28 rounded-full bg-[#ea580c]/15 animate-ping pointer-events-none" />
              <div className="absolute w-24 h-24 rounded-full bg-[#ea580c]/25 animate-pulse pointer-events-none" />
            </>
          )}

          <button
            onClick={() => {
              if (isAnalyzing) return;
              if (isRecording) {
                handleStopAndParseAudio();
              } else {
                handleStartAudioRecording();
              }
            }}
            disabled={isAnalyzing}
            className={`relative z-10 w-22 h-22 rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-95 cursor-pointer ${
              isAnalyzing
                ? 'bg-[#ea580c] ring-4 ring-[#ea580c]/30 cursor-wait'
                : isRecording
                ? 'bg-gradient-to-tr from-[#dc2626] to-[#ea580c] ring-4 ring-[#ea580c]/40 animate-pulse'
                : 'bg-gradient-to-tr from-[#ea580c] to-[#f97316] hover:brightness-105 ring-4 ring-[#ea580c]/20'
            }`}
            title={
              isAnalyzing
                ? 'Đang phân tích...'
                : isRecording
                ? 'Chạm để dừng và phân tích'
                : 'Chạm để nói'
            }
          >
            {isAnalyzing ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : isRecording ? (
              <div className="w-7 h-7 rounded-lg bg-white shadow-md transition-all" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
          </button>
        </div>

        {/* Khung hiển thị & nhập văn bản giọng nói (Không hiển thị bất kỳ ví dụ nào) */}
        <div className="w-full text-left mb-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#c2410c] uppercase mb-1.5 px-0.5">
            <span className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-[#ea580c]" />
              <span>Văn bản thu được (vi-VN):</span>
            </span>
            {liveTranscript.trim() ? (
              <span className="text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>✓</span>
                <span>Đã có văn bản</span>
              </span>
            ) : isRecording ? (
              <span className="text-[10px] font-bold text-[#ea580c] bg-[#ffedd5] px-2 py-0.5 rounded-full animate-pulse">
                Đang nghe...
              </span>
            ) : (
              <span className="text-[10px] font-medium text-[#7a6a58]">
                Sẵn sàng
              </span>
            )}
          </div>

          <div className="relative">
            <textarea
              value={liveTranscript}
              onChange={(e) => setLiveTranscript(e.target.value)}
              placeholder="Nội dung câu nói hoặc chỉnh sửa văn bản tại đây..."
              rows={2}
              className="w-full p-3 pr-8 rounded-2xl bg-[#fff7ed] border border-[#fed7aa] focus:border-[#ea580c] focus:bg-[#fffdfa] text-sm font-semibold text-[#3e332a] leading-relaxed resize-none transition outline-hidden placeholder:text-[#9c8979] placeholder:font-normal shadow-2xs"
            />
            {liveTranscript ? (
              <button
                type="button"
                onClick={() => setLiveTranscript('')}
                className="absolute top-2.5 right-2.5 p-1 text-[#9c8979] hover:text-[#3e332a] rounded-full bg-white/80 hover:bg-white shadow-xs transition cursor-pointer"
                title="Xóa nội dung"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Xem trước bóc tách thông minh (Live Parser Preview) */}
        {previewResult && previewResult.amount > 0 && (
          <div className="w-full p-3.5 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] mb-3 text-left animate-in slide-in-from-bottom-2 duration-150">
            <div className="text-[11px] font-bold text-[#16a34a] uppercase mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kết quả bóc tách thông minh:</span>
              </span>
              <span className="text-[10px] text-[#15803d] font-bold bg-[#dcfce7] px-2 py-0.5 rounded-full">
                Khớp thành công
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
                <strong className="text-[#3e332a] text-sm font-bold block">{previewResult.note || '—'}</strong>
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
          <div className="w-full p-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-left flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Cụm nút thao tác */}
        <div className="w-full flex flex-col gap-2">
          {isRecording ? (
            <button
              onClick={handleStopAndParseAudio}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#ea580c] text-white text-xs font-bold hover:brightness-105 shadow-md flex items-center justify-center gap-2 transition active:scale-95 animate-pulse cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Dừng & Phân tích ngay ({formatTimer(recordingDuration)})</span>
            </button>
          ) : isAnalyzing ? (
            <button
              disabled
              className="w-full py-3 rounded-xl bg-[#ea580c]/60 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-wait"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang phân tích giao dịch...</span>
            </button>
          ) : previewResult && previewResult.amount > 0 ? (
            <button
              onClick={() => handleConfirm(previewResult)}
              className="w-full py-3 rounded-xl bg-[#16a34a] text-white text-xs font-bold hover:bg-[#15803d] shadow-md flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Điền vào hóa đơn ({formatCurrency(previewResult.amount)})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : liveTranscript.trim().length > 0 ? (
            <button
              onClick={handleAnalyzeText}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white text-xs font-bold hover:brightness-105 shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Phân tích câu lệnh này</span>
            </button>
          ) : null}

          <button
            onClick={() => {
              audioRecorder.cancelRecording();
              onClose();
            }}
            className="w-full py-2 text-xs font-semibold text-[#7a6a58] hover:text-[#3e332a] transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
