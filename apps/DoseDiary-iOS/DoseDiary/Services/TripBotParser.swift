import Foundation

enum TripBotParser {
    struct Result {
        var entries: [DoseEntry]
        var skippedLines: Int
    }

    private static let routes = DoseOptions.routes.filter { $0 != "Other" } + ["Nasal", "Insufflated", "Injected"]

    static func parse(_ text: String) -> Result {
        var parsed: [DoseEntry] = []
        let normalized = text
            .replacingOccurrences(of: "**", with: "")
            .replacingOccurrences(of: "\u{00A0}", with: " ")

        let routePattern = routes
            .sorted { $0.count > $1.count }
            .map { NSRegularExpression.escapedPattern(for: $0) }
            .joined(separator: "|")

        let pattern = #"You\s+dosed\s+([0-9]+(?:\.[0-9]+)?)\s+([A-Za-zµμ]+)\s+of\s+(.+?)\s+("# + routePattern + #")\s+.*?\bon\s+(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*(?:UTC|GMT)?([+-]\d{2}:?\d{2}|Z)?"#

        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive, .dotMatchesLineSeparators]) else {
            return Result(entries: [], skippedLines: 0)
        }

        let range = NSRange(normalized.startIndex..., in: normalized)
        let matches = regex.matches(in: normalized, range: range)
        for match in matches {
            guard
                let amountText = capture(1, match, normalized),
                let amount = Double(amountText),
                let unit = capture(2, match, normalized),
                let substance = capture(3, match, normalized),
                let route = capture(4, match, normalized),
                let date = capture(5, match, normalized),
                let time = capture(6, match, normalized)
            else { continue }

            let zone = capture(7, match, normalized) ?? ""
            guard let takenAt = parseDate(date: date, time: time, zone: zone) else { continue }
            parsed.append(DoseEntry(
                substance: substance.trimmingCharacters(in: .whitespacesAndNewlines),
                amount: amount,
                unit: normalizeUnit(unit),
                route: normalizeRoute(route),
                takenAt: takenAt,
                notes: "",
                source: "TripBot"
            ))
        }

        return Result(entries: parsed, skippedLines: normalized.components(separatedBy: "You dosed").count - 1 - parsed.count)
    }

    private static func parseDate(date: String, time: String, zone: String) -> Date? {
        if zone.isEmpty {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            return formatter.date(from: "\(date) \(time)")
        }

        let normalizedZone: String
        if zone == "Z" {
            normalizedZone = "Z"
        } else if zone.contains(":") {
            normalizedZone = zone
        } else {
            let split = zone.index(zone.startIndex, offsetBy: 3)
            normalizedZone = String(zone[..<split]) + ":" + String(zone[split...])
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        return iso.date(from: "\(date)T\(time)\(normalizedZone)")
    }

    private static func capture(_ group: Int, _ match: NSTextCheckingResult, _ text: String) -> String? {
        let range = match.range(at: group)
        guard range.location != NSNotFound, let swiftRange = Range(range, in: text) else { return nil }
        return String(text[swiftRange])
    }

    private static func normalizeUnit(_ unit: String) -> String {
        switch unit.lowercased() {
        case "mg": return "mg"
        case "g": return "g"
        case "mcg", "µg", "μg": return "mcg"
        case "ml": return "mL"
        default: return unit
        }
    }

    private static func normalizeRoute(_ route: String) -> String {
        switch route.lowercased() {
        case "nasal", "insufflated": return "Intranasal"
        case "injected": return "Other"
        default: return route.prefix(1).uppercased() + route.dropFirst().lowercased()
        }
    }
}
