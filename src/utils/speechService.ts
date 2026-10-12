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

  /**
   * Khởi động nhận diện giọng nói tiếng Việt (vi-VN)
   */
  public async startListening(callbacks: SpeechServiceCallbacks): Promise<boolean> {
    this.currentTranscript = '';
    this.isListeningActive = true;
    callbacks.onListeningStateChange?.(true);

    if (this.isNative) {
      try {
        // 1. Kiểm tra tính khả dụng của Speech Recognition
        const isAvailable = await SpeechRecognition.available().catch(() => ({ available: true }));
        if (!isAvailable.available) {
          console.warn('SpeechRecognition không khả dụng trên thiết bị, thử Web Speech fallback');
          return this.startWebSpeechFallback(callbacks);
        }

        // 2. Dọn dẹp phiên trước
        try {
          await SpeechRecognition.stop();
        } catch {}

        // 3. Xin quyền Microphone nếu chưa có
        const permStatus = await SpeechRecognition.checkPermissions().catch(() => null);
        if (permStatus?.speechRecognition !== 'granted') {
          await SpeechRecognition.requestPermissions().catch((e) => {
            console.warn('requestPermissions warning:', e);
          });
        }

        // 4. Kích hoạt Google Voice Dialog chuẩn trên Android với popup: true và vi-VN
        const startResult = await SpeechRecognition.start({
          language: 'vi-VN',
          maxResults: 5,
          prompt: 'Nói chi tiêu bằng tiếng Việt (VD: "Ăn trưa 35k ví Momo")...',
          popup: true,
          partialResults: false,
        });

        const matches =
          startResult?.matches ||
          (startResult as any)?.results ||
          (startResult as any)?.value;

        if (matches && matches.length > 0) {
          const text = String(matches[0] || '').trim();
          if (text) {
            this.currentTranscript = text;
            callbacks.onPartialResult(text);
            callbacks.onFinalResult(text);
          }
        }

        this.isListeningActive = false;
        callbacks.onListeningStateChange?.(false);
        return true;
      } catch (error: any) {
        this.isListeningActive = false;
        callbacks.onListeningStateChange?.(false);

        const errMsg = String(error?.message || error || '').toLowerCase();
        // Hủy bỏ (mã 0 trên Android là RESULT_CANCELED)
        if (errMsg === '0' || errMsg.includes('cancel') || errMsg.includes('abort') || errMsg.includes('no-speech')) {
          return false;
        }

        console.warn('Native SpeechRecognition lỗi, thử Web Speech API fallback:', error);
        const webFallbackStarted = this.startWebSpeechFallback(callbacks);
        if (webFallbackStarted) {
          return true;
        }

        callbacks.onError(error?.message || 'Không thể bắt đầu nhận diện giọng nói');
        return false;
      }
    } else {
      // Môi trường Web / Chrome / WebView
      const webFallbackStarted = this.startWebSpeechFallback(callbacks);
      if (!webFallbackStarted) {
        callbacks.onError('Trình duyệt chưa hỗ trợ Web Speech API. Vui lòng sử dụng Google Chrome hoặc ứng dụng Android.');
        this.isListeningActive = false;
        callbacks.onListeningStateChange?.(false);
        return false;
      }
      return true;
    }
  }

  /**
   * Fallback qua Web Speech API (window.SpeechRecognition / webkitSpeechRecognition)
   */
  private startWebSpeechFallback(callbacks: SpeechServiceCallbacks): boolean {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('Web Speech API không khả dụng.');
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
      // BẮT BUỘC SET CỨNG vi-VN
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

        if (errType.includes('abort') || errType.includes('no-speech')) {
          this.isListeningActive = false;
          callbacks.onListeningStateChange?.(false);
          return;
        }

        if (errType === 'not-allowed') {
          callbacks.onError('Vui lòng cấp quyền Microphone để sử dụng tính năng này.');
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

  /**
   * Dừng nhận diện giọng nói và trả về kết quả transcript đã thu được
   */
  public async stopListening(): Promise<string> {
    this.isListeningActive = false;

    if (this.isNative) {
      try {
        await SpeechRecognition.stop().catch(() => {});
        // Chờ ngắn để luồng Android gửi nốt partialResults cuối cùng về WebView
        await new Promise((r) => setTimeout(r, 350));
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

  public getTranscript(): string {
    return this.currentTranscript.trim();
  }

  public isListening(): boolean {
    return this.isListeningActive;
  }
}

export const speechService = new SpeechService();
