import Foundation
import Capacitor
import WidgetKit

/// Передаёт виджету краткую сводку отметок через общую App Group и просит его перерисоваться.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    @objc func update(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("json required")
            return
        }
        let group = OttenkiAppGroup.id
        let defaults = UserDefaults(suiteName: group)
        defaults?.set(json, forKey: "widget")
        // Проверка, что запись действительно в общей папке группы (а не в собственной папке приложения)
        let shared = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) != nil
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["group": group, "ok": defaults != nil, "shared": shared, "provisioned": OttenkiAppGroup.provisionedGroups()])
    }
}

/// Имя общей App Group, под которым приложение на самом деле подписано.
/// Подписчики (iloader, SideStore, AltStore) переименовывают группу, поэтому ищем по порядку:
/// 1) ALTAppGroups в Info.plist (SideStore/AltStore); 2) права из профиля подписи embedded.mobileprovision;
/// 3) group.<id основного приложения> (так называет iloader); 4) исходное имя.
enum OttenkiAppGroup {
    static let fallback = "group.io.github.mihailmoskalenko08.ottenki"

    static var id: String { cached }
    private static let cached: String = resolve()

    private static func resolve() -> String {
        if let groups = Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String], let first = groups.first {
            return first
        }
        if let first = provisionedGroups().first {
            return first
        }
        if var bid = Bundle.main.bundleIdentifier {
            if bid.hasSuffix(".widget") { bid.removeLast(".widget".count) }
            return "group." + bid
        }
        return fallback
    }

    /// Группы из прав профиля подписи, вложенного в пакет.
    static func provisionedGroups() -> [String] {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex) else { return [] }
        let xml = data.subdata(in: start.lowerBound..<end.upperBound)
        guard let plist = try? PropertyListSerialization.propertyList(from: xml, format: nil) as? [String: Any],
              let ent = plist["Entitlements"] as? [String: Any],
              let groups = ent["com.apple.security.application-groups"] as? [String] else { return [] }
        return groups
    }
}
