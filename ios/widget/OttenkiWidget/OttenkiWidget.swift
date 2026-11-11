import WidgetKit
import SwiftUI

// Виджет «Оттенков»: сегодняшний день и последние дни цветом. Данные кладёт приложение в общую App Group.

// MARK: - Данные

struct DayMark: Decodable {
    let c: String   // цвет #RRGGBB
    let n: String   // название уровня
}

struct Payload: Decodable {
    let days: [String: DayMark]
    let streak: Int
}

enum Store {
    static func load() -> Payload? {
        guard let json = UserDefaults(suiteName: OttenkiAppGroup.id)?.string(forKey: "widget"),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Payload.self, from: data)
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

extension Date {
    var dayKey: String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: self)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
    func adding(days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: self) ?? self
    }
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

// MARK: - Таймлайн

struct Entry: TimelineEntry {
    let date: Date
    let payload: Payload?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry {
        Entry(date: Date(), payload: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), payload: Store.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let now = Date()
        // Обновиться сразу после полуночи — чтобы сменились дата и «сегодня»
        let midnight = Calendar.current.startOfDay(for: now.adding(days: 1)).addingTimeInterval(5)
        let entries = [Entry(date: now, payload: Store.load()), Entry(date: midnight, payload: Store.load())]
        completion(Timeline(entries: entries, policy: .after(midnight)))
    }
}

// MARK: - Вид

private let paperLight = Color(hex: "#F2EEE6")
private let paperDark = Color(hex: "#121110")
private let inkLight = Color(hex: "#1A1814")
private let inkDark = Color(hex: "#EEE9DF")
private let emptyLight = Color(hex: "#E3DED3")
private let emptyDark = Color(hex: "#282623")

private let monthsGen = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
private let weekdaysShort = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]

struct Palette {
    let scheme: ColorScheme
    var paper: Color { scheme == .dark ? paperDark : paperLight }
    var ink: Color { scheme == .dark ? inkDark : inkLight }
    var muted: Color { ink.opacity(0.55) }
    var empty: Color { scheme == .dark ? emptyDark : emptyLight }
}

struct DayCell: View {
    let mark: DayMark?
    let isToday: Bool
    let p: Palette
    var body: some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(mark.map { Color(hex: $0.c) } ?? p.empty)
            .overlay(
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .stroke(isToday ? p.ink : .clear, lineWidth: 1.5)
            )
    }
}

struct TodayBlock: View {
    let entry: Entry
    let p: Palette
    var body: some View {
        let cal = Calendar.current
        let d = cal.component(.day, from: entry.date)
        let m = cal.component(.month, from: entry.date) - 1
        let wd = cal.component(.weekday, from: entry.date) - 1
        let today = entry.payload?.days[entry.date.dayKey]
        VStack(alignment: .leading, spacing: 2) {
            Text(weekdaysShort[wd].uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(p.muted)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("\(d)")
                    .font(.system(size: 44, weight: .regular, design: .serif))
                    .foregroundStyle(p.ink)
                Text(monthsGen[m])
                    .font(.system(size: 16, weight: .regular, design: .serif).italic())
                    .foregroundStyle(p.ink.opacity(0.75))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 4)
            if let t = today {
                HStack(spacing: 6) {
                    Capsule().fill(Color(hex: t.c)).frame(width: 10, height: 18)
                    Text(t.n)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(p.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            } else {
                Text("Как прошёл день?")
                    .font(.system(size: 14, weight: .regular, design: .serif).italic())
                    .foregroundStyle(p.ink.opacity(0.75))
                    .lineLimit(2)
            }
        }
    }
}

struct WeekRow: View {
    let entry: Entry
    let count: Int
    let p: Palette
    var body: some View {
        HStack(spacing: 3) {
            ForEach((0..<count).reversed(), id: \.self) { back in
                let day = entry.date.adding(days: -back)
                DayCell(mark: entry.payload?.days[day.dayKey], isToday: back == 0, p: p)
                    .aspectRatio(1, contentMode: .fit)
            }
        }
    }
}

struct SmallView: View {
    let entry: Entry
    @Environment(\.colorScheme) var scheme
    var body: some View {
        let p = Palette(scheme: scheme)
        VStack(alignment: .leading, spacing: 8) {
            TodayBlock(entry: entry, p: p)
            WeekRow(entry: entry, count: 7, p: p)
        }
        .containerBackground(p.paper, for: .widget)
    }
}

struct MediumView: View {
    let entry: Entry
    @Environment(\.colorScheme) var scheme
    var body: some View {
        let p = Palette(scheme: scheme)
        HStack(alignment: .top, spacing: 16) {
            TodayBlock(entry: entry, p: p)
                .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                let weeks = 4
                ForEach(0..<weeks, id: \.self) { row in
                    HStack(spacing: 3) {
                        ForEach(0..<7, id: \.self) { col in
                            let back = (weeks - 1 - row) * 7 + (6 - col)
                            let day = entry.date.adding(days: -back)
                            DayCell(mark: entry.payload?.days[day.dayKey], isToday: back == 0, p: p)
                                .aspectRatio(1, contentMode: .fit)
                        }
                    }
                }
                if let s = entry.payload?.streak, s > 1 {
                    Text("\(s) подряд")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(p.muted)
                        .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .containerBackground(p.paper, for: .widget)
    }
}

struct OttenkiWidgetView: View {
    let entry: Entry
    @Environment(\.widgetFamily) var family
    var body: some View {
        switch family {
        case .systemMedium: MediumView(entry: entry)
        default: SmallView(entry: entry)
        }
    }
}

@main
struct OttenkiWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "OttenkiWidget", provider: Provider()) { entry in
            OttenkiWidgetView(entry: entry)
        }
        .configurationDisplayName("Оттенки")
        .description("Сегодняшний день и последние недели в цвете.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
