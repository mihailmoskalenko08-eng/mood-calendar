import { render } from 'preact'
import '@fontsource-variable/onest/index.css'
import '@fontsource/cormorant-garamond/cyrillic-500.css'
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/cyrillic-500-italic.css'
import '@fontsource/cormorant-garamond/latin-500-italic.css'
import '@fontsource/cormorant-garamond/cyrillic-600.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import './styles.css'

async function start() {
  // В приложении на iPhone сначала поднимаем данные из системного хранилища, потом — всё остальное
  if (__NATIVE__) await (await import('./native')).prepareNative()
  const { App } = await import('./app')
  render(<App />, document.getElementById('root')!)
  if (!__NATIVE__) registerServiceWorker()
}
start()

// Работа без интернета. Новая версия скачивается в фоне. Перезагрузка — только когда приложение свёрнуто
// и никто не печатает; перед ней открытый день и время ухода запоминаются, чтобы вернуться туда же без кода.
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  const { flushSave, rememberSession, showToast } = await import('./state')
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
