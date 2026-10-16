/**
 * Tiền xử lý ảnh (Image Pre-processing) trước khi thực hiện OCR:
 * 1. Chuyển đổi thang độ xám (Grayscale): Loại bỏ màu sắc, chỉ giữ lại độ sáng/tối để tăng độ tương phản của chữ.
 * 2. Tăng độ tương phản (Contrast Enhancement): Làm cho chữ đậm hơn và nền giấy sáng/trắng hơn, loại bỏ các vết ố hoặc đổ bóng mờ.
 * 3. Làm sắc nét (Sharpening): Áp dụng bộ lọc ma trận tích chập (Convolution 3x3) để nét chữ in nhiệt / chữ viết tay sắc cạnh rõ ràng.
 */

export interface PreprocessOptions {
  contrast?: number; // Độ tăng tương phản (-255 đến 255), 0 là giữ nguyên
  sharpen?: boolean; // Bật/tắt bộ lọc làm nét
  maxDimension?: number; // Giới hạn kích thước tối đa (chuẩn 1600px để giữ nét chữ nhỏ trên phiếu giao hàng)
  quality?: number; // Chất lượng nén ảnh JPEG (chuẩn 0.8 để tối ưu tốc độ upload và AI nhận diện)
  grayscale?: boolean; // Chuyển thang độ xám (khuyên dùng false cho Gemini Vision để giữ nhận thức màu)
}

/**
 * Hàm tiền xử lý & nén ảnh trước khi gửi vào bộ máy OCR
 * @param imageSource Dữ liệu ảnh dạng data:image/... base64 hoặc URL
 * @param options Cấu hình tùy chọn
 * @returns Promise<string> Ảnh đã qua xử lý & nén ở dạng base64 JPEG
 */
export async function preprocessImage(
  imageSource: string,
  options: PreprocessOptions = {}
): Promise<string> {
  const {
    contrast = 0,
    sharpen = false,
    maxDimension = 1600,
    quality = 0.8,
    grayscale = false,
  } = options;

  return new Promise((resolve) => {
    // Tạo phần tử Image trong bộ nhớ
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Giữ tỉ lệ khung hình và giới hạn kích thước để canvas xử lý nhanh và không tràn bộ nhớ trên thiết bị di động
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // Tạo canvas ẩn
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          resolve(imageSource); // Fallback nếu trình duyệt không hỗ trợ context 2D
          return;
        }

        // Bước 1: Vẽ ảnh gốc lên canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Nếu không cần grayscale và không cần chỉnh contrast, chỉ cần nén canvas
        if (!grayscale && contrast === 0 && !sharpen) {
          const resultDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(resultDataUrl);
          return;
        }

        // Lấy dữ liệu điểm ảnh (Pixels Data)
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const len = data.length;

        // Tính hệ số tăng tương phản (Contrast factor)
        const contrastClamped = Math.max(-255, Math.min(255, contrast));
        const factor = (259 * (contrastClamped + 255)) / (255 * (259 - contrastClamped));

        // Bước 2: Xử lý màu sắc & Tương phản
        for (let i = 0; i < len; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          if (grayscale) {
            // Chuyển sang thang độ xám theo chuẩn nhận thức thị giác ITU-R BT.601
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            let enhanced = factor * (gray - 128) + 128;
            enhanced = Math.max(0, Math.min(255, enhanced));
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
          } else if (contrast !== 0) {
            data[i] = Math.max(0, Math.min(255, factor * (r - 128) + 128));
            data[i + 1] = Math.max(0, Math.min(255, factor * (g - 128) + 128));
            data[i + 2] = Math.max(0, Math.min(255, factor * (b - 128) + 128));
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Bước 3: Làm sắc nét (Sharpening) bằng ma trận tích chập 3x3
        if (sharpen && width > 10 && height > 10) {
          const currentData = ctx.getImageData(0, 0, width, height);
          const src = currentData.data;
          const outputData = ctx.createImageData(width, height);
          const dst = outputData.data;

          // Kernel làm nét cạnh (Sharpening kernel):
          // [  0, -0.5,  0 ]
          // [ -0.5,  3, -0.5 ]
          // [  0, -0.5,  0 ]
          const kCenter = 3;
          const kCross = -0.5;

          for (let y = 1; y < height - 1; y++) {
            const yOffset = y * width;
            const yPrevOffset = (y - 1) * width;
            const yNextOffset = (y + 1) * width;

            for (let x = 1; x < width - 1; x++) {
              const idx = (yOffset + x) * 4;

              const cVal = src[idx];
              const topVal = src[(yPrevOffset + x) * 4];
              const btmVal = src[(yNextOffset + x) * 4];
              const leftVal = src[(yOffset + (x - 1)) * 4];
              const rightVal = src[(yOffset + (x + 1)) * 4];

              let sharpVal = cVal * kCenter + (topVal + btmVal + leftVal + rightVal) * kCross;
              if (sharpVal < 0) sharpVal = 0;
              if (sharpVal > 255) sharpVal = 255;

              dst[idx] = sharpVal;
              dst[idx + 1] = sharpVal;
              dst[idx + 2] = sharpVal;
              dst[idx + 3] = src[idx + 3];
            }
          }

          // Sao chép các điểm ảnh biên không áp dụng kernel
          for (let x = 0; x < width; x++) {
            const topIdx = x * 4;
            const btmIdx = ((height - 1) * width + x) * 4;
            for (let c = 0; c < 4; c++) {
              dst[topIdx + c] = src[topIdx + c];
              dst[btmIdx + c] = src[btmIdx + c];
            }
          }
          for (let y = 0; y < height; y++) {
            const leftIdx = y * width * 4;
            const rightIdx = (y * width + (width - 1)) * 4;
            for (let c = 0; c < 4; c++) {
              dst[leftIdx + c] = src[leftIdx + c];
              dst[rightIdx + c] = src[rightIdx + c];
            }
          }

          ctx.putImageData(outputData, 0, 0);
        }

        // Bước 4: Xuất ảnh đã xử lý dưới định dạng JPEG nén tối ưu (chất lượng 0.7, ≤ 1024px)
        const resultDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(resultDataUrl);
      } catch (err) {
        console.warn('Lỗi trong quá trình tiền xử lý ảnh:', err);
        resolve(imageSource); // Trả về ảnh gốc nếu xảy ra lỗi
      }
    };

    img.onerror = (err) => {
      console.warn('Không thể nạp ảnh để tiền xử lý:', err);
      resolve(imageSource); // Trả về ảnh gốc nếu không nạp được
    };

    img.src = imageSource;
  });
}

/**
 * Hàm nén ảnh cục bộ siêu tốc trước khi gửi lên Gemini API:
 * - Đưa kích thước ảnh về tối đa 1600px (giữ nguyên tỷ lệ khung hình và độ sắc nét của chữ nhỏ trên phiếu giao hàng)
 * - Giữ nguyên màu sắc tự nhiên (chất lượng 0.8) để Gemini Multimodal Vision nhận diện chính xác nhất
 * - Giúp dung lượng ảnh chỉ còn 150KB - 350KB, upload chớp nhoáng và AI xử lý cực nhanh
 */
export async function compressImageForOcr(
  imageSource: string,
  maxDimension = 1600,
  quality = 0.8
): Promise<string> {
  return preprocessImage(imageSource, {
    maxDimension,
    quality,
    contrast: 0,
    sharpen: false,
    grayscale: false,
  });
}

