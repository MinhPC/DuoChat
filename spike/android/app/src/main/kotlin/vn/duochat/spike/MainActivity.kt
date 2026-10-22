package vn.duochat.spike

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

/**
 * Spike Android (CLAUDE.md mục 3.3). Mọi kết quả ghi ra logcat, tag DUOSPIKE, mỗi dòng một JSON.
 *
 * Chạy: adb shell am start -n vn.duochat.spike/.MainActivity --es mode <mode> [--es ua <ua>]
 *  - info          : phiên bản WebView, MULTI_PROFILE có được hỗ trợ không
 *  - write [--ez flush true] : mỗi profile ghi localStorage + cookie (cùng key, khác giá trị) rồi đọc lại chéo;
 *                  flush=true thì gọi CookieManager.flush() của từng profile sau khi ghi
 *  - read          : chỉ đọc lại (chạy sau khi kill app để kiểm tra còn phiên)
 *  - ua  --es ua X : tải chat.zalo.me với UA X (default | chrome-mobile | desktop) và ghi lại trang nhận được
 */
class MainActivity : Activity() {
    private val tag = "DUOSPIKE"
    private val ui = Handler(Looper.getMainLooper())

    private fun log(kind: String, vararg pairs: Pair<String, Any?>) {
        val o = JSONObject()
        o.put("kind", kind)
        for ((k, v) in pairs) o.put(k, v ?: JSONObject.NULL)
        Log.i(tag, o.toString())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val mode = intent.getStringExtra("mode") ?: "info"
        val webViewPkg = WebViewCompat.getCurrentWebViewPackage(this)
        val multiProfile = WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)
        log(
            "info",
            "sdk" to Build.VERSION.SDK_INT,
            "device" to "${Build.MANUFACTURER} ${Build.MODEL}",
            "webviewPackage" to webViewPkg?.packageName,
            "webviewVersion" to webViewPkg?.versionName,
            "multiProfileSupported" to multiProfile,
        )
        when (mode) {
            "info" -> log("done", "mode" to mode)
            "write", "read" -> runProfileTest(mode, multiProfile)
            "ua" -> runUaTest(intent.getStringExtra("ua") ?: "default", webViewPkg?.versionName)
            else -> log("error", "message" to "mode không hợp lệ: $mode")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun newWebView(profile: String?): WebView {
        val wv = WebView(this)
        if (profile != null) {
            // Phải gọi trước khi WebView tải bất cứ thứ gì.
            ProfileStore.getInstance().getOrCreateProfile(profile)
            WebViewCompat.setProfile(wv, profile)
        }
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.webViewClient = WebViewClient()
        return wv
    }

    private fun layoutViews(vararg views: WebView) {
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        for (v in views) root.addView(v, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
    }

    private fun js(wv: WebView, script: String, then: (String) -> Unit) {
        wv.evaluateJavascript(script) { then(it ?: "null") }
    }

    // ------------------------------------------------------------------ profile

    private fun runProfileTest(mode: String, multiProfile: Boolean) {
        if (!multiProfile) {
            log("error", "message" to "MULTI_PROFILE không được hỗ trợ, cần thử hướng (b) multi-process")
            return
        }
        val doFlush = intent.getBooleanExtra("flush", false)
        val names = listOf("acc_a", "acc_b")
        val views = names.map { newWebView(it) } + newWebView(null) // view thứ 3: profile mặc định
        layoutViews(*views.toTypedArray())
        log("profiles", "all" to ProfileStore.getInstance().allProfileNames)

        views.forEach { it.loadUrl("https://id.zalo.me/") }
        // Chờ trang ổn định (chuyển hướng) rồi chạy.
        ui.postDelayed({
            val labels = listOf("A", "B", "DEFAULT")
            var pending = views.size
            views.forEachIndexed { i, wv ->
                val label = labels[i]
                val write = if (mode == "write" && i < names.size) {
                    "localStorage.setItem('duo_shared','$label');localStorage.setItem('duo_only_$label','1');" +
                        "document.cookie='duo_shared=$label; max-age=86400; path=/';"
                } else {
                    ""
                }
                val read = "JSON.stringify({origin:location.origin,ls_shared:localStorage.getItem('duo_shared')," +
                    "ls_only_A:localStorage.getItem('duo_only_A'),ls_only_B:localStorage.getItem('duo_only_B')," +
                    "cookie_shared:(document.cookie.match(/duo_shared=([^;]*)/)||[])[1]||null})"
                js(wv, "(function(){$write return $read})()") { raw ->
                    log("profileRead", "mode" to mode, "flush" to doFlush, "view" to label, "profile" to names.getOrNull(i), "result" to raw)
                    // Tên cookie (không ghi giá trị) theo CookieManager của profile.
                    val profile = names.getOrNull(i)?.let { ProfileStore.getInstance().getProfile(it) }
                    if (doFlush) profile?.cookieManager?.flush()
                    val cookieNames = profile?.cookieManager?.getCookie("https://id.zalo.me/")
                        ?.split(";")?.map { it.trim().substringBefore("=") }
                    log("profileCookies", "view" to label, "names" to cookieNames?.joinToString(","))
                    if (--pending == 0) log("done", "mode" to mode)
                }
            }
        }, 9000)
    }

    // ------------------------------------------------------------------ UA

    private fun runUaTest(ua: String, webViewVersion: String?) {
        val wv = newWebView("acc_ua_$ua")
        val defaultUa = wv.settings.userAgentString
        val chromeVer = webViewVersion ?: "130.0.0.0"
        val chosen = when (ua) {
            "chrome-mobile" -> defaultUa.replace("; wv", "").replace(Regex("Version/\\d+\\.\\d+ "), "")
            "desktop" ->
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/$chromeVer Safari/537.36"
            else -> defaultUa
        }
        wv.settings.userAgentString = chosen
        if (ua == "desktop") {
            wv.settings.useWideViewPort = true
            wv.settings.loadWithOverviewMode = true
        }
        layoutViews(wv)
        log("uaTest", "ua" to ua, "userAgent" to chosen)
        wv.loadUrl("https://chat.zalo.me/")
        ui.postDelayed({
            val dump = "JSON.stringify({href:location.href,title:document.title,innerWidth:innerWidth," +
                "innerHeight:innerHeight,dpr:devicePixelRatio,canvas:document.querySelectorAll('canvas').length," +
                "text:(document.body?document.body.innerText:'').replace(/\\s+/g,' ').slice(0,500)})"
            js(wv, dump) { raw ->
                log("uaResult", "ua" to ua, "result" to raw)
                log("done", "mode" to "ua")
            }
        }, 12000)
    }
}
