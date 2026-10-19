import AppIntents
import Capacitor
import Foundation
import UIKit

/// Deep link consumed by the web layer (`src/components/capacitor-bridge.tsx`):
/// Capacitor fires `appUrlOpen`, and the bridge routes `://record` to the
/// focused capture screen (`/capture`) with the recorder auto-started.
private let recordDeepLink = URL(string: "nl.naturalheroes.bloodmarkers://record")!

/// Deep link consumed by the web layer (`src/components/capacitor-bridge.tsx`):
/// Capacitor fires `appUrlOpen`, and the bridge routes `://photo` to the
/// focused photo-capture screen (`/capture/photo`) with the camera auto-opened.
private let photoDeepLink = URL(string: "nl.naturalheroes.bloodmarkers://photo")!

/// Endpoint the background Log Food intent posts to. Capacitor mirrors the
/// WKWebView's cookies into `HTTPCookieStorage.shared` (see
/// MainViewController), which `URLSession.shared` reads by default — so the
/// request carries the logged-in session with no token setup.
private let logEndpoint = URL(string: "https://bloodmarkers.naturalheroes.nl/api/nutrition/log")!

/// Routes the `://record` deep link into Capacitor's URL-open pipeline,
/// exactly as AppDelegate does for real scheme opens (the system refuses an
/// `OpenURLIntent` with a custom scheme — AUT-960). The App plugin retains
/// the resulting `appUrlOpen` event until the (possibly still-loading) web
/// app registers its listener, which covers cold starts too.
@MainActor
private func openRecorderDeepLink() {
    let handled = ApplicationDelegateProxy.shared.application(
        UIApplication.shared,
        open: recordDeepLink,
        options: [:]
    )
    assert(handled, "Capacitor did not handle the record deep link — appUrlOpen will not fire")
}

/// Routes the `://photo` deep link into Capacitor's URL-open pipeline so the
/// web layer opens the photo-capture screen (`/capture/photo`) with the camera
/// auto-started — mirrors `openRecorderDeepLink()` for the Photo flow.
@MainActor
private func openPhotoDeepLink() {
    let handled = ApplicationDelegateProxy.shared.application(
        UIApplication.shared,
        open: photoDeepLink,
        options: [:]
    )
    assert(handled, "Capacitor did not handle the photo deep link — appUrlOpen will not fire")
}

@available(iOS 16.4, *)
enum LogFoodMode: String, AppEnum {
    case record
    case write
    case photo

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Input Method"
    static var caseDisplayRepresentations: [LogFoodMode: DisplayRepresentation] = [
        .record: DisplayRepresentation(title: "Speak", image: .init(systemName: "mic.fill")),
        .write: DisplayRepresentation(title: "Write", image: .init(systemName: "square.and.pencil")),
        .photo: DisplayRepresentation(title: "Photo", image: .init(systemName: "camera.fill")),
    ]
}

/// Logs a meal with a Write/Speak/Photo choice: **Write** stays in the background
/// (text prompt → server log → confirmation banner; the keyboard mic key
/// gives dictation), **Speak** continues into the app's focused capture
/// screen — without a confirmation prompt (`alwaysConfirm: false`) and
/// without a result banner — and **Photo** opens the camera to scan a plate.
/// A meal piped in from a wrapper shortcut (e.g. Dictate Text) skips the
/// chooser and logs directly.
@available(iOS 16.4, *)
struct LogFoodIntent: AppIntent, ForegroundContinuableIntent {
    static var title: LocalizedStringResource = "Log Food"
    static var description = IntentDescription(
        "Logs a meal to Bloodmarkers. Speak opens the in-app recorder; Photo opens the camera to scan a plate; Write logs in the background without opening the app. If Meal is provided (e.g. from Dictate Text), it is logged directly and Method is ignored."
    )
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Method")
    var mode: LogFoodMode?

    @Parameter(title: "Meal", requestValueDialog: "What did you eat?")
    var meal: String?

    /// Filled by the system when the server asks a follow-up question (see
    /// `needsValueError` below) — leave empty in Shortcuts.
    @Parameter(title: "Clarification", requestValueDialog: "Can you clarify?")
    var clarification: String?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        var text = meal?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if text.isEmpty {
            let method: LogFoodMode
            if let preset = mode {
                method = preset
            } else {
                method = try await $mode.requestDisambiguation(
                    among: [.write, .record, .photo],
                    dialog: "How do you want to log your meal?"
                )
            }

            if method == .record {
                // Recording needs the mic and a UI that background intents
                // don't get. alwaysConfirm: false (iOS 26+) skips the "You'll
                // need to continue in the app" prompt — older iOS keeps the
                // confirmation — and the empty result dialog keeps Shortcuts
                // from stacking a banner over the capture screen (AUT-988).
                if #available(iOS 26.0, *) {
                    try await continueInForeground(alwaysConfirm: false)
                } else {
                    try await requestToContinueInForeground()
                }
                await openRecorderDeepLink()
                return .result(dialog: "")
            }

