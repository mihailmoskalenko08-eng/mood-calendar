// Состояние приложения: данные (сохраняются на устройстве), навигация, всплывающие уведомления.

import { batch, computed, effect, signal } from '@preact/signals'
import { parseKey, todayKey, type DayKey } from './lib/dates'
import {
  MAX_LEVELS, MAX_NOTE, MAX_TAGS, MIN_LEVELS, defaultNames, newId, recolor, removeLevel,
  type Data, type Entry, type Level, type Settings
} from './lib/model'
import { rampColors } from './lib/color'
import { paletteById } from './lib/model'
import { load, merge, save, STORAGE_KEY } from './lib/storage'

const initial = load()
export const data = signal<Data>(initial.data)
export const storageAvailable = initial.available
export const recoveredFromBackup = initial.recovered
/** Сохранённые данные не прочитались; они отложены в отдельный ключ, а запись выключена до решения пользователя. */
export const corruptStored = signal(initial.corrupt)
export const saveFailed = signal(false)

let timer: ReturnType<typeof setTimeout> | undefined
/** Не сохранять, пока данные из хранилища не удалось прочитать (чтобы не затереть их умолчаниями). */
let writable = storageAvailable && !initial.corrupt
effect(() => {
  const d = data.value
  clearTimeout(timer)
  if (!writable) return
  timer = setTimeout(() => { saveFailed.value = !save(d) }, 150)
})

/** Сохранить прямо сейчас, без задержки. */
export function flushSave() {
  clearTimeout(timer)
  if (writable) saveFailed.value = !save(data.value)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave() })
  window.addEventListener('pagehide', flushSave)
  // Изменения из другой вкладки — перечитать, чтобы не затереть их своей старой копией.
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY || !e.newValue) return
    const next = load()
    if (next.available && !next.corrupt) { clearTimeout(timer); data.value = next.data }
  })
}

// ——— Навигация ———

export type Tab = 'today' | 'month' | 'year' | 'stats' | 'settings'
export const tab = signal<Tab>('today')
/** Сегодняшний день; обновляется при возвращении в приложение после полуночи. */
export const today = signal<DayKey>(todayKey())
/** Выбранный день на главном экране. */
export const focusDay = signal<DayKey>(todayKey())
/** День, открытый в нижней панели (из месяца или года). */
export const sheetDay = signal<DayKey | null>(null)
/** Месяц, показанный на экране «Месяц». */
export const viewMonth = signal<{ y: number; m: number }>({ y: new Date().getFullYear(), m: new Date().getMonth() })
export const viewYear = signal<number>(new Date().getFullYear())

if (typeof window !== 'undefined') {
  const refreshDay = () => {
    const t = todayKey()
    if (t !== today.value) {
      batch(() => {
        const prev = parseKey(today.value), next = parseKey(t)
        if (focusDay.value === today.value) focusDay.value = t
        if (viewMonth.value.y === prev.getFullYear() && viewMonth.value.m === prev.getMonth()) {
          viewMonth.value = { y: next.getFullYear(), m: next.getMonth() }
        }
        if (viewYear.value === prev.getFullYear()) viewYear.value = next.getFullYear()
        today.value = t
      })
    }
  }
  document.addEventListener('visibilitychange', refreshDay)
  setInterval(refreshDay, 60_000)
}

export function go(t: Tab) {
  tab.value = t
  try { history.replaceState(null, '', `#${t}`) } catch { /* нет истории — не страшно */ }
}

// ——— Уведомления ———

export interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
}
export const toast = signal<Toast | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
export function showToast(text: string, action?: Toast['action'], ms = 5500) {
  clearTimeout(toastTimer)
  toast.value = { id: Date.now(), text, action }
  toastTimer = setTimeout(() => { toast.value = null }, ms)
}
export function hideToast() {
  clearTimeout(toastTimer)
  toast.value = null
}

// ——— Производные ———

export const levelsById = computed(() => new Map(data.value.levels.map(l => [l.id, l])))
export const tagsById = computed(() => new Map(data.value.tags.map(t => [t.id, t])))
export const markedCount = computed(() => Object.keys(data.value.entries).length)

export function levelOf(day: DayKey): Level | undefined {
  const e = data.value.entries[day]
  return e ? levelsById.value.get(e.level) : undefined
}

// ——— Изменения данных ———

function update(fn: (d: Data) => Data) {
  data.value = fn(data.value)
}

function setEntries(fn: (entries: Data['entries']) => Data['entries']) {
  update(d => ({ ...d, entries: fn(d.entries) }))
}

/** Отметить день цветом. Возвращает функцию отмены. */
export function mark(day: DayKey, levelId: string): () => void {
  const before = data.value.entries[day]
  setEntries(es => ({ ...es, [day]: { ...before, level: levelId, at: Date.now() } }))
  return () => setEntries(es => {
    const next = { ...es }
    if (before) next[day] = before
    else delete next[day]
    return next
  })
}

export function clearDay(day: DayKey): () => void {
  const before = data.value.entries[day]
  if (!before) return () => {}
  setEntries(es => {
    const next = { ...es }
    delete next[day]
    return next
  })
  return () => setEntries(es => ({ ...es, [day]: before }))
}

function patchEntry(day: DayKey, patch: (e: Entry) => Entry) {
  const e = data.value.entries[day]
  if (!e) return
  setEntries(es => ({ ...es, [day]: { ...patch(e), at: Date.now() } }))
}

export function setNote(day: DayKey, note: string) {
  const cur = data.value.entries[day]
  if (!cur || (cur.note ?? '') === (note.trim() ? note.slice(0, MAX_NOTE) : '')) return
  patchEntry(day, e => {
    const next = { ...e }
    const n = note.slice(0, MAX_NOTE)
    if (n.trim()) next.note = n
    else delete next.note
    return next
  })
}

