import { render } from 'preact'
import '@fontsource-variable/onest/index.css'
import '@fontsource/cormorant-garamond/cyrillic-500.css'
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/cyrillic-500-italic.css'
import '@fontsource/cormorant-garamond/latin-500-italic.css'
import '@fontsource/cormorant-garamond/cyrillic-600.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import './styles.css'
import { App } from './app'
import { flushSave, rememberSession, showToast } from './state'

render(<App />, document.getElementById('root')!)

// Работа без интернета. Новая версия скачивается в фоне. Перезагрузка — только когда приложение свёрнуто
// и никто не печатает; перед ней открытый день и время ухода запоминаются, чтобы вернуться туда же без кода.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    let ready = false
    let reloadPending = false
    let userAsked = false
    const typing = () => !!(document.activeElement as HTMLElement | null)?.closest?.('input, textarea')
    const safeReload = () => {
      if (userAsked || (document.visibilityState === 'hidden' && !typing())) { rememberSession(); flushSave(); location.reload() }
      else reloadPending = true
    }
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        ready = true
        showToast('Есть новая версия', { label: 'Обновить', run: () => { userAsked = true; flushSave(); update(true) } }, 10000)
      },
      onNeedReload: safeReload,
      onRegisteredSW(_url, reg) {
        // iPhone держит приложение в памяти неделями — проверяем обновления при каждом возвращении
        if (reg) document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
      }
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return
      if (reloadPending) safeReload()
      else if (ready && !typing()) { flushSave(); update(true) }
    })
  }).catch(() => {})
}
