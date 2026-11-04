// Даты — только локальные, ключ дня строкой "ГГГГ-ММ-ДД" (без часовых поясов).

export type DayKey = string

export const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
]
export const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
]
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
export const MONTH_LETTERS = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д']
/** Индекс 0 — понедельник. */
export const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

const pad = (n: number) => String(n).padStart(2, '0')

export function keyOf(y: number, m: number, d: number): DayKey {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

export function toKey(date: Date): DayKey {
  return keyOf(date.getFullYear(), date.getMonth(), date.getDate())
}

export function parseKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12) // полдень — защита от перехода на летнее время
}

export function isValidKey(key: unknown): key is DayKey {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  return toKey(parseKey(key)) === key
}

export function todayKey(now: Date = new Date()): DayKey {
  return toKey(now)
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

/** День недели, 0 — понедельник. */
export function weekdayMon(key: DayKey): number {
  return (parseKey(key).getDay() + 6) % 7
}

/** Сетка месяца: массив недель, в каждой 7 ключей или null вне месяца. */
export function monthGrid(y: number, m: number, weekStart: 0 | 6 = 0): (DayKey | null)[][] {
  // weekStart: 0 — понедельник, 6 — воскресенье (в индексах weekdayMon)
  const first = keyOf(y, m, 1)
  const offset = (weekdayMon(first) - weekStart + 7) % 7
  const total = daysInMonth(y, m)
  const cells: (DayKey | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(keyOf(y, m, d))
  while (cells.length % 7) cells.push(null)
  const weeks: (DayKey | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function weekdayOrder(weekStart: 0 | 6): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)
}

export function compareKeys(a: DayKey, b: DayKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000)
}

/** «4 ноября», с годом, если он не текущий. */
export function humanDate(key: DayKey, now: DayKey = todayKey()): string {
  const d = parseKey(key)
  const base = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
  return d.getFullYear() === parseKey(now).getFullYear() ? base : `${base} ${d.getFullYear()}`
}

export function relativeLabel(key: DayKey, now: DayKey = todayKey()): string | null {
  const diff = diffDays(now, key)
  if (diff === 0) return 'сегодня'
  if (diff === -1) return 'вчера'
  if (diff === -2) return 'позавчера'
  if (diff === 1) return 'завтра'
  return null
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
