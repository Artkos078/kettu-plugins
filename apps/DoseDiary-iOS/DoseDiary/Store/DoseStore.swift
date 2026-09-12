import Foundation
import SwiftUI

@MainActor
final class DoseStore: ObservableObject {
    @Published private(set) var entries: [DoseEntry] = []
    @Published var faceIDEnabled: Bool {
        didSet { UserDefaults.standard.set(faceIDEnabled, forKey: Self.faceIDKey) }
    }

    private static let faceIDKey = "faceIDEnabled"
    private let fileURL: URL

    init() {
        faceIDEnabled = UserDefaults.standard.bool(forKey: Self.faceIDKey)
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let folder = support.appendingPathComponent("DoseDiary", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        fileURL = folder.appendingPathComponent("dose-history.json")
        load()
    }

    func add(_ entry: DoseEntry) {
        entries.append(entry)
        sortAndSave()
    }

    func addImported(_ candidates: [DoseEntry]) -> Int {
        var added = 0
        for entry in candidates where !isDuplicate(entry) {
            entries.append(entry)
            added += 1
        }
        sortAndSave()
        return added
    }

    func update(_ entry: DoseEntry) {
        guard let index = entries.firstIndex(where: { $0.id == entry.id }) else { return }
        entries[index] = entry
        sortAndSave()
    }

    func delete(at offsets: IndexSet) {
        entries.remove(atOffsets: offsets)
        save()
    }

    func delete(_ entry: DoseEntry) {
        entries.removeAll { $0.id == entry.id }
        save()
    }

    func isDuplicate(_ candidate: DoseEntry) -> Bool {
        entries.contains {
            $0.substance.caseInsensitiveCompare(candidate.substance) == .orderedSame &&
            abs($0.amount - candidate.amount) < 0.0001 &&
            $0.unit.caseInsensitiveCompare(candidate.unit) == .orderedSame &&
            $0.route.caseInsensitiveCompare(candidate.route) == .orderedSame &&
            abs($0.takenAt.timeIntervalSince(candidate.takenAt)) < 2
        }
    }

    func makeExport(format: ExportFormat) throws -> URL {
        let formatter = ISO8601DateFormatter()
        let temp = FileManager.default.temporaryDirectory
        switch format {
        case .json:
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(entries)
            let url = temp.appendingPathComponent("dose-diary-backup.json")
            try data.write(to: url, options: [.atomic, .completeFileProtection])
            return url
        case .csv:
            var rows = ["date,substance,amount,unit,route,notes,source"]
            for entry in entries {
                rows.append([
                    formatter.string(from: entry.takenAt), entry.substance, entry.amountText,
                    entry.unit, entry.route, entry.notes, entry.source
                ].map(Self.csvEscape).joined(separator: ","))
            }
            let url = temp.appendingPathComponent("dose-diary-export.csv")
            try rows.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
            return url
        }
    }

    private func sortAndSave() {
        entries.sort { $0.takenAt > $1.takenAt }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        entries = (try? decoder.decode([DoseEntry].self, from: data)) ?? []
        entries.sort { $0.takenAt > $1.takenAt }
    }

    private func save() {
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(entries)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
        } catch {
            assertionFailure("Could not save dose history: \(error)")
        }
    }

    private static func csvEscape(_ value: String) -> String {
        "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }
}

enum ExportFormat: String, Identifiable {
    case json, csv
    var id: String { rawValue }
}
