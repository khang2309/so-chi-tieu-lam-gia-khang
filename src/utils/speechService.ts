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
        // Dọn dẹp phiên trước
        try {
          await SpeechRecognition.stop();
        } catch {}
        try {
          await SpeechRecognition.removeAllListeners();
        } catch {}

        // Trễ 300ms để Android giải phóng tài nguyên Audio
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Xin quyền Microphone
        await SpeechRecognition.requestPermissions().catch((e) => {
          console.warn('requestPermissions:', e);
        });

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

        // Lắng nghe trạng thái dừng
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

        // BẮT BUỘC SET CỨNG NGÔN NGỮ vi-VN
        const startResult = await SpeechRecognition.start({
          language: 'vi-VN',
          maxResults: 1,
          partialResults: true,
          prompt: 'Đang lắng nghe tiếng Việt (vi-VN)...',
        });

        if (startResult && startResult.matches && startResult.matches.length > 0) {
          const text = startResult.matches[0];
          this.currentTranscript = text;
          callbacks.onPartialResult(text);
          callbacks.onFinalResult(text);
        }

        return true;
      } catch (error: any) {
        console.warn('Native SpeechRecognition lỗi, thử Web Speech API fallback:', error);

        const webFallbackStarted = this.startWebSpeechFallback(callbacks);
        if (webFallbackStarted) {
          return true;
        }

        const errMsg = String(error?.message || error || '').toLowerCase();
        if (errMsg.includes('aborted') || errMsg.includes('abort') || errMsg.includes('no-speech')) {
          this.isListeningActive = false;
          callbacks.onListeningStateChange?.(false);
          return false;
        }

        callbacks.onError(error?.message || 'Không thể bắt đầu nhận diện giọng nói');
        this.isListeningActive = false;
        callbacks.onListeningStateChange?.(false);
        return false;
      }
    } else {
      // Môi trường Web / WebView
      const webFallbackStarted = this.startWebSpeechFallback(callbacks);
      if (!webFallbackStarted) {
        callbacks.onError('Trình duyệt chưa hỗ trợ Web Speech API. Vui lòng sử dụng Google Chrome hoặc Android.');
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
