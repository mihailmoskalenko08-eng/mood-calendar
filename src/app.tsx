import { computed } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { CORRUPT_PREFIX } from './lib/storage'
import { shareOrDownload } from './lib/poster'
import { capitalize, compareKeys, humanDate, parseKey, relativeLabel, todayKey, WEEKDAYS, weekdayMon } from './lib/dates'
import {
  corruptStored, data, go, levelOf, recoveredFromBackup, saveFailed, sheetDay, showToast, startFresh, storageAvailable,
  tab, today, type Tab
} from './state'
import { ClearDay, NoteField, ScalePicker, TagPicker } from './components/DayEditor'
import { IconMonth, IconMore, IconStats, IconToday, IconYear } from './components/icons'
import { Month } from './components/Month'
import { LockScreen, locked, Shield, shielded } from './components/Lock'
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
  if (__NATIVE__) import('./native').then(m => m.setStatusBar(dark)).catch(() => {})
  // Тема отдельно от данных — чтобы экран входа в зашифрованный дневник сразу был нужного цвета
  try { localStorage.setItem('ottenki:theme', theme) } catch { /* */ }
}

// App подписан только на тему и знакомство — правка заметки не перерисовывает всё приложение.
const themeSig = computed(() => data.value.settings.theme)
const onboardedSig = computed(() => data.value.onboarded)
const todayColor = computed(() => levelOf(today.value)?.color)

export function App() {
  const theme = themeSig.value

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

  // Наверх при смене вкладки
  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab.value])

  const current = tab.value

  return (
    <>
      {!locked.value && <>
      <main class="app" id="main">
        <StorageBanners />
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
            {id === 'today' ? <IconToday size={24} dot={todayColor.value} /> : <Icon size={24} />}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <DaySheet />
      </>}
      <ToastHost />
      {!onboardedSig.value && !corruptStored.value && !locked.value && <Onboarding />}
      {locked.value && <LockScreen />}
      {shielded.value && !locked.value && <Shield />}
    </>
  )
}

function DaySheet() {
  // Пока панель уезжает вниз, показываем в ней последний открытый день, а не пустоту
  const last = useRef<string | null>(null)
  if (sheetDay.value) last.current = sheetDay.value
  const open = !!sheetDay.value
  const day = sheetDay.value ?? last.current
  const now = today.value
  const close = () => { sheetDay.value = null }
  const level = day ? levelOf(day) : undefined
  const future = day ? compareKeys(day, now) > 0 : false
  return (
    <Sheet open={open && !future} onClose={close} label="Отметка дня">
      {day && (
        <div class="sheet-body">
          <div class="eyebrow">{capitalize(WEEKDAYS[weekdayMon(day)])}{relativeLabel(day, now) ? ` · ${relativeLabel(day, now)}` : ''}</div>
          <h2 class="display sheet-title">
            <span class="today-num">{parseKey(day).getDate()}</span>
            <span class="today-month">{humanDate(day, now).replace(/^\d+ /, '')}</span>
          </h2>
          <ScalePicker day={day} compact />
          {level && (
            <div class="details">
              <NoteField key={day} day={day} />
              <TagPicker day={day} />
              <ClearDay day={day} after={close} />
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** Постоянные предупреждения о хранилище: пока проблема не решена, они не исчезают. */
function StorageBanners() {
  if (corruptStored.value) {
    const download = () => {
      const raw: string[] = []
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!
          if (k.startsWith(CORRUPT_PREFIX)) raw.push(localStorage.getItem(k) ?? '')
        }
      } catch { /* */ }
      const blob = new Blob([raw.join('\n\n')], { type: 'application/json' })
      shareOrDownload(blob, `ottenki-raw-${todayKey()}.json`, 'Данные «Оттенков»')
    }
    return (
      <div class="banner" role="alert">
        <p>Сохранённые отметки не удалось прочитать. Они не удалены — их можно скачать и попробовать загрузить в «Ещё → Данные».</p>
        <div class="row-actions">
          <button class="pill-btn" onClick={download}>Скачать данные</button>
          <button class="pill-btn ghost" onClick={startFresh}>Начать заново</button>
        </div>
      </div>
    )
  }
  if (saveFailed.value) {
    return (
      <div class="banner" role="alert">
        <p>Не получается сохранить отметки — похоже, на устройстве кончилось место. Сохраните копию в «Ещё → Данные», чтобы ничего не потерять.</p>
      </div>
    )
  }
  return null
}