export function toggleTag(day: DayKey, tagId: string) {
  patchEntry(day, e => {
    const has = e.tags?.includes(tagId)
    const tags = has ? e.tags!.filter(t => t !== tagId) : [...(e.tags ?? []), tagId]
    const next = { ...e }
    if (tags.length) next.tags = tags
    else delete next.tags
    return next
  })
}

// ——— Шкала ———

export function renameLevel(id: string, name: string) {
  update(d => ({ ...d, levels: d.levels.map(l => l.id === id ? { ...l, name: name.slice(0, 40) } : l) }))
}

export function setLevelColor(id: string, color: string) {
  update(d => ({ ...d, palette: 'custom', levels: d.levels.map(l => l.id === id ? { ...l, color: color.toUpperCase() } : l) }))
}

export function moveLevel(id: string, dir: -1 | 1) {
  update(d => {
    const i = d.levels.findIndex(l => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= d.levels.length) return d
    const levels = [...d.levels]
    ;[levels[i], levels[j]] = [levels[j], levels[i]]
    return { ...d, levels }
  })
}

export function deleteLevel(id: string) {
  update(d => removeLevel(d, id))
}

/** Добавить уровень вверху шкалы (лучший). Цвета перераспределяются по палитре, если она выбрана. */
export function addLevel() {
  update(d => {
    if (d.levels.length >= MAX_LEVELS) return d
    const n = d.levels.length + 1
    const names = defaultNames(n)
    const used = new Set(d.levels.map(l => l.name))
    const top = names[n - 1]
    const name = !used.has(top) ? top : !used.has('Лучший день') ? 'Лучший день' : 'Новый уровень'
    const color = d.palette !== 'custom' ? rampColors(paletteById(d.palette).stops, n)[n - 1] : '#888888'
    const levels = [...d.levels, { id: newId('l'), name, color }]
    return { ...d, levels: d.palette !== 'custom' ? recolor(levels, d.palette) : levels }
  })
}

export function applyPalette(id: string) {
  update(d => ({ ...d, palette: id, levels: recolor(d.levels, id) }))
}

/** Сбросить шкалу к стандартной на n уровней; старые отметки распределяются пропорционально. */
export function resetScale(n: number, paletteId: string) {
  n = Math.min(MAX_LEVELS, Math.max(MIN_LEVELS, n))
  update(d => {
    const colors = rampColors(paletteById(paletteId).stops, n)
    const levels = defaultNames(n).map((name, i) => ({ id: newId('l'), name, color: colors[i] }))
    const entries: Data['entries'] = {}
    for (const [k, e] of Object.entries(d.entries)) {
      const i = d.levels.findIndex(l => l.id === e.level)
      const t = d.levels.length > 1 ? i / (d.levels.length - 1) : 0
      entries[k] = { ...e, level: levels[Math.round(t * (n - 1))].id }
    }
    return { ...d, palette: paletteId, levels, entries }
  })
}

// ——— Метки ———

export function addTag(name: string): boolean {
  const n = name.trim().slice(0, 32)
  if (!n) return false
  const d = data.value
  if (d.tags.length >= MAX_TAGS || d.tags.some(t => t.name.toLowerCase() === n.toLowerCase())) return false
  update(x => ({ ...x, tags: [...x.tags, { id: newId('t'), name: n }] }))
  return true
}

export function renameTag(id: string, name: string) {
  const n = name.trim().slice(0, 32)
  if (!n) return
  update(d => ({ ...d, tags: d.tags.map(t => t.id === id ? { ...t, name: n } : t) }))
}

export function deleteTag(id: string): () => void {
  const before = data.value
  update(d => {
    const entries: Data['entries'] = {}
    for (const [k, e] of Object.entries(d.entries)) {
      if (e.tags?.includes(id)) {
        const tags = e.tags.filter(t => t !== id)
        const next = { ...e }
        if (tags.length) next.tags = tags
        else delete next.tags
        entries[k] = next
      } else entries[k] = e
    }
    return { ...d, tags: d.tags.filter(t => t.id !== id), entries }
  })
  return () => update(d => {
    // Вернуть метку и её отметки, не трогая остальные изменения
    const entries = { ...d.entries }
    for (const [k, e] of Object.entries(before.entries)) {
      if (e.tags?.includes(id) && entries[k] && !entries[k].tags?.includes(id)) {
        entries[k] = { ...entries[k], tags: [...(entries[k].tags ?? []), id] }
      }
    }
    const idx = before.tags.findIndex(t => t.id === id)
    const tags = [...d.tags]
    tags.splice(Math.min(idx, tags.length), 0, before.tags[idx])
    return { ...d, tags, entries }
  })
}

// ——— Настройки и данные ———

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  update(d => ({ ...d, settings: { ...d.settings, [key]: value } }))
}

export function finishOnboarding() {
  update(d => ({ ...d, onboarded: true }))
}

export function snoozeBackup(days = 7) {
  update(d => ({ ...d, backupSnoozed: Date.now() + days * 86400000 }))
}

export function markBackedUp() {
  update(d => ({ ...d, lastBackup: Date.now() }))
}

export function replaceAll(next: Data) {
  if (storageAvailable) { writable = true; corruptStored.value = false }
  data.value = { ...next, onboarded: true }
}

/** Начать с чистого листа поверх нечитаемых данных (они остаются отложенными в хранилище). */
export function startFresh() {
  if (storageAvailable) { writable = true; corruptStored.value = false }
  data.value = { ...data.value }
}

export function mergeIn(incoming: Data) {
  if (storageAvailable) { writable = true; corruptStored.value = false }
  update(d => merge(d, incoming))
}
