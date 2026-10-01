import SwiftUI

@main
struct FluxApp: App {
    var body: some Scene {
        WindowGroup {
            FluxWebView()
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
        }
    }
}
