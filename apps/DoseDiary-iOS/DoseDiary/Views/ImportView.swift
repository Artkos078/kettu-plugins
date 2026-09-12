import SwiftUI
import UniformTypeIdentifiers
import UIKit

struct ImportView: View {
    @EnvironmentObject private var store: DoseStore
    @State private var input = ""
    @State private var candidates: [DoseEntry] = []
    @State private var selected = Set<UUID>()
    @State private var showingFileImporter = false
    @State private var message = ""

    var body: some View {
        Form {
            Section("TripBot DM text") {
                TextEditor(text: $input)
                    .frame(minHeight: 150)
                    .font(.body.monospaced())
                HStack {
                    Button("Paste") { input = UIPasteboard.general.string ?? "" }
                    Spacer()
                    Button("Choose File") { showingFileImporter = true }
                }
                Button("Find Entries") { parse() }
                    .frame(maxWidth: .infinity)
                    .buttonStyle(.borderedProminent)
            }

            if !candidates.isEmpty {
                Section("Review before importing") {
                    ForEach(candidates) { entry in
                        Button {
                            if selected.contains(entry.id) { selected.remove(entry.id) }
                            else { selected.insert(entry.id) }
                        } label: {
                            HStack {
                                Image(systemName: selected.contains(entry.id) ? "checkmark.circle.fill" : "circle")
                                VStack(alignment: .leading) {
                                    Text("\(entry.amountText) \(entry.unit) \(entry.substance)")
                                    Text("\(entry.route) • \(entry.takenAt.formatted(date: .numeric, time: .standard))")
                                        .font(.caption).foregroundStyle(.secondary)
                                    if store.isDuplicate(entry) {
                                        Text("Already in diary").font(.caption).foregroundStyle(.orange)
                                    }
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    Button("Import Selected") { importSelected() }
                        .disabled(selected.isEmpty)
                }
            }

            Section("How to import") {
                Text("Copy one or more TripBot dose messages and tap Paste, or export/copy them into a text file and choose that file. The app cannot sign into Discord or read DMs by itself.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Import")
        .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: [.plainText, .json]) { result in
            guard case .success(let url) = result else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            if let content = try? String(contentsOf: url, encoding: .utf8) {
                input = content
                parse()
            }
        }
        .alert("Import", isPresented: Binding(get: { !message.isEmpty }, set: { if !$0 { message = "" } })) {
            Button("OK") { message = "" }
        } message: { Text(message) }
    }

    private func parse() {
        if let data = input.data(using: .utf8) {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            if let backupEntries = try? decoder.decode([DoseEntry].self, from: data), !backupEntries.isEmpty {
                candidates = backupEntries.map {
                    var entry = $0
                    entry.id = UUID()
                    entry.source = "JSON backup"
                    return entry
                }
                selected = Set(candidates.filter { !store.isDuplicate($0) }.map(\.id))
                return
            }
        }
        let result = TripBotParser.parse(input)
        candidates = result.entries
        selected = Set(result.entries.filter { !store.isDuplicate($0) }.map(\.id))
        if result.entries.isEmpty { message = "No TripBot dose entries were found. Include the “You dosed … on YYYY-MM-DD HH:MM:SS UTC±HH:MM” text." }
    }

    private func importSelected() {
        let chosen = candidates.filter { selected.contains($0.id) }
        let count = store.addImported(chosen)
        message = "Imported \(count) new entr\(count == 1 ? "y" : "ies"). Duplicates were skipped."
        candidates = []
        selected = []
        input = ""
    }
}
