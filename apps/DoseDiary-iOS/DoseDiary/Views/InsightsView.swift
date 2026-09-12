import Charts
import SwiftUI

struct InsightsView: View {
    @EnvironmentObject private var store: DoseStore
    @State private var range: InsightRange = .thirtyDays

    private var filteredEntries: [DoseEntry] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let start = calendar.date(byAdding: .day, value: -(range.days - 1), to: today) ?? today
        return store.entries.filter { $0.takenAt >= start }
    }

    private var dailyCounts: [DailyDoseCount] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let grouped = Dictionary(grouping: filteredEntries) { calendar.startOfDay(for: $0.takenAt) }
        return (0..<range.days).compactMap { offset in
            guard let date = calendar.date(byAdding: .day, value: offset - (range.days - 1), to: today) else { return nil }
            return DailyDoseCount(date: date, count: grouped[date]?.count ?? 0)
        }
    }

    private var substanceCounts: [SubstanceDoseCount] {
        var names: [String: String] = [:]
        var counts: [String: Int] = [:]
        for entry in filteredEntries {
            let key = entry.substance.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            names[key] = names[key] ?? entry.substance
            counts[key, default: 0] += 1
        }
        let allCounts: [SubstanceDoseCount] = counts.map { pair in
            let displayName = names[pair.key] ?? pair.key
            return SubstanceDoseCount(name: displayName, count: pair.value)
        }
        let sortedCounts = allCounts.sorted { left, right in
            if left.count == right.count { return left.name < right.name }
            return left.count > right.count
        }
        return Array(sortedCounts.prefix(8))
    }

    private var activeDays: Int {
        dailyCounts.filter { $0.count > 0 }.count
    }

    private var averagePerActiveDay: String {
        guard activeDays > 0 else { return "0" }
        return (Double(filteredEntries.count) / Double(activeDays)).formatted(.number.precision(.fractionLength(1)))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Picker("Time range", selection: $range) {
                    ForEach(InsightRange.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.segmented)

                HStack(spacing: 10) {
                    SummaryCard(title: "Entries", value: "\(filteredEntries.count)", icon: "list.bullet.clipboard")
                    SummaryCard(title: "Active days", value: "\(activeDays)", icon: "calendar")
                    SummaryCard(title: "Per active day", value: averagePerActiveDay, icon: "chart.bar")
                }

                if filteredEntries.isEmpty {
                    ContentUnavailableView(
                        "No entries in this range",
                        systemImage: "chart.xyaxis.line",
                        description: Text("Add or import entries to build your history chart.")
                    )
                    .frame(maxWidth: .infinity)
                    .padding(.top, 28)
                } else {
                    chartCard(title: "Entries by day", subtitle: "Number of logged entries—not combined dosage") {
                        Chart(dailyCounts) { item in
                            BarMark(
                                x: .value("Date", item.date, unit: .day),
                                y: .value("Entries", item.count)
                            )
                            .foregroundStyle(Color.indigo.gradient)
                            .cornerRadius(3)
                        }
                        .chartYScale(domain: 0...max(1, (dailyCounts.map(\.count).max() ?? 1)))
                        .chartYAxis { AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) }
                        .frame(height: 220)
                    }

                    chartCard(title: "Most logged substances", subtitle: "Top eight by entry count") {
                        Chart(substanceCounts) { item in
                            BarMark(
                                x: .value("Entries", item.count),
                                y: .value("Substance", item.name)
                            )
                            .foregroundStyle(Color.teal.gradient)
                            .annotation(position: .trailing) {
                                Text("\(item.count)")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .chartXAxis { AxisMarks(position: .bottom, values: .automatic(desiredCount: 4)) }
                        .frame(height: max(180, CGFloat(substanceCounts.count) * 42))
                    }
                }

                Text("These charts summarize your records only. Frequency and totals do not indicate that a substance, amount, or combination is safe.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)
                    .padding(.bottom, 20)
            }
            .padding()
        }
        .navigationTitle("Insights")
    }

    private func chartCard<Content: View>(title: String, subtitle: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            content()
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private enum InsightRange: Int, CaseIterable, Identifiable {
    case sevenDays = 7
    case thirtyDays = 30
    case ninetyDays = 90

    var id: Int { rawValue }
    var days: Int { rawValue }
    var label: String {
        switch self {
        case .sevenDays: "7D"
        case .thirtyDays: "30D"
        case .ninetyDays: "90D"
        }
    }
}

private struct DailyDoseCount: Identifiable {
    let date: Date
    let count: Int
    var id: Date { date }
}

private struct SubstanceDoseCount: Identifiable {
    let name: String
    let count: Int
    var id: String { name }
}

private struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).foregroundStyle(.indigo)
            Text(value).font(.title2.bold()).monospacedDigit()
            Text(title).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
