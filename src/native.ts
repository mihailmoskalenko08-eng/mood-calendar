// Приложение на iPhone (Capacitor): надёжное хранилище, «Поделиться» файлами, отклик, строка состояния.
// Модуль подгружается только в нативной сборке.

import { Filesystem, Directory } from '@capacitor/filesystem'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'
import { StatusBar, Style } from '@capacitor/status-bar'
import { saveHooks, STORAGE_KEY } from './lib/storage'

const MIRROR = 'ottenki:data:mirror'

/**
 * Перед запуском: если iOS очистила хранилище веб-вида (бывает при нехватке места), поднимаем данные из
 * системных настроек приложения. И дальше каждое сохранение дублируем туда же.
 */
export async function prepareNative() {
  try {
    const { value } = await Preferences.get({ key: MIRROR })
    let local: string | null = null
    try { local = localStorage.getItem(STORAGE_KEY) } catch { /* */ }
    if (value && !local) localStorage.setItem(STORAGE_KEY, value)
  } catch { /* без дубля тоже работает */ }
  let pending: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  saveHooks.push(json => {
    pending = json
    clearTimeout(timer)
    timer = setTimeout(() => { if (pending) Preferences.set({ key: MIRROR, value: pending }).catch(() => {}) }, 300)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pending) { clearTimeout(timer); Preferences.set({ key: MIRROR, value: pending }).catch(() => {}) }
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
