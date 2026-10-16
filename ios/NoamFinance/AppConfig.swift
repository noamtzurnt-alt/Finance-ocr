import Foundation

enum AppConfig {
    struct Site {
        let origin: URL
        let startURL: URL
        let host: String
    }

    enum Load {
        case ready(Site)
        case invalid(String)
    }

    static func load() -> Load {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "AppProductionURL") as? String,
            !raw.isEmpty,
            !raw.contains("$(")
        else {
            return .invalid("AppProductionURL חסר. עדכן את ios/NoamFinance/Info.plist.")
        }
        guard let origin = URL(string: raw), origin.scheme?.lowercased() == "https", let host = origin.host, !host.isEmpty else {
            return .invalid("AppProductionURL חייב להיות כתובת https.")
        }
        let path = (Bundle.main.object(forInfoDictionaryKey: "AppStartPath") as? String)?
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let start = path.flatMap { $0.isEmpty ? nil : origin.appending(path: $0) } ?? origin
        return .ready(Site(origin: origin, startURL: start, host: host.lowercased()))
    }
}
