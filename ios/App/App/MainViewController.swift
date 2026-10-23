import UIKit
import Capacitor
import WebKit

/// Capacitor bridge view controller that restores the saved login cookies into
/// the WebView's cookie store **before** the first page load, so the Supabase
/// session is present on the very first request after an app restart.
///
/// Capacitor mirrors every cookie change into the persistent
/// `HTTPCookieStorage.shared` (see `CapacitorWKCookieObserver`, registered
/// unconditionally in `CAPBridgeViewController`) but never copies them back on
/// launch. We do that missing restore here, writing into
/// `WKWebsiteDataStore.default()` — the store the Capacitor WebView uses — so we
/// don't depend on `self.webView` having been assigned yet.
///
/// `CAPBridgeViewController.viewDidLoad()` calls `loadWebView()` immediately, so
/// on the restore path we override it to inject the cookies first and trigger
/// the load only once every (async) `setCookie` has completed. `loadWebView()`
/// is Capacitor's `public final` entry point — it is what `super.viewDidLoad()`
/// itself calls — and we invoke it directly because Swift does not allow a
/// `super` call inside the escaping completion closure.
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        let persisted = HTTPCookieStorage.shared.cookies ?? []
        guard !persisted.isEmpty else {
            // Nothing to restore (first launch / logged out) — load normally.
            super.viewDidLoad()
            return
        }

        let cookieStore = WKWebsiteDataStore.default().httpCookieStore
        let group = DispatchGroup()
        for cookie in persisted {
            group.enter()
            cookieStore.setCookie(cookie) { group.leave() }
        }
        group.notify(queue: .main) { [weak self] in
            self?.loadWebView()
        }
    }
}
