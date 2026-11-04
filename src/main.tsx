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
import { flushSave, showToast } from './state'

render(<App />, document.getElementById('root')!)

// Работа без интернета. Новая версия скачивается в фоне; применяется, когда приложение свёрнуто,
// или сразу — по кнопке в уведомлении. Перед перезагрузкой несохранённая заметка записывается (pagehide).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    let ready = false
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        ready = true
        showToast('Есть новая версия', { label: 'Обновить', run: () => { flushSave(); update(true) } }, 10000)
      },
      onRegisteredSW(_url, reg) {
        // iPhone держит приложение в памяти неделями — проверяем обновления при каждом возвращении
        if (reg) document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
      }
    })
    document.addEventListener('visibilitychange', () => {
      if (ready && document.visibilityState === 'hidden') { flushSave(); update(true) }
    })
  }).catch(() => {})
}
