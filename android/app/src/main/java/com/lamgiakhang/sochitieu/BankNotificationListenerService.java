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

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                requestRebind(new ComponentName(this, BankNotificationListenerService.class));
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        try {
            String pkg = sbn.getPackageName();
            if (pkg == null) return;

            String appName = SUPPORTED_PACKAGES.get(pkg);
            // Hỗ trợ thêm trường hợp tên package chứa từ khóa ngân hàng/ví nhưng chưa có trong map cứng
            if (appName == null) {
                String lowerPkg = pkg.toLowerCase();
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
                else return; // Bỏ qua ngay lập tức mọi thông báo cá nhân (Zalo, Messenger, Facebook...)
            }

            Notification notification = sbn.getNotification();
            if (notification == null || notification.extras == null) return;

            Bundle extras = notification.extras;
            CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

            String title = titleCs != null ? titleCs.toString().trim() : "";
            String body = (bigTextCs != null && bigTextCs.length() > 0)
                    ? bigTextCs.toString().trim()
                    : (textCs != null ? textCs.toString().trim() : "");

            if (body.isEmpty()) return;

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
}
