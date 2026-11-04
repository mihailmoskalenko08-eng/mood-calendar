// Скриншоты на размере iPhone 17 (402×874): node scripts/shots.cjs [dark]
// Нужен запущенный `npx vite preview --port 4173`.
const { chromium } = require('playwright')
const fs = require('node:fs')

const BASE = 'http://localhost:4173/mood-calendar/'
const dark = process.argv.includes('dark')
const scale = Number(process.env.DPR || 1)

function demo() {
  const levels = [
    ['l1', 'Ужасно', '#E3263A'], ['l2', 'Очень плохо', '#9A3E9C'], ['l3', 'Плохо', '#3559D6'],
    ['l4', 'Так себе', '#8E8AA8'], ['l5', 'Нормально', '#14A090'], ['l6', 'Хорошо', '#8FD14F'], ['l7', 'Отлично', '#FFC53D']
  ].map(([id, name, color]) => ({ id, name, color }))
  const tags = ['Спорт', 'Друзья', 'Учёба', 'Работа', 'Выспался', 'Прогулка', 'Семья', 'Свидание'].map((name, i) => ({ id: 't' + (i + 1), name }))
  let s = 42
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const notes = ['Долго гуляли у реки, наконец-то солнце', 'Сдал лабу с первого раза!', 'Голова весь день болела', 'Кино с друзьями, потом шаурма в 2 ночи', 'Просто спокойный день', 'Поругались, потом помирились', 'Тренировка зашла, есть силы', 'Дедлайн, кофе, снова дедлайн']
  const entries = {}
  let mood = 4
  const end = new Date(2026, 10, 3)
  for (let d = new Date(2026, 0, 1); d <= end; d.setDate(d.getDate() + 1)) {
    if (rnd() < 0.08) continue
    const wd = (d.getDay() + 6) % 7
    mood += (rnd() - 0.5) * 2.2 + (wd >= 5 ? 0.35 : -0.1) + (4.3 - mood) * 0.25
    const lv = Math.max(0, Math.min(6, Math.round(mood)))
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    const e = { level: levels[lv].id, at: d.getTime() }
    const t = tags.filter((_, i) => rnd() < (i === 0 ? 0.3 + lv * 0.05 : 0.18)).map(x => x.id)
    if (t.length) e.tags = t
    if (rnd() < 0.15) e.note = notes[Math.floor(rnd() * notes.length)]
    entries[key] = e
  }
  return { version: 1, levels, tags, entries, settings: { theme: dark ? 'dark' : 'light', weekStart: 0, showDetails: true, yearLayout: 'months' }, palette: 'spectrum', onboarded: true, createdAt: Date.now() }
}

;(async () => {
  fs.mkdirSync('shots', { recursive: true })
  const b = await chromium.launch()
  const ctx = await b.newContext({
    viewport: { width: 402, height: 874 }, deviceScaleFactor: scale, isMobile: true, hasTouch: true,
    colorScheme: dark ? 'dark' : 'light',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
  })
  await ctx.addInitScript(() => {
    const fixed = new Date(2026, 10, 4, 21, 30).getTime()
    const RealDate = Date
    class FakeDate extends RealDate {
      constructor(...a) { if (a.length) super(...a); else super(fixed) }
      static now() { return fixed }
    }
    globalThis.Date = FakeDate
  })
  const errors = []
  let page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(String(e)))
  const suffix = dark ? '-dark' : ''

  // Знакомство (пустые данные)
  await page.goto(BASE)
  await page.waitForTimeout(2800)
  await page.screenshot({ path: `shots/00-onboard${suffix}.png` })
  await page.click('.onboard .cta')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `shots/01-onboard2${suffix}.png` })
  await page.click('text=Начать')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `shots/02-today-empty${suffix}.png` })

  // С демо-данными
  await page.close()
  const page2 = await ctx.newPage()
  page2.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page2.on('pageerror', e => errors.push(String(e)))
  await page2.addInitScript(d => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('ottenki:data:v1', JSON.stringify(d))
      sessionStorage.setItem('seeded', '1')
    }
  }, demo())
  page = page2
  await page.goto(BASE + '#today')
  await page.waitForTimeout(900)
  await page.screenshot({ path: `shots/03-today${suffix}.png` })
  await page.click('.scale-row >> nth=1')
  await page.waitForTimeout(900)
  await page.screenshot({ path: `shots/04-today-picked${suffix}.png`, fullPage: true })

  for (const [tab, name] of [['month', '05-month'], ['year', '06-year'], ['stats', '07-stats'], ['settings', '09-settings']]) {
    await page.click(`.tabbar-btn >> nth=${['today', 'month', 'year', 'stats', 'settings'].indexOf(tab)}`)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `shots/${name}${suffix}.png`, fullPage: true })
  }
  // Нижняя панель дня
  await page.click('.tabbar-btn >> nth=1')
  await page.waitForTimeout(600)
  await page.click('.cal-cell.is-set >> nth=1')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `shots/08-sheet${suffix}.png` })

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
  await b.close()
})()
