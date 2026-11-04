// Хранение на устройстве и резервные копии. Всё, что приходит снаружи (файл, старая версия), проверяется.

import { isHex } from './color'
import { isValidKey } from './dates'
import {
  defaultData, MAX_LEVELS, MAX_NOTE, MAX_TAGS, MIN_LEVELS, PALETTES,
  type Data, type Entry, type Level, type Settings, type Tag
} from './model'

export const STORAGE_KEY = 'ottenki:data:v1'
const BACKUP_KEY = 'ottenki:data:prev'

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

/** Привести произвольный объект к корректным данным. Бросает ошибку, если это совсем не наши данные. */
export function sanitize(raw: unknown): Data {
  if (!raw || typeof raw !== 'object') throw new Error('Файл не похож на копию «Оттенков»')
  const r = raw as Record<string, unknown>
  const base = defaultData()

  // Шкала
  const levels: Level[] = []
  const seenLevel = new Set<string>()
  if (Array.isArray(r.levels)) {
    for (const l of r.levels as Record<string, unknown>[]) {
      if (!l || typeof l !== 'object') continue
      const id = str(l.id, 64)
      const name = str(l.name, 40)
      if (!id || !name || seenLevel.has(id) || !isHex(l.color)) continue
      seenLevel.add(id)
      levels.push({ id, name, color: (l.color as string).toUpperCase() })
      if (levels.length === MAX_LEVELS) break
    }
  }
  if (levels.length < MIN_LEVELS) {
    if (Array.isArray(r.levels)) throw new Error('В копии повреждена шкала цветов')
    throw new Error('Файл не похож на копию «Оттенков»')
  }

  // Метки
  const tags: Tag[] = []
  const seenTag = new Set<string>()
  if (Array.isArray(r.tags)) {
    for (const t of r.tags as Record<string, unknown>[]) {
      if (!t || typeof t !== 'object') continue
      const id = str(t.id, 64)
      const name = str(t.name, 32)
      if (!id || !name || seenTag.has(id)) continue
      seenTag.add(id)
      tags.push({ id, name })
      if (tags.length === MAX_TAGS) break
    }
  }

  // Записи
  const entries: Record<string, Entry> = {}
  if (r.entries && typeof r.entries === 'object') {
    for (const [k, v] of Object.entries(r.entries as Record<string, unknown>)) {
      if (!isValidKey(k) || !v || typeof v !== 'object') continue
      const e = v as Record<string, unknown>
      if (typeof e.level !== 'string' || !seenLevel.has(e.level)) continue
      const entry: Entry = { level: e.level, at: typeof e.at === 'number' && isFinite(e.at) ? e.at : Date.now() }
      const note = typeof e.note === 'string' ? e.note.slice(0, MAX_NOTE) : ''
      if (note.trim()) entry.note = note
      if (Array.isArray(e.tags)) {
        const t = [...new Set((e.tags as unknown[]).filter((x): x is string => typeof x === 'string' && seenTag.has(x)))]
        if (t.length) entry.tags = t
      }
      entries[k] = entry
    }
  }

  // Настройки
  const s = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Partial<Record<keyof Settings, unknown>>
  const settings: Settings = {
    theme: s.theme === 'light' || s.theme === 'dark' || s.theme === 'system' ? s.theme : base.settings.theme,
    weekStart: s.weekStart === 6 ? 6 : 0,
    showDetails: typeof s.showDetails === 'boolean' ? s.showDetails : base.settings.showDetails,
    yearLayout: s.yearLayout === 'weeks' ? 'weeks' : 'months'
  }

  const palette = typeof r.palette === 'string' && (PALETTES.some(p => p.id === r.palette) || r.palette === 'custom')
    ? r.palette : 'custom'

  return {
    version: 1,
    levels,
    tags,
    entries,
    settings,
    palette,
    onboarded: r.onboarded !== false,
    lastBackup: typeof r.lastBackup === 'number' ? r.lastBackup : undefined,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now()
  }
}

export interface Store {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

function safeStore(): Store | null {
  try {
    const s = globalThis.localStorage
    const probe = '__ottenki_probe'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function load(store: Store | null = safeStore()): { data: Data; recovered: boolean; available: boolean } {
  if (!store) return { data: defaultData(), recovered: false, available: false }
  for (const key of [STORAGE_KEY, BACKUP_KEY]) {
    const raw = store.getItem(key)
    if (!raw) continue
    try {
      return { data: sanitize(JSON.parse(raw)), recovered: key === BACKUP_KEY, available: true }
    } catch {
      /* пробуем запасную копию */
    }
  }
  return { data: defaultData(), recovered: false, available: true }
}

let lastSaved = ''
export function save(data: Data, store: Store | null = safeStore()): boolean {
  if (!store) return false
  const json = JSON.stringify(data)
  if (json === lastSaved) return true
  try {
    // Предыдущая версия остаётся запасной — если запись оборвётся, данные не пропадут.
    const prev = store.getItem(STORAGE_KEY)
    if (prev) store.setItem(BACKUP_KEY, prev)
    store.setItem(STORAGE_KEY, json)
    lastSaved = json
    return true
  } catch {
    return false
  }
}

/** Слияние копии с текущими данными: шкала и метки берутся из копии, записи — более свежие. */
export function merge(current: Data, incoming: Data): Data {
  const entries = { ...current.entries }
  const levelIds = new Set(incoming.levels.map(l => l.id))
  // Записи текущих данных с уровнями, которых нет в копии, переносим на ближайший по положению уровень.
  for (const [k, e] of Object.entries(entries)) {
    if (!levelIds.has(e.level)) {
      const i = current.levels.findIndex(l => l.id === e.level)
      const t = current.levels.length > 1 ? i / (current.levels.length - 1) : 0
      const target = incoming.levels[Math.round(t * (incoming.levels.length - 1))]
      entries[k] = { ...e, level: target.id }
    }
  }
  const tagIds = new Set(incoming.tags.map(t => t.id))
  const extraTags = current.tags.filter(t => !tagIds.has(t.id))
  for (const [k, e] of Object.entries(incoming.entries)) {
    const mine = entries[k]
    if (!mine || e.at >= mine.at) entries[k] = e
  }
  return {
    ...current,
    levels: incoming.levels,
    palette: incoming.palette,
    tags: [...incoming.tags, ...extraTags].slice(0, MAX_TAGS),
    entries
  }
}

export function exportJson(data: Data): string {
  return JSON.stringify({ app: 'ottenki', exportedAt: new Date().toISOString(), ...data }, null, 2)
}

function csvCell(s: string): string {
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCsv(data: Data): string {
  const rows = [['дата', 'уровень', 'номер', 'цвет', 'метки', 'заметка']]
  const keys = Object.keys(data.entries).sort()
  for (const k of keys) {
    const e = data.entries[k]
    const i = data.levels.findIndex(l => l.id === e.level)
    const l = data.levels[i]
    const tags = (e.tags ?? []).map(id => data.tags.find(t => t.id === id)?.name).filter(Boolean).join(', ')
    rows.push([k, l?.name ?? '', String(i + 1), l?.color ?? '', tags, e.note ?? ''])
  }
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n')
}
