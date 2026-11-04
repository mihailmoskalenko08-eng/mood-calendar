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

render(<App />, document.getElementById('root')!)

// Работа без интернета. Обновление ставится само и применяется при следующем запуске.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {})
}
