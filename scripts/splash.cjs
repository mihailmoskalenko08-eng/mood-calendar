// Заставки запуска для iPhone (apple-touch-startup-image): node scripts/splash.cjs
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const devices = [
  [402, 874], [440, 956], [393, 852], [430, 932], [420, 912], [375, 812], [390, 844], [414, 896]
]
const font = fs.readFileSync(require.resolve('@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-500-italic.woff2')).toString('base64')
const icon = fs.readFileSync('public/icons/icon.svg', 'utf8').replace(/<rect width="512" height="512"[^>]*\/>/, '')

;(async () => {
  fs.mkdirSync('public/splash', { recursive: true })
  const b = await chromium.launch()
  const links = []
  for (const theme of ['light', 'dark']) {
    const bg = theme === 'light' ? '#F2EEE6' : '#121110'
    const ink = theme === 'light' ? '#1A1814' : '#EEE9DF'
    for (const [w, h] of devices) {
      const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 3 })
      await p.setContent(`<style>
        @font-face{font-family:C;src:url(data:font/woff2;base64,${font}) format('woff2');font-style:italic}
        html,body{margin:0;height:100%;background:${bg}}
        body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
        svg{width:96px;height:96px}
        p{margin:0;font:italic 500 44px C,serif;color:${ink};letter-spacing:-.01em}
      </style>${icon}<p>Оттенки</p>`)
      await p.evaluate(() => document.fonts.ready)
      const name = `splash-${w}x${h}-${theme}.png`
      await p.screenshot({ path: path.join('public/splash', name) })
      await p.close()
      links.push(`  <link rel="apple-touch-startup-image" href="/mood-calendar/splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: ${theme})" />`)
    }
  }
  await b.close()
  fs.writeFileSync('scripts/splash-links.html', links.join('\n') + '\n')
  console.log(links.length, 'splash screens')
})()
