package com.lamgiakhang.sochitieu;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

public class BankNotificationListenerService extends NotificationListenerService {
    public static final String PREFS_NAME = "BankNotificationsPrefs";
    public static final String KEY_PENDING_LIST = "pending_notifications";

    private static final Map<String, String> SUPPORTED_PACKAGES = new HashMap<>();

    static {
        // Ngân hàng phổ biến tại Việt Nam
        SUPPORTED_PACKAGES.put("com.mbmobile", "MB Bank");
        SUPPORTED_PACKAGES.put("com.VCB", "Vietcombank");
        SUPPORTED_PACKAGES.put("vn.com.techcombank.bb.app", "Techcombank");
        SUPPORTED_PACKAGES.put("com.vnpay.bidv", "BIDV");
        SUPPORTED_PACKAGES.put("com.vietinbank.ipay", "VietinBank");
        SUPPORTED_PACKAGES.put("mobile.acb.com.vn", "ACB");
        SUPPORTED_PACKAGES.put("com.vnpay.vpbankonline", "VPBank");
        SUPPORTED_PACKAGES.put("com.tpb.mb.gprsandroid", "TPBank");
        SUPPORTED_PACKAGES.put("vn.timo.app", "Timo");
        SUPPORTED_PACKAGES.put("io.lifestyle.plus", "Timo");
        SUPPORTED_PACKAGES.put("xyz.be.cake", "Cake");
        SUPPORTED_PACKAGES.put("com.ocb.omni.app", "OCB");
        SUPPORTED_PACKAGES.put("com.vnpay.Agribank3g", "Agribank");
        SUPPORTED_PACKAGES.put("com.vnpay.agribank", "Agribank");
        SUPPORTED_PACKAGES.put("com.sacombank.ewallet", "Sacombank");
        SUPPORTED_PACKAGES.put("src.com.sacombank", "Sacombank");
        SUPPORTED_PACKAGES.put("com.shb.mbanking", "SHB");
        SUPPORTED_PACKAGES.put("com.hdbank.mobilebanking", "HDBank");
        SUPPORTED_PACKAGES.put("vn.com.seabank.mb1", "SeABank");
        SUPPORTED_PACKAGES.put("com.vib.myvib2", "VIB");
        SUPPORTED_PACKAGES.put("com.lpbank.lv24h", "LPBank");

        // Ví điện tử
        SUPPORTED_PACKAGES.put("com.mservice.momotransfer", "MoMo");
        SUPPORTED_PACKAGES.put("vn.com.vng.zalopay", "ZaloPay");
        SUPPORTED_PACKAGES.put("com.bplus.vtpay", "Viettel Money");
        SUPPORTED_PACKAGES.put("com.vnpay.wallet", "VNPay");
        SUPPORTED_PACKAGES.put("com.airpay.vn", "ShopeePay");
    }

    public static final String KEY_RAW_LOG = "raw_system_notifications_log";

