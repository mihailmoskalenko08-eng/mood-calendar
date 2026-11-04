// Статистика — чистые функции над данными.

import { addDays, compareKeys, daysInMonth, keyOf, parseKey, todayKey, weekdayMon, type DayKey } from './dates'
import { levelIndex, scoreOf, type Data, type Entry } from './model'

export interface Range {
  from: DayKey
  to: DayKey
}

export function yearRange(y: number): Range {
  return { from: keyOf(y, 0, 1), to: keyOf(y, 11, 31) }
}

export function monthRange(y: number, m: number): Range {
  return { from: keyOf(y, m, 1), to: keyOf(y, m, daysInMonth(y, m)) }
}

export function entriesIn(data: Data, range: Range | null): [DayKey, Entry][] {
  return Object.entries(data.entries)
    .filter(([k]) => !range || (k >= range.from && k <= range.to))
    .sort(([a], [b]) => compareKeys(a, b))
}

export function average(data: Data, list: [DayKey, Entry][]): number | null {
  let sum = 0, n = 0
  for (const [, e] of list) {
    const s = scoreOf(data, e.level)
    if (s != null) { sum += s; n++ }
  }
  return n ? sum / n : null
}

export function distribution(data: Data, list: [DayKey, Entry][]): { id: string; count: number; share: number }[] {
  const counts = new Map(data.levels.map(l => [l.id, 0]))
  for (const [, e] of list) if (counts.has(e.level)) counts.set(e.level, counts.get(e.level)! + 1)
  const total = list.length || 1
  return data.levels.map(l => ({ id: l.id, count: counts.get(l.id)!, share: counts.get(l.id)! / total }))
}

/** Средняя оценка по месяцам года (null — нет отметок). */
export function monthlyAverages(data: Data, y: number): { avg: number | null; count: number }[] {
  return Array.from({ length: 12 }, (_, m) => {
    const list = entriesIn(data, monthRange(y, m))
    return { avg: average(data, list), count: list.length }
  })
}

/** Средняя оценка по дням недели (0 — понедельник). */
export function weekdayAverages(data: Data, list: [DayKey, Entry][]): { avg: number | null; count: number }[] {
  const acc = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))
  for (const [k, e] of list) {
    const s = scoreOf(data, e.level)
    if (s == null) continue
    const w = weekdayMon(k)
    acc[w].sum += s
    acc[w].count++
  }
  return acc.map(a => ({ avg: a.count ? a.sum / a.count : null, count: a.count }))
}

/** Сколько дней подряд отмечено, заканчивая сегодня (или вчера, если сегодня ещё не отмечен). */
export function currentStreak(data: Data, today: DayKey = todayKey()): number {
  let day = data.entries[today] ? today : addDays(today, -1)
  let n = 0
  while (data.entries[day]) { n++; day = addDays(day, -1) }
  return n
}

/** Самая длинная серия подряд идущих дней, удовлетворяющих условию. */
export function longestRun(
  data: Data,
  test: (e: Entry, key: DayKey) => boolean,
  range: Range | null = null
): { length: number; from: DayKey | null; to: DayKey | null } {
  const keys = entriesIn(data, range).filter(([k, e]) => test(e, k)).map(([k]) => k)
  let best = { length: 0, from: null as DayKey | null, to: null as DayKey | null }
  let start: DayKey | null = null, prev: DayKey | null = null, len = 0
  for (const k of keys) {
    if (prev && addDays(prev, 1) === k) len++
    else { start = k; len = 1 }
    if (len > best.length) best = { length: len, from: start, to: k }
    prev = k
  }
  return best
}

/** «Хороший» день — верхняя половина шкалы (строго выше середины). */
export function isGood(data: Data, e: Entry): boolean {
  const i = levelIndex(data, e.level)
  return i >= 0 && i > (data.levels.length - 1) / 2
}

export interface TagInsight {
  id: string
  count: number
  withAvg: number | null
  withoutAvg: number | null
  /** разница средних, в долях шкалы */
  delta: number | null
}

/** Как метка связана с настроением: среднее в дни с меткой и без неё. */
export function tagInsights(data: Data, list: [DayKey, Entry][]): TagInsight[] {
  return data.tags
    .map(t => {
      const withT = list.filter(([, e]) => e.tags?.includes(t.id))
      const without = list.filter(([, e]) => !e.tags?.includes(t.id))
      const a = average(data, withT), b = average(data, without)
      return { id: t.id, count: withT.length, withAvg: a, withoutAvg: b, delta: a != null && b != null ? a - b : null }
    })
    .filter(t => t.count > 0)
    .sort((x, y) => Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0) || y.count - x.count)
}

/** Лучший и худший месяц по средней оценке (только месяцы, где отмечено хотя бы 5 дней). */
export function extremeMonths(data: Data, y: number, minDays = 5): { best: number | null; worst: number | null } {
  const avgs = monthlyAverages(data, y)
  let best: number | null = null, worst: number | null = null
  avgs.forEach((a, m) => {
    if (a.avg == null || a.count < minDays) return
    if (best == null || a.avg > avgs[best].avg!) best = m
    if (worst == null || a.avg < avgs[worst].avg!) worst = m
  })
  if (best === worst) worst = null
  return { best, worst }
}

/** Сколько дней в диапазоне уже наступило (для «отмечено X из Y»). */
export function elapsedDays(range: Range, today: DayKey = todayKey()): number {
  if (today < range.from) return 0
  const end = today < range.to ? today : range.to
  return Math.round((parseKey(end).getTime() - parseKey(range.from).getTime()) / 86400000) + 1
}

/** Годы, в которых есть отметки, плюс текущий. */
export function yearsWithData(data: Data, today: DayKey = todayKey()): number[] {
  const ys = new Set<number>([parseKey(today).getFullYear()])
  for (const k of Object.keys(data.entries)) ys.add(Number(k.slice(0, 4)))
  return [...ys].sort((a, b) => a - b)
}
