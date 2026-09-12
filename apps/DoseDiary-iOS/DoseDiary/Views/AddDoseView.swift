import SwiftUI

struct AddDoseView: View {
    @EnvironmentObject private var store: DoseStore
    @State private var substance = ""
    @State private var amount = 0.0
    @State private var unit = "mg"
    @State private var route = "Oral"
    @State private var takenAt = Date()
    @State private var notes = ""
    @State private var saved = false

    var body: some View {
        Form {
            Section("What") {
                TextField("Substance or medication", text: $substance)
                    .textInputAutocapitalization(.words)
                TextField("Amount", value: $amount, format: .number)
                    .keyboardType(.decimalPad)
                Picker("Unit", selection: $unit) {
                    ForEach(DoseOptions.units, id: \.self) { Text($0) }
                }
                Picker("Route", selection: $route) {
                    ForEach(DoseOptions.routes, id: \.self) { Text($0) }
                }
            }
            Section("When") {
                DatePicker("Date and time", selection: $takenAt)
            }
            Section("Optional") {
                TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...8)
            }
            Section {
                Button {
                    save()
                } label: {
                    Label("Save Entry", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .disabled(substance.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || amount <= 0)
            }
            Section {
                Text("This diary records information only. It does not determine whether a dose or combination is safe. For chest pain, trouble breathing, seizures, severe overheating, fainting, or extreme confusion, call emergency services.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Log a Dose")
        .alert("Entry saved", isPresented: $saved) { Button("OK") {} }
    }

    private func save() {
        store.add(DoseEntry(
            substance: substance.trimmingCharacters(in: .whitespacesAndNewlines),
            amount: amount,
            unit: unit,
            route: route,
            takenAt: takenAt,
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines)
        ))
        substance = ""
        amount = 0
        notes = ""
        takenAt = Date()
        saved = true
    }
}

