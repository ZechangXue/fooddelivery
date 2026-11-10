import UIKit
import WebKit
import CoreLocation
import SafariServices

final class DeliveryController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, CLLocationManagerDelegate {
    private var web: WKWebView!
    private let location = CLLocationManager()
    private let status = UILabel()
    private var tracking = false
    private var popup: WKWebView?

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "步送"
        view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "返回", style: .plain, target: self, action: #selector(back))
        navigationItem.rightBarButtonItems = [UIBarButtonItem(title: "刷新", style: .plain, target: self, action: #selector(reload)), UIBarButtonItem(title: "帮助", style: .plain, target: self, action: #selector(help))]
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.userContentController.add(self, name: "deliveryNative")
        if let path = Bundle.main.url(forResource: "bridge", withExtension: "js"), let js = try? String(contentsOf: path) {
            config.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        status.numberOfLines = 0
        status.textAlignment = .center
        status.font = .preferredFont(forTextStyle: .footnote)
        status.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(status)
        NSLayoutConstraint.activate([
            status.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), status.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12), status.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            web.topAnchor.constraint(equalTo: status.bottomAnchor), web.leadingAnchor.constraint(equalTo: view.leadingAnchor), web.trailingAnchor.constraint(equalTo: view.trailingAnchor), web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        location.delegate = self
        location.desiredAccuracy = kCLLocationAccuracyBest
        location.distanceFilter = 3
        location.activityType = .fitness
        location.pausesLocationUpdatesAutomatically = false
        NotificationCenter.default.addObserver(self, selector: #selector(background), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(foreground), name: UIApplication.didBecomeActiveNotification, object: nil)
        web.load(URLRequest(url: AppPolicy.home))
    }
    @objc private func back() { if let popup { popup.removeFromSuperview(); self.popup = nil } else if web.canGoBack { web.goBack() } }
    @objc private func reload() {
        let alert = UIAlertController(title: "刷新页面？", message: "请确认已保存当前配送单，刷新会丢失未保存内容。", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        alert.addAction(UIAlertAction(title: "刷新", style: .default) { _ in self.web.reload() })
        present(alert, animated: true)
    }
    @objc private func help() {
        let alert = UIAlertController(title: "步送 iOS", message: "与网页共用同一个账户及云端数据。首次请登录原来的账户。配送时保持本应用在前台；锁屏或切换应用会暂停实时同步。\n\n请勿在有未保存修改时刷新。若第三方登录不支持内嵌浏览器，请使用邮箱登录，或先用 Safari 中的原网页继续配送。", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "打开 Safari 网页", style: .default) { _ in UIApplication.shared.open(AppPolicy.home) })
        alert.addAction(UIAlertAction(title: "关闭", style: .cancel))
        present(alert, animated: true)
    }
    @objc private func background() { location.stopUpdatingLocation(); UIApplication.shared.isIdleTimerDisabled = false }
    @objc private func foreground() { if tracking { location.startUpdatingLocation(); UIApplication.shared.isIdleTimerDisabled = true } }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, AppPolicy.isTrusted(message.frameInfo.request.url), AppPolicy.isTrusted(web.url), let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "startLocation":
            tracking = true
            if location.authorizationStatus == .notDetermined { location.requestWhenInUseAuthorization() } else { locationManagerDidChangeAuthorization(location) }
        case "stopLocation": tracking = false; location.stopUpdatingLocation(); UIApplication.shared.isIdleTimerDisabled = false
        case "copy":
            if let text = body["text"] as? String, text.count < 100000 { UIPasteboard.general.string = text; emit(["type":"copied", "id":body["id"] ?? 0]) }
        default: break
        }
    }
    private func emit(_ payload: [String:Any]) {
        guard AppPolicy.isTrusted(web.url), let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.__deliveryNativeReceive && window.__deliveryNativeReceive(\(json))", completionHandler: nil)
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard tracking else { return }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: manager.startUpdatingLocation(); UIApplication.shared.isIdleTimerDisabled = true
        case .denied, .restricted: emit(["type":"locationError", "code":1, "message":"定位权限未开启，请在 iOS 设置中允许步送使用位置"])
        default: break
        }
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard tracking, let fix = locations.last, fix.horizontalAccuracy >= 0 else { return }
        emit(["type":"position", "coords":["latitude":fix.coordinate.latitude,"longitude":fix.coordinate.longitude,"accuracy":fix.horizontalAccuracy,"altitude":fix.altitude,"altitudeAccuracy":fix.verticalAccuracy,"heading":fix.course >= 0 ? fix.course as Any : NSNull(),"speed":fix.speed >= 0 ? fix.speed as Any : NSNull()],"timestamp":fix.timestamp.timeIntervalSince1970 * 1000])
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { emit(["type":"locationError","code":2,"message":error.localizedDescription]) }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { status.text = "正在加载…" }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { status.text = nil; if !AppPolicy.isTrusted(webView.url) { location.stopUpdatingLocation(); UIApplication.shared.isIdleTimerDisabled = false } }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { if (error as NSError).code != NSURLErrorCancelled { status.text = "加载失败：\(error.localizedDescription)；请检查网络后点刷新。" } }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { status.text = "页面进程已暂停，请点刷新。未保存内容可能丢失。" }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if AppPolicy.externalScheme(url) { UIApplication.shared.open(url); decisionHandler(.cancel); return }
        decisionHandler(["https", "about"].contains(url.scheme ?? "") ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let child = WKWebView(frame: view.bounds, configuration: configuration)
        child.navigationDelegate = self; child.uiDelegate = self
        child.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        view.addSubview(child); popup = child
        return child
    }
    func webViewDidClose(_ webView: WKWebView) { webView.removeFromSuperview(); popup = nil }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "步送", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in completionHandler() }); present(alert, animated: true)
    }
}
