package com.lamgiakhang.sochitieu;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "CapWebViewSettings";
    private static final String KEY_SERVER_PATH = "serverBasePath";
    private static final String KEY_OTA_VERSION = "otaVersion";
    public static MainActivity instance = null;

    public static void notifyBankNotificationReceived() {
        if (instance != null && instance.bridge != null && instance.bridge.getWebView() != null) {
            instance.bridge.getWebView().post(() -> {
                try {
                    instance.bridge.getWebView().evaluateJavascript(
                            "if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('bank-notification-received')); }",
                            null
                    );
                } catch (Exception ignored) {
                }
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // Khôi phục và áp dụng serverBasePath OTA đã cài đặt nếu tồn tại và hợp lệ
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        String savedOtaPath = prefs.getString(KEY_SERVER_PATH, null);
        if (savedOtaPath != null && !savedOtaPath.isEmpty()) {
            File otaDir = new File(savedOtaPath);
            File indexFile = new File(otaDir, "index.html");
            if (indexFile.exists() && indexFile.length() > 0) {
                // Đảm bảo Capacitor cũng lưu đường dẫn này vào CapWebViewSettings
                SharedPreferences capPrefs = getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE);
                capPrefs.edit().putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, savedOtaPath).apply();
                if (this.bridge != null) {
                    this.bridge.setServerBasePath(savedOtaPath);
                }
            } else {
                prefs.edit().remove(KEY_SERVER_PATH).remove(KEY_OTA_VERSION).apply();
                SharedPreferences capPrefs = getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE);
                capPrefs.edit().remove(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH).apply();
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS},
                    1001);
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new AndroidUpdater(), "AndroidUpdater");
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        instance = this;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            try {
                android.service.notification.NotificationListenerService.requestRebind(
                        new android.content.ComponentName(this, BankNotificationListenerService.class)
                );
            } catch (Exception ignored) {
            }
        }
        if (this.bridge != null && this.bridge.getWebView() != null) {
            if (BankNotificationListenerService.currentServiceInstance != null) {
                BankNotificationListenerService.currentServiceInstance.scanActiveNotifications();
            }
            notifyBankNotificationReceived();
        }
    }

    private void emitUpdateEvent(int progress, String status, String error) {
        if (this.bridge == null || this.bridge.getWebView() == null) return;
        runOnUiThread(() -> {
            try {
                JSONObject detail = new JSONObject();
                detail.put("progress", progress);
                detail.put("status", status != null ? status : "");
                if (error != null) {
                    detail.put("error", error);
                }
                String js = "window.dispatchEvent(new CustomEvent('app-update-progress', { detail: " + detail.toString() + " }));";
                MainActivity.this.bridge.getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {
            }
        });
    }

    private void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory == null || !fileOrDirectory.exists()) return;
        if (fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        fileOrDirectory.delete();
    }

    public class AndroidUpdater {
        @JavascriptInterface
        public String getInstalledOtaVersion() {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
            String path = prefs.getString(KEY_SERVER_PATH, null);
            if (path == null || path.isEmpty() || !new File(path).exists()) {
                return "";
            }
            return prefs.getString(KEY_OTA_VERSION, "");
        }

        @JavascriptInterface
        public void resetOtaBundle() {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
            prefs.edit().remove(KEY_SERVER_PATH).remove(KEY_OTA_VERSION).apply();
            runOnUiThread(() -> {
                if (MainActivity.this.bridge != null) {
                    MainActivity.this.bridge.setServerAssetPath("public");
                }
            });
        }

        @JavascriptInterface
        public boolean isNotificationPermissionGranted() {
            try {
                String pkg = getPackageName();
                String flat = android.provider.Settings.Secure.getString(
                        getContentResolver(),
                        "enabled_notification_listeners"
                );
                return flat != null && flat.contains(pkg);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            try {
                Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String getPendingBankNotifications() {
            SharedPreferences prefs = getSharedPreferences(
                    BankNotificationListenerService.PREFS_NAME,
                    Activity.MODE_PRIVATE
            );
            return prefs.getString(BankNotificationListenerService.KEY_PENDING_LIST, "[]");
        }

        @JavascriptInterface
        public void clearPendingBankNotifications() {
            SharedPreferences prefs = getSharedPreferences(
                    BankNotificationListenerService.PREFS_NAME,
                    Activity.MODE_PRIVATE
            );
            prefs.edit().putString(BankNotificationListenerService.KEY_PENDING_LIST, "[]").apply();
        }

        @JavascriptInterface
        public boolean isListenerConnected() {
            return BankNotificationListenerService.currentServiceInstance != null;
        }

        @JavascriptInterface
        public String getRawNotificationLog() {
            SharedPreferences prefs = getSharedPreferences(
                    BankNotificationListenerService.PREFS_NAME,
                    Activity.MODE_PRIVATE
            );
            return prefs.getString(BankNotificationListenerService.KEY_RAW_LOG, "[]");
        }

        @JavascriptInterface
        public void triggerActiveNotificationsScan() {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                try {
                    android.service.notification.NotificationListenerService.requestRebind(
                            new android.content.ComponentName(MainActivity.this, BankNotificationListenerService.class)
                    );
                } catch (Exception ignored) {
                }
            }
            if (BankNotificationListenerService.currentServiceInstance != null) {
                BankNotificationListenerService.currentServiceInstance.scanActiveNotifications();
            }
            notifyBankNotificationReceived();
        }

        @JavascriptInterface
        public void simulateTestNotification() {
            simulateTestNotificationWithData(
                    "com.mbmobile",
                    "MB Bank",
                    "MB Bank - Biến động số dư",
                    "TK 1010101010|GD: +50,000VND 13/10/26 15:10|SD: 1,500,000VND|ND: Test thu nghiem chuyen khoan"
            );
        }

        @JavascriptInterface
        public void simulateTestNotificationWithData(String pkg, String appName, String title, String text) {
            SharedPreferences prefs = getSharedPreferences(
                    BankNotificationListenerService.PREFS_NAME,
                    Activity.MODE_PRIVATE
            );
            try {
                String raw = prefs.getString(BankNotificationListenerService.KEY_PENDING_LIST, "[]");
                org.json.JSONArray arr = new org.json.JSONArray(raw);
                org.json.JSONObject testItem = new org.json.JSONObject();
                long now = System.currentTimeMillis();
                testItem.put("id", "test-" + now);
                testItem.put("packageName", pkg != null && !pkg.isEmpty() ? pkg : "com.mbmobile");
                testItem.put("appName", appName != null && !appName.isEmpty() ? appName : "MB Bank");
                testItem.put("title", title != null && !title.isEmpty() ? title : "Biến động số dư");
                testItem.put("text", text != null && !text.isEmpty() ? text : "GD: +50,000VND");
                testItem.put("timestamp", now);
                arr.put(testItem);
                prefs.edit().putString(BankNotificationListenerService.KEY_PENDING_LIST, arr.toString()).apply();
                notifyBankNotificationReceived();
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void downloadAndApplyOtaZip(final String zipUrl, final String version) {
            new Thread(() -> {
                try {
                    emitUpdateEvent(5, "downloading", null);
                    URL url = new URL(zipUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setInstanceFollowRedirects(true);
                    conn.connect();

                    int responseCode = conn.getResponseCode();
                    if (responseCode >= 300 && responseCode < 400) {
                        String redirectUrl = conn.getHeaderField("Location");
                        if (redirectUrl != null) {
                            conn.disconnect();
                            conn = (HttpURLConnection) new URL(redirectUrl).openConnection();
                            conn.connect();
                        }
                    }

                    int fileLength = conn.getContentLength();
                    File tempZip = new File(getCacheDir(), "ota_bundle.zip");
                    if (tempZip.exists()) tempZip.delete();

                    try (InputStream input = new BufferedInputStream(conn.getInputStream());
                         FileOutputStream output = new FileOutputStream(tempZip)) {
                        byte[] data = new byte[8192];
                        long total = 0;
                        int count;
                        int lastReported = 5;
                        while ((count = input.read(data)) != -1) {
                            total += count;
                            output.write(data, 0, count);
                            if (fileLength > 0) {
                                int progress = 5 + (int) ((total * 75) / fileLength);
                                if (progress - lastReported >= 5) {
                                    lastReported = progress;
                                    emitUpdateEvent(progress, "downloading", null);
                                }
                            }
                        }
                        output.flush();
                    }
                    conn.disconnect();

                    emitUpdateEvent(85, "extracting", null);
                    File otaRoot = new File(getFilesDir(), "ota_bundles");
                    String safeVersion = version.replaceAll("[^a-zA-Z0-9._-]", "_");
                    File targetDir = new File(otaRoot, "v_" + safeVersion);
                    if (targetDir.exists()) {
                        deleteRecursive(targetDir);
                    }
                    targetDir.mkdirs();

                    try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(tempZip)))) {
                        ZipEntry entry;
                        byte[] buffer = new byte[8192];
                        String canonicalRoot = targetDir.getCanonicalPath();
                        while ((entry = zis.getNextEntry()) != null) {
                            String entryName = entry.getName().replace('\\', '/');
                            File outFile = new File(targetDir, entryName);
                            if (!outFile.getCanonicalPath().startsWith(canonicalRoot)) {
                                throw new SecurityException("Zip Slip detected");
                            }
                            if (entry.isDirectory() || entryName.endsWith("/")) {
                                outFile.mkdirs();
                            } else {
                                File parent = outFile.getParentFile();
                                if (parent != null && !parent.exists()) {
                                    parent.mkdirs();
                                }
                                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                                    int len;
                                    while ((len = zis.read(buffer)) != -1) {
                                        fos.write(buffer, 0, len);
                                    }
                                }
                            }
                            zis.closeEntry();
                        }
                    }
                    tempZip.delete();

                    // Check if index.html is at root of targetDir or inside a single subfolder (e.g. dist/index.html)
                    File webRoot = targetDir;
                    if (!new File(webRoot, "index.html").exists()) {
                        File[] subFiles = targetDir.listFiles();
                        if (subFiles != null) {
                            for (File sub : subFiles) {
                                if (sub.isDirectory() && new File(sub, "index.html").exists()) {
                                    webRoot = sub;
                                    break;
                                }
                            }
                        }
                    }

                    if (!new File(webRoot, "index.html").exists() || !new File(webRoot, "assets").exists()) {
                        deleteRecursive(targetDir);
                        emitUpdateEvent(0, "error", "Gói cập nhật không hợp lệ (thiếu index.html hoặc assets)");
                        return;
                    }

                    final String finalWebPath = webRoot.getAbsolutePath();
                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
                    prefs.edit()
                            .putString(KEY_SERVER_PATH, finalWebPath)
                            .putString(KEY_OTA_VERSION, version)
                            .apply();

                    SharedPreferences capPrefs = getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE);
                    capPrefs.edit()
                            .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, finalWebPath)
                            .apply();

                    emitUpdateEvent(100, "completed", null);
                    runOnUiThread(() -> {
                        if (MainActivity.this.bridge != null) {
                            MainActivity.this.bridge.setServerBasePath(finalWebPath);
                        }
                    });
                } catch (Exception e) {
                    emitUpdateEvent(0, "error", e.getMessage() != null ? e.getMessage() : "Lỗi tải gói cập nhật");
                }
            }).start();
        }

        @JavascriptInterface
        public void downloadAndInstallApk(final String apkUrl) {
            new Thread(() -> {
                try {
                    emitUpdateEvent(5, "downloading", null);
                    URL url = new URL(apkUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setInstanceFollowRedirects(true);
                    conn.connect();

                    int responseCode = conn.getResponseCode();
                    if (responseCode >= 300 && responseCode < 400) {
                        String redirectUrl = conn.getHeaderField("Location");
                        if (redirectUrl != null) {
                            conn.disconnect();
                            conn = (HttpURLConnection) new URL(redirectUrl).openConnection();
                            conn.connect();
                        }
                    }

                    int fileLength = conn.getContentLength();
                    File apkFile = new File(getCacheDir(), "so_chi_tieu_update.apk");
                    if (apkFile.exists()) apkFile.delete();

                    try (InputStream input = new BufferedInputStream(conn.getInputStream());
                         FileOutputStream output = new FileOutputStream(apkFile)) {
                        byte[] data = new byte[8192];
                        long total = 0;
                        int count;
                        int lastReported = 5;
                        while ((count = input.read(data)) != -1) {
                            total += count;
                            output.write(data, 0, count);
                            if (fileLength > 0) {
                                int progress = 5 + (int) ((total * 90) / fileLength);
                                if (progress - lastReported >= 4) {
                                    lastReported = progress;
                                    emitUpdateEvent(progress, "downloading", null);
                                }
                            }
                        }
                        output.flush();
                    }
                    conn.disconnect();

                    emitUpdateEvent(100, "installing", null);

                    runOnUiThread(() -> {
                        try {
                            Uri apkUri = FileProvider.getUriForFile(
                                    MainActivity.this,
                                    getPackageName() + ".fileprovider",
                                    apkFile
                            );
                            Intent intent = new Intent(Intent.ACTION_VIEW);
                            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception ex) {
                            emitUpdateEvent(0, "error", "Không thể mở trình cài đặt APK: " + ex.getMessage());
                        }
                    });
                } catch (Exception e) {
                    emitUpdateEvent(0, "error", e.getMessage() != null ? e.getMessage() : "Lỗi tải file APK");
                }
            }).start();
        }
    }
}

