import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            NavigationStack { HistoryView() }
                .tabItem { Label("History", systemImage: "clock.arrow.circlepath") }
            NavigationStack { AddDoseView() }
                .tabItem { Label("Add", systemImage: "plus.circle.fill") }
            NavigationStack { ImportView() }
                .tabItem { Label("Import", systemImage: "square.and.arrow.down") }
            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .tint(.indigo)
    }
}

