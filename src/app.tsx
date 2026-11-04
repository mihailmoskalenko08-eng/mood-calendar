import { useEffect } from 'preact/hooks'
import { capitalize, compareKeys, humanDate, relativeLabel, WEEKDAYS, weekdayMon } from './lib/dates'
import {
  data, go, levelOf, recoveredFromBackup, saveFailed, sheetDay, showToast, storageAvailable, tab, today, type Tab
} from './state'
import { ClearDay, NoteField, ScalePicker, TagPicker } from './components/DayEditor'
import { IconMonth, IconMore, IconStats, IconToday, IconYear } from './components/icons'
import { Month } from './components/Month'
import { Onboarding } from './components/Onboarding'
import { Settings } from './components/Settings'
import { Stats } from './components/Stats'
import { Today } from './components/Today'
import { Sheet, ToastHost } from './components/ui'
import { Year } from './components/Year'

const TABS: { id: Tab; label: string; Icon: typeof IconToday }[] = [
  { id: 'today', label: 'День', Icon: IconToday },
  { id: 'month', label: 'Месяц', Icon: IconMonth },
  { id: 'year', label: 'Год', Icon: IconYear },
  { id: 'stats', label: 'Итоги', Icon: IconStats },
  { id: 'settings', label: 'Ещё', Icon: IconMore }
]

function applyTheme(theme: string) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const color = dark ? '#121110' : '#F2EEE6'
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', color))
}

export function App() {
  const d = data.value
  const theme = d.settings.theme

  useEffect(() => {
    applyTheme(theme)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme(theme)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [theme])

  useEffect(() => {
    const fromHash = location.hash.slice(1) as Tab
    if (TABS.some(t => t.id === fromHash)) tab.value = fromHash
    if (!storageAvailable) showToast('Браузер не даёт сохранять данные — отметки пропадут после закрытия', undefined, 8000)
    else if (recoveredFromBackup) showToast('Данные восстановлены из запасной копии', undefined, 6000)
    // Попросить браузер не очищать хранилище
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  useEffect(() => {
    if (saveFailed.value) showToast('Не удалось сохранить — память устройства переполнена?', undefined, 6000)
  }, [saveFailed.value])

  // Наверх при смене вкладки
  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab.value])

  const current = tab.value

  return (
    <>
      <main class="app" id="main">
        {current === 'today' && <Today />}
        {current === 'month' && <Month />}
        {current === 'year' && <Year />}
        {current === 'stats' && <Stats />}
        {current === 'settings' && <Settings />}
      </main>

      <nav class="tabbar" aria-label="Разделы">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} class={`tabbar-btn${current === id ? ' is-on' : ''}`} aria-current={current === id ? 'page' : undefined}
            onClick={() => go(id)}>
            <Icon size={24} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <DaySheet />
      <ToastHost />
      {!d.onboarded && <Onboarding />}
    </>
  )
}

function DaySheet() {
  const day = sheetDay.value
  const now = today.value
  const close = () => { sheetDay.value = null }
  const level = day ? levelOf(day) : undefined
  const future = day ? compareKeys(day, now) > 0 : false
  return (
    <Sheet open={!!day && !future} onClose={close} label="Отметка дня">
      {day && (
        <div class="sheet-body">
          <div class="eyebrow">{capitalize(WEEKDAYS[weekdayMon(day)])}{relativeLabel(day, now) ? ` · ${relativeLabel(day, now)}` : ''}</div>
          <h2 class="display sheet-title">{humanDate(day, now)}</h2>
          <ScalePicker day={day} compact />
          {level && (
            <div class="details">
              <NoteField day={day} />
              <TagPicker day={day} />
              <ClearDay day={day} after={close} />
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
