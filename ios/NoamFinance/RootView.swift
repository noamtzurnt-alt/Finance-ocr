import SwiftUI

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var lock = LockModel()

    var body: some View {
        ZStack {
            Color.launch.ignoresSafeArea()
            switch AppConfig.load() {
            case .invalid(let message):
                configError(message)
            case .ready(let site):
                SiteWebView(
                    startURL: site.startURL,
                    allowedHost: site.host,
                    interactive: lock.showsWeb,
                    reloadToken: lock.reloadToken,
                    onReady: { lock.webDidFinish() },
                    onFailure: { lock.webDidFail() }
                )
                .opacity(lock.showsWeb && lock.webReady ? 1 : 0)
                .privacySensitive()
                .ignoresSafeArea()
                if !lock.showsWeb {
                    lockScreen
                } else if lock.webFailed {
                    webFailure
                } else if lock.showsLoading {
                    loading
                }
            }
        }
        .tint(Color.brand)
        .preferredColorScheme(.dark)
        .environment(\.layoutDirection, .rightToLeft)
        .onAppear {
            guard case .ready = AppConfig.load(), scenePhase == .active else { return }
            lock.sceneBecameActive()
        }
        .onChange(of: scenePhase) { _, phase in
            guard case .ready = AppConfig.load() else { return }
            switch phase {
            case .active:
                lock.sceneBecameActive()
            case .inactive:
                lock.sceneBecameInactive()
            case .background:
                lock.sceneEnteredBackground()
            @unknown default:
                break
            }
        }
    }

    /// Matches the launch screen (plain black) so there is no visible splash jump before Face ID.
    private var lockScreen: some View {
        VStack(spacing: 20) {
            Image(systemName: "faceid")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.brand)
                .opacity(lock.needsManualRetry ? 1 : 0.55)
            if let message = lock.message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            if lock.needsManualRetry {
                Button(lock.passcodeFallback ? "פתח עם קוד המכשיר" : "נסה שוב") {
                    lock.retry()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.launch)
    }

    private var loading: some View {
        ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.launch)
    }

    private var webFailure: some View {
        VStack(spacing: 16) {
            Text("אין חיבור לאתר")
                .font(.headline)
            Button("נסה שוב") { lock.reloadWeb() }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.launch)
    }

    private func configError(_ message: String) -> some View {
        Text(message)
            .font(.subheadline)
            .multilineTextAlignment(.center)
            .padding(24)
    }
}

private extension Color {
    static let launch = Color(red: 11 / 255, green: 11 / 255, blue: 11 / 255)
    static let brand = Color(red: 0, green: 210 / 255, blue: 106 / 255)
}
