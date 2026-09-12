import Foundation

struct DoseEntry: Codable, Identifiable, Hashable {
    var id: UUID = UUID()
    var substance: String
    var amount: Double
    var unit: String
    var route: String
    var takenAt: Date
    var notes: String = ""
    var source: String = "Manual"
    var createdAt: Date = Date()

    var amountText: String {
        amount.formatted(.number.precision(.fractionLength(0...3)))
    }
}

enum DoseOptions {
    static let units = ["mg", "g", "mcg", "mL", "units", "tablets", "capsules"]
    static let routes = [
        "Oral", "Sublingual", "Buccal", "Intranasal", "Smoked",
        "Vaporized", "Inhaled", "Transdermal", "Rectal",
        "Subcutaneous", "Intramuscular", "Intravenous", "Other"
    ]
}