            if method == .photo {
                if #available(iOS 26.0, *) {
                    try await continueInForeground(alwaysConfirm: false)
                } else {
                    try await requestToContinueInForeground()
                }
                await openPhotoDeepLink()
                return .result(dialog: "")
            }

            text = try await $meal.requestValue("What did you eat?")
        }

        // Clarify re-entry: the needsValueError below makes the system collect
        // the answer and re-run perform() with `clarification` populated.
        if let answer = clarification?.trimmingCharacters(in: .whitespacesAndNewlines), !answer.isEmpty {
            return .result(dialog: await postLog(food: text, clarification: answer, allowQuestion: false).dialog)
        }

        let first = await postLog(food: text, clarification: nil, allowQuestion: true)
        if let question = first.question {
            // NOT $clarification.requestValue: on-device that resolved the
            // optional parameter silently to nil — the question never showed
            // and the meal logged with assumed amounts (builds 13/14).
            // needsValueError demands the value: the system presents the
            // question and re-runs perform() with the answer set.
            throw $clarification.needsValueError(IntentDialog("\(question)"))
        }
        return .result(dialog: first.dialog)
    }

    /// Posts to the log endpoint and turns the response into either a
    /// follow-up question or the confirmation banner text.
    private func postLog(
        food: String,
        clarification: String?,
        allowQuestion: Bool
    ) async -> (question: String?, dialog: IntentDialog) {
        var payload: [String: Any] = ["food": food]
        if let clarification { payload["clarification"] = clarification }
        if allowQuestion { payload["allow_question"] = true }

        var request = URLRequest(url: logEndpoint, timeoutInterval: 25)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
            return (nil, "Couldn't log that meal — try again.")
        }
        request.httpBody = body

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            return (nil, "Couldn't reach Bloodmarkers — check your connection and try again.")
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 {
            return (nil, "You're signed out — open Blood Markers once to sign in, then try again.")
        }
        guard (200..<300).contains(status) else {
            return (nil, "Couldn't log that meal (server error \(status)) — try again.")
        }

        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]

        if let question = json["question"] as? String, !question.isEmpty {
            return (question, "Logged: \(food)")
        }
        if json["undone"] as? Bool == true {
            let name = json["food_name"] as? String
            return (nil, name.map { "Removed last meal: \($0)" } ?? "Removed last meal")
        }
        if json["saved"] as? Bool == true {
            let name = json["food_name"] as? String ?? "meal"
            return (nil, "Saved as meal: \(name)")
        }

        let name = json["food_name"] as? String ?? food
        let items = (json["items"] as? [[String: Any]])?.count ?? 0
        var details: [String] = []
        if items > 1 { details.append("\(items) items") }
        if let kcal = (json["calories"] as? NSNumber)?.intValue { details.append("\(kcal) kcal") }
        let suffix = details.isEmpty ? "" : " — " + details.joined(separator: ", ")
        return (nil, "Logged: \(name)\(suffix)")
    }
}

/// Opens the focused capture screen (`/capture`) with the recorder
/// auto-started — the hands-on counterpart to the background `LogFoodIntent`.
/// `openAppWhenRun = true` means iOS launches the app to run it directly: no
/// "continue in the app" confirmation and no leftover result banner.
@available(iOS 16.0, *)
struct LogFoodByVoiceIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Voice Recorder"
    static var description = IntentDescription(
        "Opens Bloodmarkers on the focused capture screen with the voice recorder running."
    )
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        openRecorderDeepLink()
        return .result()
    }
}

/// Publishes the intents as App Shortcuts: they appear in the Shortcuts app
/// automatically (no user setup), work with Siri via the phrases below, and
/// can be bound to Back Tap, the Action Button, or a Control Center control.
@available(iOS 17.0, *)
struct BloodmarkersAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogFoodIntent(),
            phrases: [
                "Log food in \(.applicationName)",
                "Log a meal in \(.applicationName)",
            ],
            shortTitle: "Log Food",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: LogFoodByVoiceIntent(),
            phrases: [
                "Open the recorder in \(.applicationName)",
            ],
            shortTitle: "Open Recorder",
            systemImageName: "waveform"
        )
    }
}
