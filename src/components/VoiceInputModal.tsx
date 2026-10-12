import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, ArrowRight, Sparkles, AlertCircle, Loader2, Check, Wallet as WalletIcon } from 'lucide-react';
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

    const cfg = getSavedVisionConfig();
    if (!cfg.apiKey || cfg.apiKey.trim().length === 0) {
      setErrorMsg('Chưa có Gemini API Key. Vui lòng vào Cài đặt -> Cấu hình AI để lưu API Key.');
      setIsRecording(false);
      return;
    }

    try {
      setIsRecording(true);
      // Kích hoạt nhận diện giọng nói vi-VN (Google Voice Dialog trên Android Native hoặc Web Speech)
      const ok = await speechService.startListening({
        onPartialResult: (text) => {
          if (text) setLiveTranscript(text);
        },
        onFinalResult: (text) => {
          if (text) {
            setLiveTranscript(text);
            // Tự động phân tích ngay khi nhận diện thành công văn bản
            handleAnalyzeText(text);
          }
        },
        onError: (err) => {
          console.warn('SpeechRecognition callback warning:', err);
          setErrorMsg(err);
        },
        onListeningStateChange: (listening) => {
          setIsRecording(listening);
        },
      });

      if (!ok) {
        setIsRecording(false);
        const transcript = speechService.getTranscript();
        if (transcript) {
          setLiveTranscript(transcript);
          handleAnalyzeText(transcript);
        }
      }
    } catch (err: any) {
      setIsRecording(false);
      setErrorMsg(err?.message || 'Không thể mở Microphone để ghi âm.');
    }
  };

  const handleAnalyzeText = async (customText?: string) => {
    if (isAnalyzing) return;
    const textToProcess = (customText !== undefined ? customText : liveTranscript).trim();
    if (!textToProcess) {
      setErrorMsg('Vui lòng nói hoặc nhập văn bản câu lệnh chi tiêu trước khi phân tích!');
      return;
    }

    setIsRecording(false);
    setIsAnalyzing(true);
    setStatusMessage('Google Gemini AI đang bóc tách giao dịch...');
    setErrorMsg(null);

    try {
      speechService.stopListening();
      audioRecorder.cancelRecording();

      const parsed = await parseVoiceWithGemini(
        textToProcess,
        categories,
        wallets,
        undefined,
        undefined,
        (modelName, reason) => {
          setStatusMessage(`Model ${modelName} ${reason}`);
        }
      );

      setPreviewResult(parsed);
      setTimeout(() => {
        handleConfirm(parsed);
      }, 700);
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMsg(err?.message || 'Không thể xử lý văn bản với Gemini. Vui lòng thử lại!');
    }
  };

  const [isAudioDirectRecording, setIsAudioDirectRecording] = useState(false);

  const handleStartAudioDirect = async () => {
    setErrorMsg(null);
    setPreviewResult(null);
    setIsAnalyzing(false);
    try {
      await speechService.stopListening();
      await audioRecorder.startRecording();
      setIsAudioDirectRecording(true);
      setIsRecording(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể mở Microphone để ghi âm audio.');
    }
  };

  const handleStopAudioDirect = async () => {
    setIsRecording(false);
    setIsAudioDirectRecording(false);
    setIsAnalyzing(true);
    setStatusMessage('Google Gemini Audio AI đang phân tích âm thanh...');
    try {
      const audioResult = await audioRecorder.stopRecording();
      if (!audioResult || !audioResult.base64Data) {
        throw new Error('Chưa ghi nhận được âm thanh.');
      }
      const parsed = await parseVoiceAudioWithGemini(
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
      setPreviewResult(parsed);
      setTimeout(() => {
        handleConfirm(parsed);
      }, 700);
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMsg(err?.message || 'Không thể xử lý âm thanh với Gemini Audio.');
    }
  };

  const handleStopAndParse = async () => {
    if (isAnalyzing) return;

    if (isAudioDirectRecording) {
      return handleStopAudioDirect();
    }

    setIsRecording(false);

    try {
      // 1. Dừng Speech Recognition và lấy kết quả
      let speechText = await speechService.stopListening();
      let finalTranscript = (speechText || speechService.getTranscript() || liveTranscript || '').trim();

      // Nếu chưa có, chờ 200ms kiểm tra lại
      if (!finalTranscript) {
        await new Promise((r) => setTimeout(r, 200));
        speechText = speechService.getTranscript();
        finalTranscript = (speechText || liveTranscript || '').trim();
      }

      if (finalTranscript) {
        setLiveTranscript(finalTranscript);
        await handleAnalyzeText(finalTranscript);
      } else {
        setErrorMsg('Chưa ghi nhận được âm thanh. Bạn có thể bấm nói lại hoặc nhập trực tiếp câu lệnh vào ô văn bản phía dưới!');
      }
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

        {/* Khung hiển thị & nhập văn bản giọng nói (BẮT BUỘC LUÔN HIỂN THỊ VÀ BIND VỚI STATE liveTranscript) */}
        <div className="w-full text-left mb-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#c2410c] uppercase mb-1.5 px-0.5">
            <span className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-[#ea580c]" />
              <span>Văn bản thu từ giọng nói (vi-VN):</span>
            </span>
            {liveTranscript.trim() ? (
              <span className="text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>✓</span>
                <span>Đã có văn bản</span>
              </span>
            ) : isRecording ? (
              <span className="text-[10px] font-bold text-[#ea580c] bg-[#ffedd5] px-2 py-0.5 rounded-full animate-pulse">
                Đang lắng nghe...
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
              placeholder={
                isRecording
                  ? 'Đang lắng nghe tiếng Việt... (Ví dụ: "Ăn cơm thịt kho 25ca bằng momo")'
                  : 'Bấm Micro để ghi âm, hoặc nhập/sửa câu lệnh chi tiêu trực tiếp tại đây...'
              }
              rows={3}
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
            className="px-4 py-3 rounded-xl border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#f5ebe0] transition cursor-pointer"
          >
            Đóng
          </button>
          {isRecording ? (
            <button
              onClick={handleStopAndParse}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white text-xs font-bold hover:brightness-105 shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 animate-pulse cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Xong / Phân tích ngay</span>
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
              className="flex-1 py-3 rounded-xl bg-[#16a34a] text-white text-xs font-bold hover:bg-[#15803d] shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Điền vào hóa đơn ({formatCurrency(previewResult.amount)})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : liveTranscript.trim().length > 0 ? (
            <>
              <button
                onClick={startRecording}
                className="px-3 py-3 rounded-xl border border-[#ea580c]/30 text-[#ea580c] bg-[#fff7ed] text-xs font-semibold hover:bg-[#ffedd5] transition flex items-center justify-center gap-1 cursor-pointer"
                title="Ghi âm lại từ đầu"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Nói lại</span>
              </button>
              <button
                onClick={() => handleAnalyzeText()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white text-xs font-bold hover:brightness-105 shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Phân tích câu lệnh này</span>
              </button>
            </>
          ) : (
            <div className="flex-1 flex gap-2">
              <button
                onClick={startRecording}
                className="flex-1 py-3 rounded-xl bg-[#ea580c] text-white text-xs font-bold hover:bg-[#c2410c] shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Nói tiếng Việt</span>
              </button>
              <button
                onClick={handleStartAudioDirect}
                className="px-3 py-3 rounded-xl border border-[#ea580c]/30 bg-[#fff7ed] text-[#ea580c] text-[11px] font-bold hover:bg-[#ffedd5] shadow-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                title="Ghi âm gửi trực tiếp cho Gemini Multimodal"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gemini Audio</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
