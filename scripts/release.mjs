import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const versionJsonPath = path.join(rootDir, 'version.json');
const pkgJsonPath = path.join(rootDir, 'package.json');
const appUpdaterPath = path.join(rootDir, 'src', 'utils', 'appUpdater.ts');

const args = process.argv.slice(2);
const isApkMode = args.includes('--apk');
const customNotesArg = args.find((a) => !a.startsWith('--'));

// 1. Đọc phiên bản hiện tại và tự động tăng thêm +0.0.1
const currentConfig = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
const parts = (currentConfig.version || '2.1.0')
  .replace(/^v/i, '')
  .split('.')
  .map((n) => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);
parts[2] += 1;
const nextVersion = parts.join('.');

const defaultNotes =
  '- Tự động đọc biến động số dư ngân hàng & ví điện tử (MB, VCB, MoMo, ZaloPay...)\n' +
  '- Khay chờ duyệt biến động số dư thông minh trên trang chủ\n' +
  '- Tự động nhận diện chuyển tiền nội bộ giữa các ví\n' +
  '- Kéo thả và đổi thứ tự các sổ chi tiêu';

const releaseNotes = customNotesArg || defaultNotes;

console.log(`\n🚀 Bắt đầu đóng gói bản cập nhật v${nextVersion} (${isApkMode ? 'APK' : 'OTA Nhanh'})...`);

// 2. Cập nhật số phiên bản vào src/utils/appUpdater.ts & package.json
const updaterContent = fs.readFileSync(appUpdaterPath, 'utf8');
fs.writeFileSync(
  appUpdaterPath,
  updaterContent.replace(
    /export const BUILTIN_APP_VERSION = '[^']+';/,
    `export const BUILTIN_APP_VERSION = '${nextVersion}';`
  ),
  'utf8'
);

const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
pkg.version = nextVersion;
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 3. Build giao diện Web và nén thành ota-bundle.zip
console.log('📦 Đang biên dịch giao diện (npm run build)...');
execSync('npm run build', { stdio: 'inherit' });

console.log('🗜️ Đang đóng gói ota-bundle.zip...');
execSync(
  `powershell -Command "Compress-Archive -Path 'dist\\*' -DestinationPath '.\\ota-bundle.zip' -Force"`,
  { stdio: 'inherit' }
);

console.log('🤖 Đang đồng bộ và biên dịch Android APK...');
execSync('npx cap sync', { stdio: 'inherit' });
execSync('.\\gradlew.bat assembleDebug', { cwd: path.join(rootDir, 'android'), stdio: 'inherit' });
fs.copyFileSync(
  path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(rootDir, 'app-debug.apk')
);

// 4. Ghi file version.json mới
const nextConfig = {
  version: nextVersion,
  updateType: 'apk',
  downloadUrl: 'https://raw.githubusercontent.com/khang2309/so-chi-tieu-lam-gia-khang/main/app-debug.apk',
  releaseNotes,
  allowSkip: true,
  updatedAt: new Date().toISOString(),
};
fs.writeFileSync(versionJsonPath, JSON.stringify(nextConfig, null, 2) + '\n', 'utf8');

// 5. Tự động đẩy lên GitHub để người dùng nhận thông báo cập nhật ngay
try {
  console.log('☁️ Đang commit và đẩy lên GitHub...');
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git add -f app-debug.apk', { stdio: 'inherit' });
  execSync(`git commit -m "chore(release): publish update v${nextVersion}"`, {
    stdio: 'inherit',
  });
  execSync('git push origin main', { stdio: 'inherit' });
  console.log(`\n✅ Hoàn tất! Bản cập nhật v${nextVersion} đã được phát hành tự động tới người dùng.`);
} catch (err) {
  console.warn('\n⚠️ Đã tạo xong nhưng gặp lỗi khi push lên Git:', err.message);
}

// 6. Đồng bộ thông tin bản phát hành lên Firebase Firestore
try {
  console.log('🔥 Đang đồng bộ cấu hình cập nhật lên Firebase Firestore...');
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, doc, setDoc } = await import('firebase/firestore');

  const firebaseConfig = {
    apiKey: 'AIzaSyBSwAvAYzffjqdTtMaB-9K1asxdK-b2yX8',
    authDomain: 'sochitieu-khanglam.firebaseapp.com',
    projectId: 'sochitieu-khanglam',
    storageBucket: 'sochitieu-khanglam.firebasestorage.app',
    messagingSenderId: '1049457866930',
    appId: '1:1049457866930:web:df621c7298b0e4e14d71ab',
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  await setDoc(doc(db, 'app_config', 'release'), nextConfig);
  console.log('✅ Đã đồng bộ lên Firebase Cloud thành công!');
  process.exit(0);
} catch (err) {
  console.warn('⚠️ Lỗi đồng bộ lên Firestore:', err.message);
  process.exit(0);
}
