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
        const { available } = await SpeechRecognition.available().catch(() => ({ available: false }));
        if (!available) {
          // Thử tiếp tục nếu là thiết bị Android một số dòng máy
          console.warn('SpeechRecognition.available returned false, continuing attempt...');
        }

        // Bước 1: Dùng SpeechRecognition.checkPermissions() để kiểm tra trạng thái thực tế
        let isGranted = false;
        try {
          const permStatus = await SpeechRecognition.checkPermissions();
          if (permStatus.speechRecognition === 'granted') {
            isGranted = true;
          }
        } catch (checkErr) {
          console.warn('SpeechRecognition.checkPermissions error:', checkErr);
        }

        // Bước 2: Nếu chưa được cấp quyền (prompt / denied), mới gọi SpeechRecognition.requestPermissions()
        if (!isGranted) {
          try {
            const reqStatus = await SpeechRecognition.requestPermissions();
            if (reqStatus.speechRecognition === 'granted') {
              isGranted = true;
            }
          } catch (reqErr) {
            console.warn('SpeechRecognition.requestPermissions error:', reqErr);
          }
        }

        // Bước 3: Nếu Native plugin vẫn báo denied hoặc chưa có quyền
        // Tự động chuyển hướng (fallback) sang Web Speech API của HTML5 mặc định trên Android WebView
        if (!isGranted) {
          console.warn(
            'Native SpeechRecognition báo chưa có quyền. Tự động chuyển hướng (fallback) sang Web Speech API của Android WebView...'
          );
          const webFallbackStarted = this.startWebSpeechFallback(callbacks);
          if (webFallbackStarted) {
            return true;
          }

          alert('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
          callbacks.onError('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
          this.isListeningActive = false;
          callbacks.onListeningStateChange?.(false);
          return false;
        }

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

        // Bắt đầu nhận diện giọng nói tiếng Việt với cấu hình nghiêm ngặt
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
      } catch (err: any) {
        console.warn('Lỗi native speech recognition, tự động fallback sang Web Speech API:', err);
        const webFallbackStarted = this.startWebSpeechFallback(callbacks);
        if (webFallbackStarted) {
          return true;
        }
        alert('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
        callbacks.onError('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
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
        if (event.error === 'not-allowed') {
          alert('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
          callbacks.onError('Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Sổ Chi Tiêu -> Cấp quyền Micro để sử dụng tính năng này.');
        } else if (event.error !== 'no-speech') {
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
