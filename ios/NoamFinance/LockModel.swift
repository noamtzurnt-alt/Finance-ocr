import Foundation
import LocalAuthentication

/// Local unlock only. The Vercel session cookie remains the server credential.
@MainActor
final class LockModel: ObservableObject {
    enum Phase: Equatable {
        case locked
        case authenticating
        case unlocked
    }

    @Published private(set) var phase: Phase = .locked
    @Published private(set) var message: String?
    @Published private(set) var needsManualRetry = false
    @Published private(set) var passcodeFallback = false
    @Published private(set) var coverForSwitcher = false
    @Published private(set) var webReady = false
    @Published private(set) var webFailed = false
    @Published private(set) var reloadToken = 0

    private var leftBackground = false
    private var context: LAContext?
    private var attemptID: UUID?

    var showsWeb: Bool { phase == .unlocked && !coverForSwitcher }
    var showsLoading: Bool { phase == .unlocked && !webReady && !webFailed && !coverForSwitcher }

    func sceneBecameInactive() {
        // The Face ID sheet itself moves the scene to inactive. Do not lock or prompt from here.
        if phase == .authenticating { return }
        coverForSwitcher = true
    }

    func sceneEnteredBackground() {
        leftBackground = true
        coverForSwitcher = true
        context?.invalidate()
        context = nil
        attemptID = nil
        phase = .locked
        needsManualRetry = false
        passcodeFallback = false
        message = nil
    }

    func sceneBecameActive() {
        coverForSwitcher = false
        let resume = leftBackground
        leftBackground = false
        if resume {
            phase = .locked
            needsManualRetry = false
            passcodeFallback = false
            message = nil
        }
        guard phase == .locked, !needsManualRetry else { return }
        beginAuthentication(policy: .deviceOwnerAuthenticationWithBiometrics)
    }

    func retry() {
        guard phase == .locked else { return }
        let policy: LAPolicy = passcodeFallback
            ? .deviceOwnerAuthentication
            : .deviceOwnerAuthenticationWithBiometrics
        beginAuthentication(policy: policy)
    }

    func webDidFinish() {
        webReady = true
        webFailed = false
    }

    func webDidFail() {
        webFailed = true
    }

    func reloadWeb() {
        webFailed = false
        webReady = false
        reloadToken += 1
    }

    private func beginAuthentication(policy: LAPolicy) {
        guard phase != .authenticating else { return }
        let context = LAContext()
        context.localizedCancelTitle = "ביטול"
        if policy == .deviceOwnerAuthenticationWithBiometrics {
            context.localizedFallbackTitle = ""
        }
        let attempt = UUID()
        self.context = context
        self.attemptID = attempt
        phase = .authenticating
        needsManualRetry = false
        message = nil

        var error: NSError?
        guard context.canEvaluatePolicy(policy, error: &error) else {
            finish(success: false, error: error, attempt: attempt, attempted: policy)
            return
        }

        let name = (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String) ?? "האפליקציה"
        let reason = policy == .deviceOwnerAuthentication
            ? "פתח את \(name) עם קוד המכשיר"
            : "פתח את \(name)"
        context.evaluatePolicy(policy, localizedReason: reason) { [weak self] success, evalError in
            let failure = evalError
            Task { @MainActor in
                self?.finish(success: success, error: failure, attempt: attempt, attempted: policy)
            }
        }
    }

    private func finish(success: Bool, error: Error?, attempt: UUID, attempted: LAPolicy) {
        guard attemptID == attempt else { return }
        attemptID = nil
        context = nil
        if success {
            phase = .unlocked
            needsManualRetry = false
            passcodeFallback = false
            message = nil
            return
        }
        phase = .locked
        needsManualRetry = true
        passcodeFallback = Self.shouldOfferPasscode(error, attempted: attempted)
        message = Self.describe(error)
    }

    private static func shouldOfferPasscode(_ error: Error?, attempted: LAPolicy) -> Bool {
        guard attempted == .deviceOwnerAuthenticationWithBiometrics else { return false }
        switch (error as? LAError)?.code {
        case .biometryNotAvailable, .biometryNotEnrolled, .biometryLockout:
            return true
        default:
            return false
        }
    }

    private static func describe(_ error: Error?) -> String {
        switch (error as? LAError)?.code {
        case .userCancel, .appCancel, .systemCancel:
            return "האימות בוטל"
        case .biometryLockout:
            return "Face ID ננעל זמנית"
        case .biometryNotAvailable:
            return "Face ID לא זמין במכשיר הזה"
        case .biometryNotEnrolled:
            return "לא הוגדר Face ID במכשיר"
        default:
            return "האימות נכשל"
        }
    }
}
