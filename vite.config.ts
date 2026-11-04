import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  base: '/mood-calendar/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Оттенки — дневник дней',
        short_name: 'Оттенки',
        description: 'Каждый день — один цвет. Календарь настроения.',
        lang: 'ru',
        start_url: '/mood-calendar/',
        scope: '/mood-calendar/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2EEE6',
        theme_color: '#F2EEE6',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: '/mood-calendar/index.html'
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
