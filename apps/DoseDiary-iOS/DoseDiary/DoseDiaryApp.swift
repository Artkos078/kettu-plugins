import SwiftUI

@main
struct DoseDiaryApp: App {
    @StateObject private var store = DoseStore()
    @StateObject private var appLock = AppLock()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            Group {
                if store.faceIDEnabled && !appLock.isUnlocked {
                    LockView(appLock: appLock)
                } else {
                    ContentView()
                        .environmentObject(store)
                }
            }
            .onAppear {
                if !store.faceIDEnabled { appLock.isUnlocked = true }
                else { appLock.unlock() }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active && store.faceIDEnabled { appLock.lock() }
                if phase == .active && store.faceIDEnabled && !appLock.isUnlocked { appLock.unlock() }
            }
            .onChange(of: store.faceIDEnabled) { _, enabled in
                appLock.isUnlocked = !enabled
                if enabled { appLock.unlock() }
            }
        }
    }
}

private struct LockView: View {
    @ObservedObject var appLock: AppLock

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 52))
                .foregroundStyle(.indigo)
            Text("Dose Diary").font(.largeTitle.bold())
            Text("Your history is locked").foregroundStyle(.secondary)
            Button("Unlock") { appLock.unlock() }
                .buttonStyle(.borderedProminent)
            if !appLock.errorMessage.isEmpty {
                Text(appLock.errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
        }
    }
}

