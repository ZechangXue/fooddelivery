import Foundation

enum AppPolicy {
    static let home = URL(string: "https://wembley-walk-delivery.superxin24.chatgpt.site/")!
    static func isTrusted(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == home.host && (url.port == nil || url.port == 443)
    }
    static func externalScheme(_ url: URL) -> Bool { ["tel", "mailto"].contains(url.scheme?.lowercased() ?? "") }
}
