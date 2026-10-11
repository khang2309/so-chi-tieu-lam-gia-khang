import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, ArrowRight, Sparkles, Volume2, AlertCircle, Loader2 } from 'lucide-react';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';
import { Category } from '../types';
import { speechService } from '../utils/speechService';
import { parseVoiceInput, parseVoiceWithGemini, ParsedVoiceResult } from '../utils/voiceParser';
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
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ParsedVoiceResult | null>(null);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      speechService.stopListening();
      setIsListening(false);
      setIsAnalyzing(false);
      setTranscript('');
      setErrorMsg(null);
      setPreviewResult(null);
      hasFinishedRef.current = false;
      return;
    }

    startRecording();

    return () => {
      speechService.stopListening();
    };
  }, [isOpen]);

  const startRecording = async () => {
    setErrorMsg(null);
    setTranscript('');
    setPreviewResult(null);
    setIsAnalyzing(false);
    hasFinishedRef.current = false;

    // BẮT BUỘC: Yêu cầu cấp quyền Micro trước khi gọi SpeechRecognition.start()
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await SpeechRecognition.requestPermissions();
        if (permStatus.speechRecognition !== 'granted') {
          alert('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
          setErrorMsg('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
          return;
        }
      } catch (err: any) {
        console.warn('Lỗi requestPermissions:', err);
      }
    }

    const success = await speechService.startListening({
      onPartialResult: (text) => {
        setTranscript(text);
        // Tự động phân tích realtime để xem trước
        if (text.trim().length > 2) {
          const parsed = parseVoiceInput(text, categories);
          setPreviewResult(parsed);
        }
      },
      onFinalResult: async (text) => {
        setTranscript(text);
        if (!hasFinishedRef.current && text.trim().length > 1) {
          hasFinishedRef.current = true;
          setIsAnalyzing(true);
          try {
            const parsed = await parseVoiceWithGemini(text, categories);
            setPreviewResult(parsed);
            setTimeout(() => {
              handleConfirm(parsed);
            }, 600);
          } catch {
            const fallback = parseVoiceInput(text, categories);
            setPreviewResult(fallback);
            setTimeout(() => {
              handleConfirm(fallback);
            }, 600);
          } finally {
            setIsAnalyzing(false);
          }
        }
      },
      onError: (err) => {
        setErrorMsg(err);
        setIsListening(false);
        setIsAnalyzing(false);
      },
      onListeningStateChange: (listening) => {
        setIsListening(listening);
      },
    });

    if (success) {
      setIsListening(true);
    }
  };

  const handleStopAndParse = async () => {
    const finalTxt = await speechService.stopListening();
    setIsListening(false);
    const textToParse = transcript || finalTxt;
    if (textToParse.trim()) {
      setIsAnalyzing(true);
      try {
        const parsed = await parseVoiceWithGemini(textToParse, categories);
        setPreviewResult(parsed);
        handleConfirm(parsed);
      } catch {
        const fallback = parseVoiceInput(textToParse, categories);
        setPreviewResult(fallback);
        handleConfirm(fallback);
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      setErrorMsg('Chưa nghe rõ nội dung. Vui lòng thử nói lại!');
    }
  };

  const handleConfirm = (res: ParsedVoiceResult) => {
    speechService.stopListening();
    onParsedResult(res);
    onClose();
  };

  const handleSelectExample = async (exampleText: string) => {
    setTranscript(exampleText);
    setIsAnalyzing(true);
    try {
      const parsed = await parseVoiceWithGemini(exampleText, categories);
      setPreviewResult(parsed);
      handleConfirm(parsed);
    } catch {
      const fallback = parseVoiceInput(exampleText, categories);
      setPreviewResult(fallback);
      handleConfirm(fallback);
    } finally {
      setIsAnalyzing(false);
    }
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
          onClick={onClose}
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
            ? 'Google Gemini AI đang bóc tách...'
            : isListening
            ? 'Đang lắng nghe bạn nói...'
            : 'Đã dừng ghi âm'}
        </h3>

        {/* Visualizer / Animated Microphone */}
        <div className="relative flex items-center justify-center mb-6">
          {(isListening || isAnalyzing) && (
            <>
              <div className="absolute w-28 h-28 rounded-full bg-[#ea580c]/15 animate-ping" />
              <div className="absolute w-24 h-24 rounded-full bg-[#ea580c]/25 animate-pulse" />
            </>
          )}

          <button
            onClick={() => {
              if (isAnalyzing) return;
              if (isListening) {
                handleStopAndParse();
              } else {
                startRecording();
              }
            }}
            disabled={isAnalyzing}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 ${
              isAnalyzing
                ? 'bg-[#ea580c] ring-4 ring-[#ea580c]/30 cursor-wait'
                : isListening
                ? 'bg-gradient-to-tr from-[#ea580c] to-[#f97316] ring-4 ring-[#ea580c]/30'
                : 'bg-[#7a6a58] hover:bg-[#5c4f42]'
            }`}
            title={isAnalyzing ? 'Đang phân tích...' : isListening ? 'Bấm để hoàn tất' : 'Bấm để nói lại'}
          >
            {isAnalyzing ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : isListening ? (
              <Mic className="w-9 h-9 animate-bounce" />
            ) : (
              <MicOff className="w-9 h-9" />
            )}
          </button>
        </div>

        {/* Hộp hiển thị văn bản nhận diện được */}
        <div className="w-full min-h-[72px] p-3.5 rounded-2xl bg-[#fbf5eb] border border-[#ebdcc9] flex flex-col justify-center items-center mb-4 transition">
          {isAnalyzing ? (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ea580c] animate-pulse">
                <Sparkles className="w-4 h-4 animate-spin text-[#ea580c]" />
                <span>Google Gemini AI đang phân tích câu nói...</span>
              </div>
              {transcript && (
                <p className="text-xs text-[#7a6a58] italic break-words line-clamp-1">
                  "{transcript}"
                </p>
              )}
            </div>
          ) : transcript ? (
            <p className="text-sm font-semibold text-[#3e332a] italic break-words">
              "{transcript}"
            </p>
          ) : isListening ? (
            <p className="text-xs text-[#7a6a58] flex items-center gap-1.5 animate-pulse">
              <Volume2 className="w-3.5 h-3.5 text-[#ea580c]" />
              <span>Hãy nói số tiền và mục đích (VD: "Đổ xăng 50 nghìn")...</span>
            </p>
          ) : (
            <p className="text-xs text-[#7a6a58]">Bấm vào biểu tượng Micro để nói</p>
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

        {/* Gợi ý các mẫu câu nói phổ biến */}
        <div className="w-full pt-2 border-t border-[#f0e4d5]">
          <div className="text-[11px] text-[#7a6a58] mb-2 font-medium">
            Hoặc thử bấm nhanh mẫu câu ví dụ:
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              'Đổ xăng 50 nghìn',
              'Ăn cơm trưa 35k',
              'Cà phê 30 ngàn',
              'Tiền phòng 2 triệu 500',
              'Lương tháng này 15 triệu',
            ].map((eg, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectExample(eg)}
                className="px-2.5 py-1 rounded-lg bg-[#f5ebe0] hover:bg-[#ebdcc9] text-[11px] text-[#5c4f42] font-medium transition active:scale-95"
              >
                {eg}
              </button>
            ))}
          </div>
        </div>

        {/* Action button */}
        <div className="w-full mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#ebdcc9] text-xs font-semibold text-[#7a6a58] hover:bg-[#f5ebe0] transition"
          >
            Đóng
          </button>
          {previewResult && previewResult.amount > 0 ? (
            <button
              onClick={() => handleConfirm(previewResult)}
              className="flex-1 py-2.5 rounded-xl bg-[#ea580c] text-white text-xs font-semibold hover:bg-[#c2410c] shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <span>Điền vào hóa đơn</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleStopAndParse}
              disabled={!transcript}
              className="flex-1 py-2.5 rounded-xl bg-[#3e332a] text-white text-xs font-semibold hover:bg-[#2c241d] disabled:opacity-40 shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <span>{isListening ? 'Hoàn tất nói' : 'Phân tích câu'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
