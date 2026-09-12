import SwiftUI
import UIKit

struct SettingsView: View {
    @EnvironmentObject private var store: DoseStore
    @State private var exportFile: ExportFile?
    @State private var exportError = ""

    var body: some View {
        Form {
            Section("Privacy") {
                Toggle("Require Face ID or passcode", isOn: $store.faceIDEnabled)
                Text("Dose history is stored only inside the app using iOS complete file protection.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("Backup and export") {
                Button("Export JSON backup") { prepare(.json) }
                Button("Export CSV") { prepare(.csv) }
            }
            Section("Important") {
                Text("A log can help you remember what was taken, but it cannot verify purity, interactions, or safety. Do not rely on it to decide whether to take more.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("About") {
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.1.0")
                LabeledContent("Storage", value: "On device")
            }
        }
        .navigationTitle("Settings")
        .sheet(item: $exportFile) { item in
            ShareSheet(items: [item.url])
        }
        .alert("Export failed", isPresented: Binding(get: { !exportError.isEmpty }, set: { if !$0 { exportError = "" } })) {
            Button("OK") { exportError = "" }
        } message: { Text(exportError) }
    }

    private func prepare(_ format: ExportFormat) {
        do { exportFile = ExportFile(url: try store.makeExport(format: format)) }
        catch { exportError = error.localizedDescription }
    }
}

private struct ExportFile: Identifiable {
    let id = UUID()
    let url: URL
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
