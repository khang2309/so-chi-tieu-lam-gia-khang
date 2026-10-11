import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

export interface SpeechServiceCallbacks {
  onPartialResult: (text: string) => void;
  onFinalResult: (text: string) => void;
  onError: (errorMsg: string) => void;
  onListeningStateChange?: (isListening: boolean) => void;
}

class SpeechService {
  private isNative = Capacitor.isNativePlatform();
  private webRecognition: any = null;
  private partialListenerHandle: any = null;
  private stateListenerHandle: any = null;
  private currentTranscript = '';
  private isListeningActive = false;

  public async startListening(callbacks: SpeechServiceCallbacks): Promise<boolean> {
    this.currentTranscript = '';
    this.isListeningActive = true;
    callbacks.onListeningStateChange?.(true);

    if (this.isNative) {
      try {
        // Dọn dẹp phiên trước: gọi stop() và remove listeners
        try {
          await SpeechRecognition.stop();
        } catch {}
        try {
          await SpeechRecognition.removeAllListeners();
        } catch {}

        // Bắt buộc thêm khoảng trễ 400ms (300ms - 500ms) để Android và plugin giải phóng tài nguyên
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Ép xin quyền một lần để chắc chắn, bỏ qua kết quả trả về
        await SpeechRecognition.requestPermissions().catch((e) => {
          console.warn('requestPermissions caught:', e);
        });

        // Xóa các listeners cũ
        await SpeechRecognition.removeAllListeners().catch(() => {});

        // Lắng nghe kết quả từng phần (realtime)
        this.partialListenerHandle = await SpeechRecognition.addListener(
          'partialResults',
          (data: { matches: string[] }) => {
            if (data.matches && data.matches.length > 0) {
              const text = data.matches[0];
              this.currentTranscript = text;
              callbacks.onPartialResult(text);
            }
          }
        );

        // Lắng nghe trạng thái dừng nghe
        this.stateListenerHandle = await SpeechRecognition.addListener(
          'listeningState',
          (data: { status: 'started' | 'stopped' }) => {
            if (data.status === 'stopped') {
              this.isListeningActive = false;
              callbacks.onListeningStateChange?.(false);
              if (this.currentTranscript.trim()) {
                callbacks.onFinalResult(this.currentTranscript.trim());
              }
            }
          }
        );

        // FORCE START: Gọi Start luôn! Để hệ điều hành Android tự quyết định việc chặn hay không
        const startResult = await SpeechRecognition.start({
          language: 'vi-VN',
          maxResults: 1,
          partialResults: false,
          prompt: 'Đang lắng nghe tiếng Việt...',
        });

        // Khi partialResults: false, SpeechRecognition.start trả về kết quả matches cuối cùng
        if (startResult && startResult.matches && startResult.matches.length > 0) {
          const text = startResult.matches[0];
          this.currentTranscript = text;
          callbacks.onPartialResult(text);
          callbacks.onFinalResult(text);
        }

        return true;
      } catch (error: any) {
        console.warn('Native SpeechRecognition gặp lỗi, tự động fallback sang Web Speech API:', error);

        // Tự động chuyển sang sử dụng API mặc định của trình duyệt (window.SpeechRecognition || window.webkitSpeechRecognition)
        const webFallbackStarted = this.startWebSpeechFallback(callbacks);
        if (webFallbackStarted) {
          return true;
        }

        const errMsg = String(error?.message || error || '').toLowerCase();
        // Nếu có lỗi aborted văng ra, tuyệt đối KHÔNG hiển thị dòng chữ đỏ báo lỗi. Chỉ reset lại giao diện
        if (errMsg.includes('aborted') || errMsg.includes('abort') || errMsg.includes('no-speech')) {
          this.isListeningActive = false;
          callbacks.onListeningStateChange?.(false);
          return false;
        }

        callbacks.onError(error?.message || 'Lỗi nhận diện giọng nói');
        this.isListeningActive = false;
        callbacks.onListeningStateChange?.(false);
        return false;
      }
    } else {
      // Môi trường Web / Browser
      const webFallbackStarted = this.startWebSpeechFallback(callbacks);
      if (!webFallbackStarted) {
        callbacks.onError(
          'Trình duyệt hoặc thiết bị chưa hỗ trợ nhận diện giọng nói (Web Speech API). Vui lòng chạy trên Chrome hoặc Android.'
        );
        this.isListeningActive = false;
        callbacks.onListeningStateChange?.(false);
        return false;
      }
      return true;
    }
  }

  private startWebSpeechFallback(callbacks: SpeechServiceCallbacks): boolean {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('Web Speech API không khả dụng trên môi trường này.');
      return false;
    }

    try {
      if (this.webRecognition) {
        try {
          this.webRecognition.abort();
        } catch {}
        this.webRecognition = null;
      }

      this.webRecognition = new SpeechRecognitionAPI();
      this.webRecognition.lang = 'vi-VN';
      this.webRecognition.interimResults = true;
      this.webRecognition.maxAlternatives = 1;
      this.webRecognition.continuous = false;

      this.webRecognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalText += res[0].transcript;
          } else {
            interimText += res[0].transcript;
          }
        }

        const text = finalText || interimText;
        if (text) {
          this.currentTranscript = text;
          callbacks.onPartialResult(text);
        }
      };

      this.webRecognition.onerror = (event: any) => {
        console.warn('Web Speech Recognition error:', event.error);
        const errType = String(event.error || '').toLowerCase();

        // Nếu là aborted hoặc no-speech, tuyệt đối KHÔNG hiển thị dòng chữ đỏ báo lỗi, chỉ reset giao diện
        if (errType.includes('abort') || errType.includes('no-speech')) {
          this.isListeningActive = false;
          callbacks.onListeningStateChange?.(false);
          return;
        }

        if (errType === 'not-allowed') {
          alert('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
          callbacks.onError('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
        } else {
          callbacks.onError(`Lỗi nhận diện giọng nói: ${event.error}`);
        }
        this.isListeningActive = false;
        callbacks.onListeningStateChange?.(false);
      };

      this.webRecognition.onend = () => {
        this.isListeningActive = false;
        callbacks.onListeningStateChange?.(false);
        if (this.currentTranscript.trim()) {
          callbacks.onFinalResult(this.currentTranscript.trim());
        }
      };

      this.webRecognition.start();
      return true;
    } catch (err: any) {
      callbacks.onError(`Không thể khởi động ghi âm: ${err?.message || String(err)}`);
      this.isListeningActive = false;
      callbacks.onListeningStateChange?.(false);
      return false;
    }
  }

  public async stopListening(): Promise<string> {
    this.isListeningActive = false;
    if (this.isNative) {
      try {
        await SpeechRecognition.stop().catch(() => {});
        if (this.partialListenerHandle) {
          this.partialListenerHandle.remove();
          this.partialListenerHandle = null;
        }
        if (this.stateListenerHandle) {
          this.stateListenerHandle.remove();
          this.stateListenerHandle = null;
        }
      } catch (e) {
        console.warn('Lỗi stop native SpeechRecognition:', e);
      }
    }

    if (this.webRecognition) {
      try {
        this.webRecognition.stop();
      } catch (e) {
        console.warn('Lỗi stop webRecognition:', e);
      }
      this.webRecognition = null;
    }

    return this.currentTranscript.trim();
  }

  public isListening(): boolean {
    return this.isListeningActive;
  }
}

export const speechService = new SpeechService();
