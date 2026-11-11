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
        let defaults = UserDefaults(suiteName: OttenkiAppGroup.id)
        defaults?.set(json, forKey: "widget")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["group": OttenkiAppGroup.id, "ok": defaults != nil])
    }
}

/// Идентификатор App Group. SideStore/AltStore при подписи могут переименовать группу и пишут
/// настоящее имя в Info.plist (ALTAppGroups) — берём его, если есть.
enum OttenkiAppGroup {
    static let fallback = "group.io.github.mihailmoskalenko08.ottenki"
    static var id: String {
        if let groups = Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String], let first = groups.first {
            return first
        }
        return fallback
    }
}
