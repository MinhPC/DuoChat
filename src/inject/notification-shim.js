// Shim thông báo (CLAUDE.md mục 4). Chạy trong main world của trang qua webContents.executeJavaScript
// ở sự kiện dom-ready. Idempotent và bọc try/catch để không bao giờ làm hỏng trang.
// Chỉ làm một việc: chuyển `new Notification(...)` thành lời gọi cầu nối `window.__duochat.notify`.
;(() => {
  try {
    if (window.__duochatShimInstalled) return
    var bridge = window.__duochat
    if (!bridge || typeof bridge.notify !== 'function') return

    function send(title, options) {
      try {
        var o = options || {}
        bridge.notify({
          title: String(title),
          body: o.body == null ? '' : String(o.body),
          icon: o.icon == null ? '' : String(o.icon),
          tag: o.tag == null ? '' : String(o.tag),
        })
      } catch (e) {
        /* nuốt lỗi: không để trang biết */
      }
    }

    class DuoNotification extends EventTarget {
      constructor(title, options) {
        super()
        var o = options || {}
        this.title = String(title)
        this.body = o.body == null ? '' : String(o.body)
        this.icon = o.icon == null ? '' : String(o.icon)
        this.tag = o.tag == null ? '' : String(o.tag)
        this.data = o.data
        this.onclick = null
        this.onclose = null
        this.onerror = null
        this.onshow = null
        send(title, o)
        var self = this
        setTimeout(function () {
          try {
            var ev = new Event('show')
            self.dispatchEvent(ev)
            if (typeof self.onshow === 'function') self.onshow(ev)
          } catch (e) {
            /* bỏ qua */
          }
        }, 0)
      }
      close() {}
      static get permission() {
        return 'granted'
      }
      static requestPermission(cb) {
        if (typeof cb === 'function') {
          try {
            cb('granted')
          } catch (e) {
            /* bỏ qua */
          }
        }
        return Promise.resolve('granted')
      }
      static get maxActions() {
        return 0
      }
    }

    Object.defineProperty(window, 'Notification', {
      value: DuoNotification,
      configurable: true,
      writable: true,
    })

    // Trang dùng Service Worker để hiện thông báo thì cũng đi qua cầu nối.
    if (window.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype) {
      Object.defineProperty(ServiceWorkerRegistration.prototype, 'showNotification', {
        value: function (title, options) {
          send(title, options)
          return Promise.resolve()
        },
        configurable: true,
        writable: true,
      })
    }

    Object.defineProperty(window, '__duochatShimInstalled', { value: true })
  } catch (e) {
    /* bỏ qua */
  }
})()
