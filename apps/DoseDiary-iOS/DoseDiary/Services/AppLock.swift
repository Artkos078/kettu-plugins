import LocalAuthentication
import SwiftUI

@MainActor
final class AppLock: ObservableObject {
    @Published var isUnlocked = false
    @Published var errorMessage = ""

    func lock() {
        isUnlocked = false
    }

    func unlock() {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            errorMessage = "Face ID or a device passcode is not available."
            return
        }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Open your private dose diary") { success, evaluationError in
            Task { @MainActor in
                self.isUnlocked = success
                self.errorMessage = success ? "" : (evaluationError?.localizedDescription ?? "Authentication failed.")
            }
        }
    }
}

