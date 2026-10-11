import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Chuyển đổi chuỗi UTF-8 sang Base64 chuẩn hỗ trợ đầy đủ tiếng Việt có dấu
 */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Chuyển chuỗi Base64 thành Blob (cho môi trường Web)
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Lưu và chia sẻ file:
 * - Trên thiết bị Android/iOS Native (Capacitor): Ghi file vào thư mục Cache qua Filesystem.writeFile và mở Share Sheet Android qua Share.share.
 * - Trên Web/Browser: Tải xuống tự động qua thẻ <a> và Blob URL.
 *
 * @param filename Tên file cần xuất (ví dụ: 'Danh_Sach_Chi_Tieu.xlsx' hoặc 'backup.json')
 * @param base64Content Dữ liệu file ở định dạng Base64
 * @param mimeType MIME type của file
 */
export async function saveAndShareFile(
  filename: string,
  base64Content: string,
  mimeType = 'application/octet-stream'
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Content,
        directory: Directory.Cache,
      });

      // Mở hộp thoại Share Android cho phép người dùng lưu về máy hoặc chia sẻ qua Zalo/Drive/Email
      await Share.share({
        title: filename,
        text: `Tệp xuất từ Sổ Chi Tiêu: ${filename}`,
        url: writeResult.uri,
        dialogTitle: `Lưu hoặc chia sẻ ${filename}`,
      });
      return;
    } catch (err: any) {
      // Nếu người dùng chỉ bấm hủy chia sẻ (cancel) thì không cần báo lỗi
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('canceled') || msg.includes('cancelled') || msg.includes('dismissed')) {
        return;
      }
      console.warn('Lỗi khi ghi file hoặc chia sẻ native, chuyển sang fallback:', err);
    }
  }

  // Fallback cho Web / Browser
  try {
    const blob = base64ToBlob(base64Content, mimeType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (webErr) {
    console.error('Lỗi khi tải file trên web:', webErr);
    alert('Không thể tải tệp: ' + (webErr as any)?.message);
  }
}
