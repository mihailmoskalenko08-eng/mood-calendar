// Сквозные проверки в браузере (Chromium, экран iPhone 17).
// Запуск: npm run build && npx vite preview --port 4173 & node scripts/e2e.cjs
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const BASE = process.env.BASE || 'http://localhost:4173/mood-calendar/'
const KEY = 'ottenki:data:v1'
let failed = 0

async function step(name, fn) {
  try {
    await fn()
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    console.log('  ✗ ' + name + '\n    ' + String(e.message || e).split('\n').slice(0, 6).join('\n    '))
  }
}

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const stored = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY)
  const today = await page.evaluate(() => {
    const d = new Date(); const p = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  })

  console.log('Оттенки — сквозные проверки')
  await page.goto(BASE)

  await step('знакомство: 5 цветов, палитра «Море»', async () => {
    await page.click('text=Дальше')
    for (let i = 0; i < 2; i++) await page.click('.onboard [aria-label="Меньше"]')
    await page.click('.onboard .palette:has-text("Море")')
    await page.click('text=Начать')
    await page.waitForTimeout(400)
    assert.equal(await page.locator('.scale-row').count(), 5)
    const d = await stored()
    assert.equal(d.onboarded, true)
    assert.equal(d.palette, 'sea')
  })

  await step('отметка дня и отмена', async () => {
    await page.click('.scale-row:has-text("Хорошо")')
    await page.waitForTimeout(300)
    let d = await stored()
    const lv = d.levels.find(l => l.name === 'Хорошо')
    assert.equal(d.entries[today].level, lv.id)
    await page.click('.toast button:has-text("Отменить")')
    await page.waitForTimeout(300)
    d = await stored()
    assert.equal(d.entries[today], undefined)
  })

  await step('заметка и метка сохраняются после перезагрузки', async () => {
    await page.click('.scale-row:has-text("Отлично")')
    await page.fill('.note textarea', 'Отличный день, всё получилось')
    await page.click('.tag:has-text("Спорт")')
    await page.waitForTimeout(600)
    await page.reload()
    await page.waitForTimeout(400)
    assert.equal(await page.inputValue('.note textarea'), 'Отличный день, всё получилось')
    assert.equal(await page.getAttribute('.tag:has-text("Спорт")', 'aria-pressed'), 'true')
  })

  await step('заметка не уходит в другой день при быстром переключении', async () => {
    await page.fill('.note textarea', 'Текст сегодняшнего дня')
    await page.click('[aria-label="Предыдущий день"]') // сразу, без паузы на сохранение
    await page.waitForTimeout(600)
    const d = await stored()
    assert.equal(d.entries[today].note, 'Текст сегодняшнего дня')
    const prev = Object.keys(d.entries).find(k => k < today)
    assert.equal(prev, undefined, 'у вчерашнего дня не должно появиться записи')
    assert.equal(await page.locator('.note textarea').count(), 0, 'у неотмеченного дня нет поля заметки')
    await page.click('[aria-label="Следующий день"]')
  })

  await step('заметка в фокусе не переезжает на другой день при нажатии в полосе недели', async () => {
    // вчера: отметить и написать заметку
    await page.click('[aria-label="Предыдущий день"]')
    await page.click('.scale-row:has-text("Нормально")')
    await page.fill('.note textarea', 'Вчерашняя заметка')
    await page.locator('.note textarea').blur()
    await page.click('[aria-label="Следующий день"]')
    // сегодня: начать печатать и, не убирая фокус, перейти на вчера
    await page.locator('.note textarea').click()
    await page.keyboard.type(' (дописал)')
    await page.locator('.week-day:not(.is-today):not(:disabled)').last().dispatchEvent('click')
    await page.waitForTimeout(100)
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.waitForTimeout(600)
    const d = await stored()
    const y = Object.keys(d.entries).find(k => k < today)
    assert.equal(d.entries[y].note, 'Вчерашняя заметка')
    assert.equal(d.entries[today].note, 'Текст сегодняшнего дня (дописал)')
    await page.click('[aria-label="Следующий день"]')
  })

  await step('текст в нижней панели сохраняется при мгновенном закрытии', async () => {
    await page.click('.tabbar-btn:has-text("Месяц")')
    await page.locator('.cal-cell.is-today').click()
    await page.waitForSelector('.sheet-wrap.is-open')
    await page.locator('.sheet .note textarea').click()
    await page.keyboard.type('!')
    await page.click('.sheet-close')
    await page.waitForTimeout(500)
    const d = await stored()
    assert.equal(d.entries[today].note, 'Текст сегодняшнего дня (дописал)!')
    await page.click('.tabbar-btn:has-text("День")')
  })

  await step('месяц: отметить день через нижнюю панель', async () => {
    await page.click('.tabbar-btn:has-text("Месяц")')
    const cell = page.locator('.cal-cell:not(.is-out):not(.is-future):not(.is-set)').first()
    const hasEmpty = await cell.count()
    if (!hasEmpty) {
      await page.click('[aria-label="Предыдущий месяц"]')
    }
    await page.locator('.cal-cell:not(.is-out):not(.is-future):not(.is-set)').first().click()
    await page.waitForSelector('.sheet-wrap.is-open')
    await page.click('.sheet .scale-row:has-text("Плохо")')
    await page.waitForTimeout(300)
    await page.click('.sheet-close')
    await page.waitForTimeout(450)
    assert.equal(await page.locator('.sheet-wrap').count(), 0)
    const d = await stored()
    assert.equal(Object.keys(d.entries).length, 3)
  })

  await step('месяц: картинка месяца', async () => {
    await page.click('.tabbar-btn:has-text("Месяц")')
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('text=Картинка месяца')])
    const file = path.join(os.tmpdir(), 'ottenki-month.png')
    await dl.saveAs(file)
    assert.ok(fs.statSync(file).size > 15000)
  })

  await step('год: оба вида и картинка', async () => {
    await page.click('.tabbar-btn:has-text("Год")')
    assert.ok(await page.locator('.ygrid .px.is-set').count() >= 1)
    await page.click('.segmented button:has-text("По неделям")')
    assert.ok(await page.locator('.wgrid .px.is-set').count() >= 1)
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('.pill-btn:has-text("Картинка")')])
    const file = path.join(os.tmpdir(), 'ottenki-poster.png')
    await dl.saveAs(file)
    assert.ok(fs.statSync(file).size > 20000, 'картинка подозрительно маленькая')
  })

  await step('итоги показывают данные', async () => {
    await page.click('.tabbar-btn:has-text("Итоги")')
    await page.click('.segmented button:has-text("Всё время")')
    await page.waitForSelector('.hero')
    assert.equal(await page.locator('.bars li').count(), 5)
    assert.ok((await page.textContent('.notes')).includes('Текст сегодняшнего дня'))
  })

  await step('настройки: переименовать, добавить и удалить уровень', async () => {
    await page.click('.tabbar-btn:has-text("Ещё")')
    const name = page.locator('.level-name').first()
    await name.fill('Восторг')
    await name.blur()
    await page.waitForTimeout(250)
    let d = await stored()
    assert.equal(d.levels[d.levels.length - 1].name, 'Восторг')
    await page.click('text=Уровень сверху')
    await page.waitForTimeout(250)
    d = await stored()
    assert.equal(d.levels.length, 6)
    // удалить «Восторг» (теперь второй сверху) — отметка переходит на уровень ниже
    const del = page.locator('.level-item').nth(1).locator('.danger')
    await del.click()
    await del.click()
    await page.waitForTimeout(250)
    d = await stored()
    assert.equal(d.levels.length, 5)
    assert.ok(d.levels.some(l => l.id === d.entries[today].level))
  })

  await step('метки: добавить и удалить', async () => {
    await page.fill('.add-tag input', 'Музыка')
    await page.click('.add-tag button')
    await page.waitForTimeout(200)
    let d = await stored()
    assert.ok(d.tags.some(t => t.name === 'Музыка'))
    await page.click('[aria-label="Удалить метку «Спорт»"]')
    await page.waitForTimeout(200)
    d = await stored()
    assert.ok(!d.tags.some(t => t.name === 'Спорт'))
    assert.equal(d.entries[today].tags, undefined)
  })

  await step('копия: сохранить, стереть всё, загрузить обратно', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Сохранить копию')])
    const file = path.join(os.tmpdir(), 'ottenki-backup.json')
    await dl.saveAs(file)
    const before = await stored()
    const erase = page.locator('text=Стереть все данные')
    await erase.click()
    await page.click('text=Нажмите ещё раз — всё будет стёрто')
    await page.waitForTimeout(250)
    assert.equal(Object.keys((await stored()).entries).length, 0)
    await page.setInputFiles('input[type=file]', file)
    await page.click('.import-box button:has-text("Объединить")')
    await page.waitForTimeout(250)
    const after = await stored()
    assert.deepEqual(Object.keys(after.entries).sort(), Object.keys(before.entries).sort())
    assert.equal(after.entries[today].note, before.entries[today].note)
  })

  await step('битый файл не ломает данные', async () => {
    const file = path.join(os.tmpdir(), 'ottenki-bad.json')
    fs.writeFileSync(file, '{"hello": "world"}')
    const before = await stored()
    await page.setInputFiles('input[type=file]', file)
    await page.waitForSelector('.toast.is-on')
    assert.deepEqual((await stored()).entries, before.entries)
  })

  await step('тёмная тема включается', async () => {
    await page.click('.segmented button:has-text("Тёмная")')
    await page.waitForTimeout(300)
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark')
    await page.waitForTimeout(400)
    await page.reload()
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark')
  })

  await step('код-пароль: задать, неверный и верный ввод, снять', async () => {
    await page.click('.tabbar-btn:has-text("Ещё")')
    await page.click('text=Задать код')
    for (const k of '1234') await page.click(`.pin-setup .key[aria-label="${k}"]`)
    await page.waitForTimeout(100)
    for (const k of '1234') await page.click(`.pin-setup .key[aria-label="${k}"]`)
    await page.waitForSelector('text=Код установлен', { timeout: 5000 })
    await page.reload()
    await page.waitForSelector('.lock')
    assert.equal(await page.locator('.lock-title').count(), 1)
    for (const k of '9999') await page.click(`.lock .key[aria-label="${k}"]`)
    await page.waitForSelector('text=Неверный код')
    await page.waitForTimeout(700)
    assert.equal(await page.locator('.lock').count(), 1)
    for (const k of '1234') await page.click(`.lock .key[aria-label="${k}"]`)
    await page.waitForSelector('.lock', { state: 'detached', timeout: 5000 })
    await page.click('.tabbar-btn:has-text("Ещё")')
    await page.click('text=Снять код')
    for (const k of '1234') await page.click(`.pin-setup .key[aria-label="${k}"]`)
    await page.waitForSelector('text=Код снят', { timeout: 5000 })
    await page.reload()
    await page.waitForTimeout(400)
    assert.equal(await page.locator('.lock').count(), 0)
  })

  await step('без ошибок в консоли', async () => {
    assert.deepEqual(errors, [])
  })

  await b.close()
  console.log(failed ? `\n${failed} провал(ов)` : '\nвсё прошло')
  process.exit(failed ? 1 : 0)
})()
