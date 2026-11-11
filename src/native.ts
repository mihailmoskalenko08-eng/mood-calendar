// Приложение на iPhone (Capacitor): надёжное хранилище, «Поделиться» файлами, отклик, строка состояния.
// Модуль подгружается только в нативной сборке.

import { Filesystem, Directory } from '@capacitor/filesystem'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'
import { StatusBar, Style } from '@capacitor/status-bar'
import { LocalNotifications } from '@capacitor/local-notifications'
import { saveHooks, STORAGE_KEY } from './lib/storage'

const MIRROR = 'ottenki:data:mirror'
/** Открытый дубль данных выключается, когда данные зашифрованы. */
let plainMirror = true
export function setPlainMirror(on: boolean) { plainMirror = on }

/**
 * Перед запуском: если iOS очистила хранилище веб-вида (бывает при нехватке места), поднимаем данные из
 * системных настроек приложения. И дальше каждое сохранение дублируем туда же.
 */
export async function prepareNative(encrypted: boolean) {
  plainMirror = !encrypted
  if (!encrypted) try {
    const { value } = await Preferences.get({ key: MIRROR })
    let local: string | null = null
    try { local = localStorage.getItem(STORAGE_KEY) } catch { /* */ }
    if (value && !local) localStorage.setItem(STORAGE_KEY, value)
  } catch { /* без дубля тоже работает */ }
  let pending: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  saveHooks.push(json => {
    if (!plainMirror) return
    pending = json
    clearTimeout(timer)
    timer = setTimeout(() => { if (pending) Preferences.set({ key: MIRROR, value: pending }).catch(() => {}) }, 300)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pending && plainMirror) { clearTimeout(timer); Preferences.set({ key: MIRROR, value: pending }).catch(() => {}) }
  })
}

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})

/** Отдать файл через системное «Поделиться»: «Сохранить в Файлы», AirDrop, мессенджеры. */
export async function shareFileNative(blob: Blob, filename: string, title: string): Promise<'shared' | 'cancelled'> {
  const data = await toBase64(blob)
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
  try {
    await Share.share({ title, files: [uri] })
    return 'shared'
  } catch (e) {
    const msg = String((e as Error)?.message ?? e)
    if (/cancel/i.test(msg)) return 'cancelled'
    throw e
  }
}

export function hapticNative() {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

/** Цвет часов и батареи под тему приложения. */
export function setStatusBar(dark: boolean) {
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
}

// ——— Напоминание по вечерам ———
// Уведомления планируются на две недели вперёд, по одному на день; уже отмеченные дни пропускаются.
// План обновляется при каждом изменении данных и при возвращении в приложение.

const REMINDER_BASE = 7000
const DAYS_AHEAD = 14
const PHRASES = [
  'Как прошёл день?',
  'Каким цветом был сегодняшний день?',
  'Минутка на себя: отметьте день',
  'Какой оттенок у сегодняшнего дня?',
  'День подходит к концу — каким он был?'
]

export async function reminderPermission(ask: boolean): Promise<boolean> {
  try {
    const cur = await LocalNotifications.checkPermissions()
    if (cur.display === 'granted') return true
    if (!ask) return false
    return (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch {
    return false
  }
}

async function planReminders(settings: { on: boolean; time: string }, marked: Set<string>) {
  const ids = Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => ({ id: REMINDER_BASE + i }))
  await LocalNotifications.cancel({ notifications: ids }).catch(() => {})
  if (!settings.on || !(await reminderPermission(false))) return
  const [h, m] = settings.time.split(':').map(Number)
  const now = new Date()
  const list = []
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0)
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
    if (at.getTime() <= now.getTime() + 30_000 || marked.has(key)) continue
    list.push({
      id: REMINDER_BASE + i,
      title: 'Оттенки',
      body: PHRASES[(at.getDate() + at.getMonth()) % PHRASES.length],
      schedule: { at, allowWhileIdle: true }
    })
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list }).catch(() => {})
}

/** Следить за данными и держать план напоминаний актуальным. */
export async function startReminders() {
  const { effect } = await import('@preact/signals')
  const { data } = await import('./state')
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastKey = ''
  const run = () => {
    const d = data.value
    const marked = new Set(Object.keys(d.entries))
    const t = new Date()
    const todayKey = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    const key = JSON.stringify([d.settings.reminder, todayKey, [...marked].filter(k => k >= todayKey).sort()])
    if (key === lastKey) return
    lastKey = key
    planReminders(d.settings.reminder, marked)
  }
  effect(() => {
    void data.value
    clearTimeout(timer)
    timer = setTimeout(run, 800)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { lastKey = ''; run() }
  })
}

// ——— Виджет ———
// В сборке с виджетом приложение отдаёт ему цвета последних шести недель (без заметок).
// В обычной сборке плагина нет — вызов просто не срабатывает.

interface WidgetBridgePlugin { update(o: { json: string }): Promise<{ ok: boolean; group: string }> }

export async function startWidget() {
  const { registerPlugin } = await import('@capacitor/core')
  const { effect } = await import('@preact/signals')
  const { data } = await import('./state')
  const { currentStreak } = await import('./lib/stats')
  const { addDays, todayKey } = await import('./lib/dates')
  const bridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = ''
  const push = () => {
    const d = data.value
    const today = todayKey()
    const byId = new Map(d.levels.map(l => [l.id, l]))
    const days: Record<string, { c: string; n: string }> = {}
    for (let i = 0; i < 42; i++) {
      const k = addDays(today, -i)
      const e = d.entries[k]
      const l = e ? byId.get(e.level) : undefined
      if (l) days[k] = { c: l.color, n: l.name }
    }
    const json = JSON.stringify({ days, streak: currentStreak(d, today) })
    if (json === last) return
    last = json
    bridge.update({ json }).catch(() => {})
  }
  effect(() => {
    void data.value
    clearTimeout(timer)
    timer = setTimeout(push, 1000)
  })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { last = ''; push() } })
}
