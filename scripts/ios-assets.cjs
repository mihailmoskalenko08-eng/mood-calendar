// Иконка и заставка для приложения на iPhone (ios/App): node scripts/ios-assets.cjs
const { chromium } = require('playwright')
const fs = require('node:fs')

const assets = 'ios/App/App/Assets.xcassets'
const full = fs.readFileSync('scripts/icon-full.svg', 'utf8')
const mosaic = fs.readFileSync('public/icons/icon.svg', 'utf8').replace(/<rect width="512" height="512"[^>]*\/>/, '')
const font = fs.readFileSync(require.resolve('@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-500-italic.woff2')).toString('base64')

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage()
  // Иконка 1024×1024 без скругления — iOS скругляет сама
  await p.setViewportSize({ width: 1024, height: 1024 })
  await p.setContent(`<style>html,body{margin:0}svg{display:block;width:1024px;height:1024px}</style>${full}`)
  await p.screenshot({ path: `${assets}/AppIcon.appiconset/AppIcon-512@2x.png` })
  // Заставка 2732×2732: бумажный фон, мозаика и название по центру (картинка заполняет экран по центру)
  await p.setViewportSize({ width: 2732, height: 2732 })
  await p.setContent(`<style>
    @font-face{font-family:C;src:url(data:font/woff2;base64,${font}) format('woff2');font-style:italic}
    html,body{margin:0;height:100%;background:#F2EEE6}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:64px}
    svg{width:300px;height:300px}
    p{margin:0;font:italic 500 132px C,serif;color:#1A1814}
  </style>${mosaic}<p>Оттенки</p>`)
  await p.evaluate(() => document.fonts.ready)
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await p.screenshot({ path: `${assets}/Splash.imageset/${name}` })
  }
  await b.close()
  console.log('ok')
})()
