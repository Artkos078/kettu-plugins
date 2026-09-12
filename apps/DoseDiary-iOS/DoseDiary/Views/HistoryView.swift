import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var store: DoseStore

    var body: some View {
        Group {
            if store.entries.isEmpty {
                ContentUnavailableView("No entries yet", systemImage: "clock.badge.questionmark", description: Text("Add a dose manually or import TripBot messages."))
            } else {
                List {
                    ForEach(store.entries) { entry in
                        NavigationLink {
                            EntryDetailView(entry: entry)
                        } label: {
                            EntryRow(entry: entry)
                        }
                    }
                    .onDelete(perform: store.delete)
                }
            }
        }
        .navigationTitle("Dose History")
        .toolbar { EditButton() }
    }
}

private struct EntryRow: View {
    let entry: DoseEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(entry.substance).font(.headline)
                Spacer()
                Text("\(entry.amountText) \(entry.unit)").font(.headline).foregroundStyle(.indigo)
            }
            Text("\(entry.route) • \(entry.takenAt.formatted(date: .abbreviated, time: .standard))")
                .font(.subheadline).foregroundStyle(.secondary)
            TimelineView(.periodic(from: .now, by: 1)) { context in
                Text(relative(from: entry.takenAt, to: context.date))
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func relative(from date: Date, to now: Date) -> String {
        let seconds = max(0, Int(now.timeIntervalSince(date)))
        let days = seconds / 86_400
        let hours = (seconds % 86_400) / 3_600
        let minutes = (seconds % 3_600) / 60
        let remainder = seconds % 60
        if days > 0 { return "\(days)d \(hours)h \(minutes)m ago" }
        return "\(hours)h \(minutes)m \(remainder)s ago"
    }
}

private struct EntryDetailView: View {
    @EnvironmentObject private var store: DoseStore
    @Environment(\.dismiss) private var dismiss
    @State private var entry: DoseEntry
    @State private var editing = false

    init(entry: DoseEntry) { _entry = State(initialValue: entry) }

    var body: some View {
        Form {
            Section("Dose") {
                LabeledContent("Substance", value: entry.substance)
                LabeledContent("Amount", value: "\(entry.amountText) \(entry.unit)")
                LabeledContent("Route", value: entry.route)
            }
            Section("Time") {
                Text(entry.takenAt.formatted(date: .complete, time: .standard))
                LabeledContent("Source", value: entry.source)
            }
            if !entry.notes.isEmpty { Section("Notes") { Text(entry.notes) } }
            Section {
                Button("Delete Entry", role: .destructive) {
                    store.delete(entry)
                    dismiss()
                }
            }
        }
        .navigationTitle(entry.substance)
        .toolbar { Button("Edit") { editing = true } }
        .sheet(isPresented: $editing) {
            NavigationStack { EditDoseView(entry: $entry) }
        }
        .onChange(of: editing) { wasEditing, isEditing in
            if wasEditing && !isEditing { store.update(entry) }
        }
    }
}

private struct EditDoseView: View {
    @Binding var entry: DoseEntry
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            TextField("Substance", text: $entry.substance)
            TextField("Amount", value: $entry.amount, format: .number).keyboardType(.decimalPad)
            Picker("Unit", selection: $entry.unit) { ForEach(DoseOptions.units, id: \.self) { Text($0) } }
            Picker("Route", selection: $entry.route) { ForEach(DoseOptions.routes, id: \.self) { Text($0) } }
            DatePicker("Taken", selection: $entry.takenAt)
            TextField("Notes", text: $entry.notes, axis: .vertical).lineLimit(3...8)
        }
        .navigationTitle("Edit Entry")
        .easyKeyboardDismissal()
        .toolbar { Button("Done") { dismiss() } }
    }
}
