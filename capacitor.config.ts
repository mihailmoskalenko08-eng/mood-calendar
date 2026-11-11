import type { CapacitorConfig } from '@capacitor/cli'

// Нативная оболочка для iPhone: та же веб-сборка, собранная с base '/' (см. vite.config.ts, NATIVE=1).
const config: CapacitorConfig = {
  appId: 'io.github.mihailmoskalenko08.ottenki',
  appName: 'Оттенки',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#F2EEE6',
    scrollEnabled: true
  }
}

export default config