    public static BankNotificationListenerService currentServiceInstance = null;

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        currentServiceInstance = this;
        scanActiveNotifications();
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        currentServiceInstance = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                requestRebind(new ComponentName(this, BankNotificationListenerService.class));
            } catch (Exception ignored) {
            }
        }
    }

    public void scanActiveNotifications() {
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification sbn : active) {
                    processNotification(sbn);
                }
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        processNotification(sbn);
    }

    private void processNotification(StatusBarNotification sbn) {
        if (sbn == null) return;
        try {
            String pkg = sbn.getPackageName();
            if (pkg == null) return;

            Notification notification = sbn.getNotification();
            if (notification == null || notification.extras == null) return;

            Bundle extras = notification.extras;
            CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            CharSequence subTextCs = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);

            StringBuilder bodyBuilder = new StringBuilder();
            if (bigTextCs != null && bigTextCs.length() > 0) {
                bodyBuilder.append(bigTextCs.toString().trim());
            } else if (textCs != null && textCs.length() > 0) {
                bodyBuilder.append(textCs.toString().trim());
            }
            if (lines != null && lines.length > 0) {
                for (CharSequence line : lines) {
                    if (line != null && line.length() > 0) {
                        if (bodyBuilder.length() > 0) bodyBuilder.append(" ");
                        bodyBuilder.append(line.toString().trim());
                    }
                }
            }
            if (subTextCs != null && subTextCs.length() > 0) {
                if (bodyBuilder.length() > 0) bodyBuilder.append(" ");
                bodyBuilder.append(subTextCs.toString().trim());
            }

            String body = bodyBuilder.toString().trim();
            String title = titleCs != null ? titleCs.toString().trim() : "";

            if (body.isEmpty() && !title.isEmpty()) {
                body = title;
            }
            if (body.isEmpty()) return;

            String appName = SUPPORTED_PACKAGES.get(pkg);
            if (appName == null) {
                String lowerPkg = pkg.toLowerCase();
                String upperFull = (title + " " + body).toUpperCase();

                // 1. Khớp theo tên gói ứng dụng ngân hàng / ví
                if (lowerPkg.contains("momo")) appName = "MoMo";
                else if (lowerPkg.contains("zalopay")) appName = "ZaloPay";
                else if (lowerPkg.contains("vcb") || lowerPkg.contains("vietcombank")) appName = "Vietcombank";
                else if (lowerPkg.contains("mbmobile") || lowerPkg.contains("mbbank")) appName = "MB Bank";
                else if (lowerPkg.contains("techcombank")) appName = "Techcombank";
                else if (lowerPkg.contains("vietinbank") || lowerPkg.contains("ipay")) appName = "VietinBank";
                else if (lowerPkg.contains("bidv")) appName = "BIDV";
                else if (lowerPkg.contains("vpbank")) appName = "VPBank";
                else if (lowerPkg.contains("tpb")) appName = "TPBank";
                else if (lowerPkg.contains("acb")) appName = "ACB";
                else if (lowerPkg.contains("agribank")) appName = "Agribank";
                else if (lowerPkg.contains("sacombank")) appName = "Sacombank";
                else if (lowerPkg.contains("vib")) appName = "VIB";
                else if (lowerPkg.contains("shb")) appName = "SHB";
                else if (lowerPkg.contains("hdbank")) appName = "HDBank";
                else if (lowerPkg.contains("seabank")) appName = "SeABank";
                else if (lowerPkg.contains("ocb")) appName = "OCB";
                else if (lowerPkg.contains("cake")) appName = "Cake";
                else if (lowerPkg.contains("timo") || lowerPkg.contains("lifestyle")) appName = "Timo";
                else if (lowerPkg.contains("vtpay") || lowerPkg.contains("viettelmoney")) appName = "Viettel Money";

                // 2. Nhận diện từ nội dung (SMS Banking hoặc ứng dụng tài chính khác)
                else if (upperFull.contains("MBBANK") || upperFull.contains("MB BANK")) appName = "MB Bank";
                else if (upperFull.contains("VIETCOMBANK") || upperFull.contains("VCB")) appName = "Vietcombank";
                else if (upperFull.contains("TECHCOMBANK") || upperFull.contains("TCB")) appName = "Techcombank";
                else if (upperFull.contains("BIDV")) appName = "BIDV";
                else if (upperFull.contains("VIETINBANK") || upperFull.contains("CTG")) appName = "VietinBank";
                else if (upperFull.contains("ACB")) appName = "ACB";
                else if (upperFull.contains("TPBANK") || upperFull.contains("TPB")) appName = "TPBank";
                else if (upperFull.contains("VPBANK") || upperFull.contains("VPB")) appName = "VPBank";
                else if (upperFull.contains("AGRIBANK")) appName = "Agribank";
                else if (upperFull.contains("SACOMBANK")) appName = "Sacombank";
                else if (upperFull.contains("VIB")) appName = "VIB";
                else if (upperFull.contains("MOMO")) appName = "MoMo";
                else if (upperFull.contains("ZALOPAY")) appName = "ZaloPay";
                else if (upperFull.contains("TIMO")) appName = "Timo";
                else if (upperFull.contains("CAKE")) appName = "Cake";
                else if (upperFull.contains("VIETTEL MONEY") || upperFull.contains("VIETTELPAY")) appName = "Viettel Money";
                else if (upperFull.contains("BIẾN ĐỘNG SỐ DƯ") || upperFull.contains("BIEN DONG SO DU") || upperFull.contains("SỐ DƯ TK") || upperFull.contains("SO DU TK") || upperFull.contains("GD: +") || upperFull.contains("GD: -") || upperFull.contains("NHẬN ĐƯỢC") || upperFull.contains("CHUYỂN TIỀN") || upperFull.contains("THANH TOÁN") || upperFull.contains("TIỀN VỀ") || upperFull.contains("CỘNG TIỀN") || upperFull.contains("TRỪ TIỀN") || upperFull.contains("GIAO DỊCH THÀNH CÔNG") || upperFull.contains("NHẬN TIỀN")) {
                    appName = "Ví / Ngân hàng";
                }

                appendRawLog(pkg, title, body, appName != null, appName != null ? appName : "Bỏ qua");

                if (appName == null) {
                    return; // Bỏ qua nếu không phải ngân hàng/ví
                }
            } else {
                appendRawLog(pkg, title, body, true, appName);
            }

            long postTime = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String rawJson = prefs.getString(KEY_PENDING_LIST, "[]");
            JSONArray arr = new JSONArray(rawJson);

            // Chống trùng lặp nếu cùng nội dung nổ lại trong vòng 90 giây
            for (int i = 0; i < arr.length(); i++) {
                JSONObject existing = arr.optJSONObject(i);
                if (existing != null) {
                    String existingBody = existing.optString("text", "");
                    long existingTime = existing.optLong("timestamp", 0);
                    if (existingBody.equals(body) && Math.abs(postTime - existingTime) < 90000) {
                        return;
                    }
                }
            }

            JSONObject item = new JSONObject();
            item.put("id", "notif-" + postTime + "-" + Math.abs(body.hashCode()));
            item.put("packageName", pkg);
            item.put("appName", appName);
            item.put("title", title);
            item.put("text", body);
            item.put("timestamp", postTime);

            arr.put(item);

            // Giữ tối đa 100 thông báo gần nhất trong hàng đợi
            if (arr.length() > 100) {
                JSONArray trimmed = new JSONArray();
                for (int i = arr.length() - 100; i < arr.length(); i++) {
                    trimmed.put(arr.get(i));
                }
                arr = trimmed;
            }

            prefs.edit().putString(KEY_PENDING_LIST, arr.toString()).apply();

            // Báo ngay cho giao diện WebView nếu ứng dụng đang mở
            MainActivity.notifyBankNotificationReceived();
        } catch (Exception ignored) {
        }
    }

    private void appendRawLog(String pkg, String title, String text, boolean accepted, String matchedApp) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_RAW_LOG, "[]");
            JSONArray arr = new JSONArray(raw);
            JSONObject item = new JSONObject();
            item.put("timestamp", System.currentTimeMillis());
            item.put("pkg", pkg != null ? pkg : "");
            item.put("title", title != null ? title : "");
            item.put("text", text != null ? text : "");
            item.put("accepted", accepted);
            item.put("matchedApp", matchedApp != null ? matchedApp : "");
            arr.put(item);
            if (arr.length() > 30) {
                JSONArray trimmed = new JSONArray();
                for (int i = arr.length() - 30; i < arr.length(); i++) {
                    trimmed.put(arr.get(i));
                }
                arr = trimmed;
            }
            prefs.edit().putString(KEY_RAW_LOG, arr.toString()).apply();
        } catch (Exception ignored) {
        }
    }
}
