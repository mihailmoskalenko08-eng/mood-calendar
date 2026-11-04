// Модель данных: шкала, метки, записи по дням, настройки. Всё хранится на устройстве.

import { rampColors } from './color'
import type { DayKey } from './dates'

export interface Level {
  id: string
  name: string
  color: string
}

export interface Tag {
  id: string
  name: string
}

export interface Entry {
  /** id уровня из шкалы */
  level: string
  note?: string
  tags?: string[]
  /** время последней правки, мс */
  at: number
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  theme: Theme
  /** 0 — неделя с понедельника, 6 — с воскресенья */
  weekStart: 0 | 6
  /** показывать заметки и метки под шкалой */
  showDetails: boolean
  /** вид года: сетка «месяцы × дни» или «недели» */
  yearLayout: 'months' | 'weeks'
}

export interface Data {
  version: 1
  /** от худшего к лучшему */
  levels: Level[]
  tags: Tag[]
  entries: Record<DayKey, Entry>
  settings: Settings
  palette: string
  onboarded: boolean
  lastBackup?: number
  createdAt: number
}

export const MIN_LEVELS = 2
export const MAX_LEVELS = 10
export const MAX_TAGS = 24
export const MAX_NOTE = 2000

export interface Palette {
  id: string
  name: string
  stops: string[]
}

/** Опорные цвета, от «ужасно» к «отлично». */
export const PALETTES: Palette[] = [
  { id: 'spectrum', name: 'Спектр', stops: ['#E3263A', '#9A3E9C', '#3559D6', '#8E8AA8', '#14A090', '#8FD14F', '#FFC53D'] },
  { id: 'sea', name: 'Море', stops: ['#1C2541', '#2E4A7D', '#3A7CA5', '#5FB3B3', '#A8D8C9', '#F1E3B8'] },
  { id: 'ember', name: 'Угли', stops: ['#2B1B17', '#7A2E1F', '#C2502E', '#E88B4D', '#F4C27A', '#FBEBC4'] },
  { id: 'meadow', name: 'Луг', stops: ['#6B1F2E', '#A5543A', '#C9A13B', '#A8C256', '#5DAA5C', '#2D7F5E'] },
  { id: 'neon', name: 'Неон', stops: ['#FF2D55', '#C03CFF', '#4D5BFF', '#00C2FF', '#00E59B', '#C6FF3D'] },
  { id: 'dusk', name: 'Сумерки', stops: ['#3B1E54', '#7B3F8C', '#C2577E', '#EF8A71', '#F7C59F', '#FFF1D6'] },
  { id: 'graphite', name: 'Графит', stops: ['#1E1E1E', '#4A4A48', '#7C7B77', '#AFADA6', '#DCD9D0'] }
]

const NAMES: Record<number, string[]> = {
  2: ['Плохо', 'Хорошо'],
  3: ['Плохо', 'Нормально', 'Хорошо'],
  4: ['Ужасно', 'Плохо', 'Хорошо', 'Отлично'],
  5: ['Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично'],
  6: ['Ужасно', 'Плохо', 'Так себе', 'Неплохо', 'Хорошо', 'Отлично'],
  7: ['Ужасно', 'Очень плохо', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'],
  8: ['Ужасно', 'Очень плохо', 'Плохо', 'Так себе', 'Нормально', 'Неплохо', 'Хорошо', 'Отлично'],
  9: ['Ужасно', 'Очень плохо', 'Плохо', 'Так себе', 'Нормально', 'Неплохо', 'Хорошо', 'Отлично', 'Лучший день'],
  10: ['Ужасно', 'Очень плохо', 'Плохо', 'Скорее плохо', 'Так себе', 'Нормально', 'Неплохо', 'Хорошо', 'Отлично', 'Лучший день']
}

export function defaultNames(n: number): string[] {
  return NAMES[n] ?? Array.from({ length: n }, (_, i) => `Уровень ${i + 1}`)
}

let counter = 0
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function paletteById(id: string): Palette {
  return PALETTES.find(p => p.id === id) ?? PALETTES[0]
}

export function makeLevels(n: number, paletteId = 'spectrum'): Level[] {
  const colors = rampColors(paletteById(paletteId).stops, n)
  return defaultNames(n).map((name, i) => ({ id: `l${i + 1}`, name, color: colors[i] }))
}

export const DEFAULT_TAGS = ['Спорт', 'Друзья', 'Учёба', 'Работа', 'Выспался', 'Прогулка', 'Семья', 'Свидание']

export function defaultData(now = Date.now()): Data {
  return {
    version: 1,
    levels: makeLevels(7),
    tags: DEFAULT_TAGS.map((name, i) => ({ id: `t${i + 1}`, name })),
    entries: {},
    settings: { theme: 'system', weekStart: 0, showDetails: true, yearLayout: 'months' },
    palette: 'spectrum',
    onboarded: false,
    createdAt: now
  }
}

/** Индекс уровня (0 — худший) или -1. */
export function levelIndex(data: Pick<Data, 'levels'>, id: string | undefined): number {
  if (!id) return -1
  return data.levels.findIndex(l => l.id === id)
}

/** Оценка дня от 0 до 1 (0 — худший уровень, 1 — лучший). */
export function scoreOf(data: Pick<Data, 'levels'>, id: string | undefined): number | null {
  const i = levelIndex(data, id)
  if (i < 0) return null
  return data.levels.length === 1 ? 1 : i / (data.levels.length - 1)
}

/** Ближайший уровень к оценке 0..1. */
export function levelAtScore(data: Pick<Data, 'levels'>, score: number): Level {
  const i = Math.round(score * (data.levels.length - 1))
  return data.levels[Math.min(data.levels.length - 1, Math.max(0, i))]
}

/**
 * Перекрасить шкалу по палитре, не трогая id и названия — отметки остаются на месте.
 */
export function recolor(levels: Level[], paletteId: string): Level[] {
  const colors = rampColors(paletteById(paletteId).stops, levels.length)
  return levels.map((l, i) => ({ ...l, color: colors[i] }))
}

/**
 * Удалить уровень: его отметки переходят к соседнему (ниже по шкале, а если это самый нижний — к следующему).
 */
export function removeLevel(data: Data, id: string): Data {
  const i = levelIndex(data, id)
  if (i < 0 || data.levels.length <= MIN_LEVELS) return data
  const target = data.levels[i > 0 ? i - 1 : 1].id
  const entries: Data['entries'] = {}
  for (const [k, e] of Object.entries(data.entries)) entries[k] = e.level === id ? { ...e, level: target } : e
  return { ...data, levels: data.levels.filter(l => l.id !== id), entries }
}

export function countByLevel(data: Data): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of data.levels) out[l.id] = 0
  for (const e of Object.values(data.entries)) if (e.level in out) out[e.level]++
  return out
}
