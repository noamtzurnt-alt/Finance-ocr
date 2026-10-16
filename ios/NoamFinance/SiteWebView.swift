import SwiftUI
import WebKit

struct SiteWebView: UIViewRepresentable {
    let startURL: URL
    let allowedHost: String
    let interactive: Bool
    let reloadToken: Int
    let onReady: () -> Void
    let onFailure: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(allowedHost: allowedHost, onReady: onReady, onFailure: onFailure)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let marker = WKUserScript(
            source: "document.documentElement.dataset.nfNative='1'",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(marker)
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = Coordinator.pageColor
        webView.underPageBackgroundColor = Coordinator.pageColor
        webView.scrollView.backgroundColor = Coordinator.pageColor
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.attach(webView)
        webView.load(URLRequest(url: startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        webView.isUserInteractionEnabled = interactive
        context.coordinator.interactive = interactive
        context.coordinator.onReady = onReady
        context.coordinator.onFailure = onFailure
        context.coordinator.reloadIfNeeded(webView, token: reloadToken)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        static let pageColor = UIColor(red: 11 / 255, green: 11 / 255, blue: 11 / 255, alpha: 1)

        let allowedHost: String
        var interactive: Bool
        var onReady: () -> Void
        var onFailure: () -> Void
        private var reportedReady = false
        private var sawReloadToken = 0
        private weak var webView: WKWebView?

        init(allowedHost: String, onReady: @escaping () -> Void, onFailure: @escaping () -> Void) {
            self.allowedHost = allowedHost
            self.interactive = false
            self.onReady = onReady
            self.onFailure = onFailure
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func reloadIfNeeded(_ webView: WKWebView, token: Int) {
            guard token != sawReloadToken else { return }
            sawReloadToken = token
            guard token > 0 else { return }
            reportedReady = false
            webView.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard !reportedReady else { return }
            reportedReady = true
            onReady()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code == NSURLErrorCancelled { return }
            onFailure()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code == NSURLErrorCancelled { return }
            onFailure()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            switch classify(url) {
            case .allow:
                decisionHandler(.allow)
            case .external:
                if interactive {
                    UIApplication.shared.open(url)
                }
                decisionHandler(.cancel)
            case .cancel:
                decisionHandler(.cancel)
            }
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard let url = navigationAction.request.url else { return nil }
            switch classify(url) {
            case .allow:
                webView.load(URLRequest(url: url))
            case .external where interactive:
                UIApplication.shared.open(url)
            case .external, .cancel:
                break
            }
            return nil
        }

        private enum Destination {
            case allow
            case external
            case cancel
        }

        private func classify(_ url: URL) -> Destination {
            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "about" || scheme == "blob" || scheme == "data" { return .allow }
            guard scheme == "https", url.host?.lowercased() == allowedHost else {
                return scheme.isEmpty ? .cancel : .external
            }
            return .allow
        }
    }
}
