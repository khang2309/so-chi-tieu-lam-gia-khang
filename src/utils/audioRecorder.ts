/**
 * Quản lý ghi âm âm thanh bằng MediaRecorder API tiêu chuẩn HTML5.
 * Thay thế hoàn toàn cho plugin nhận diện giọng nói cũ.
 */

export interface RecordedAudioResult {
  base64Data: string;
  mimeType: string;
  durationMs: number;
}

class AudioRecorderService {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime = 0;
  private isRecordingActive = false;

  /**
   * Bắt đầu ghi âm từ microphone qua navigator.mediaDevices.getUserMedia
   */
  public async startRecording(): Promise<boolean> {
    // Dọn dẹp phiên cũ nếu đang chạy dở
    this.cleanup();

    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Thiết bị hoặc trình duyệt không hỗ trợ MediaDevices.getUserMedia.');
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.mediaStream = stream;
      this.audioChunks = [];
      this.startTime = Date.now();

      // Kiểm tra định dạng audio được hỗ trợ
      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];

      let selectedMime = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const t of candidateTypes) {
          if (MediaRecorder.isTypeSupported(t)) {
            selectedMime = t;
            break;
          }
        }
      }

      // Tăng bitrate ghi âm 128kbps để lọc sạch tạp âm và tăng độ chi tiết âm thanh
      const options: MediaRecorderOptions = {
        ...(selectedMime ? { mimeType: selectedMime } : {}),
        audioBitsPerSecond: 128000,
      };

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (err) {
        console.warn('Không thể áp dụng audioBitsPerSecond, sử dụng cấu hình mặc định:', err);
        recorder = new MediaRecorder(stream);
      }
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Ghi âm theo chunk 100ms
      recorder.start(100);
      this.isRecordingActive = true;
      return true;
    } catch (err: any) {
      this.cleanup();
      console.error('Lỗi getUserMedia khi bắt đầu ghi âm:', err);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        throw new Error('Vui lòng cấp quyền Microphone trong Cài đặt thiết bị để sử dụng tính năng này.');
      }
      throw new Error(`Không thể khởi động ghi âm: ${err?.message || err}`);
    }
  }

  /**
   * Dừng ghi âm, tắt microphone và chuyển đổi dữ liệu thành Base64
   */
  public async stopRecording(): Promise<RecordedAudioResult> {
    if (!this.mediaRecorder || !this.isRecordingActive) {
      this.cleanup();
      throw new Error('Không có tiến trình ghi âm nào đang chạy.');
    }

    const recorder = this.mediaRecorder;
    const durationMs = Date.now() - this.startTime;
    this.isRecordingActive = false;

    return new Promise<RecordedAudioResult>((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const rawMime = recorder.mimeType || 'audio/webm';
          // Tách bỏ codec để Gemini chấp nhận mime_type sạch (audio/webm, audio/mp4...)
          const cleanMime = rawMime.split(';')[0].trim() || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: cleanMime });

          if (audioBlob.size < 100 || durationMs < 300) {
            this.cleanup();
            throw new Error('Đoạn âm thanh quá ngắn hoặc chưa thu được tiếng nói.');
          }

          // Chuyển Blob thành chuỗi Base64
          const base64Data = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64 = result.includes(',') ? result.split(',')[1] : result;
              res(base64);
            };
            reader.onerror = rej;
            reader.readAsDataURL(audioBlob);
          });

          this.cleanup();

          resolve({
            base64Data,
            mimeType: cleanMime,
            durationMs,
          });
        } catch (err) {
          this.cleanup();
          reject(err);
        }
      };

      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          recorder.onstop?.(new Event('stop'));
        }
      } catch (err) {
        this.cleanup();
        reject(err);
      }
    });
  }

  /**
   * Hủy ghi âm mà không xử lý dữ liệu
   */
  public cancelRecording(): void {
    this.cleanup();
  }

  public isRecording(): boolean {
    return this.isRecordingActive;
  }

  private cleanup(): void {
    this.isRecordingActive = false;
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {}
      this.mediaRecorder = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.mediaStream = null;
    }
    this.audioChunks = [];
  }
}

export const audioRecorder = new AudioRecorderService();
