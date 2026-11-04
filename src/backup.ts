// Сохранение и чтение копий — общий код для настроек, знакомства и напоминания на главном экране.

import { todayKey } from './lib/dates'
import type { Data } from './lib/model'
import { shareOrDownload, sharePending } from './lib/poster'
import { exportCsv, exportJson, sanitize } from './lib/storage'
import { data, markBackedUp, showToast } from './state'

export async function saveBackup(kind: 'json' | 'csv' = 'json'): Promise<boolean> {
  const d = data.value
  const text = kind === 'json' ? exportJson(d) : exportCsv(d)
  const blob = new Blob([text], { type: kind === 'json' ? 'application/json' : 'text/csv' })
  const r = await shareOrDownload(blob, `ottenki-${todayKey()}.${kind}`, 'Копия «Оттенков»')
  if (r === 'cancelled') return false
  if (r === 'needs-tap') { showToast('Копия готова', { label: 'Сохранить', run: () => { sharePending(); markBackedUp() } }, 10000); return false }
  if (kind === 'json') markBackedUp()
  if (r === 'downloaded') showToast(`Копия скачана: ottenki-${todayKey()}.${kind}. На iPhone она в «Файлах» → «Загрузки» — лучше перенести в iCloud Drive`, undefined, 8000)
  else showToast('Копия сохранена')
  return true
}

/** Прочитать файл копии. Бросает ошибку с понятным текстом. */
export async function readBackup(file: File): Promise<Data> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Файл слишком большой')
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error('Это не файл копии (нужен .json из «Оттенков»)')
  }
  return sanitize(json)
}

export { backupDue } from './lib/storage'
