// Картинка года для «Поделиться»: холст 1080×1920 (сторис) с сеткой месяцев и легендой.

import { daysInMonth, keyOf, monthGrid, MONTHS, plural, ROMAN, WEEKDAYS_SHORT, weekdayOrder } from './dates'
import type { Data } from './model'

export interface PosterTheme {
  bg: string
  ink: string
  muted: string
  empty: string
}

export async function renderPoster(data: Data, year: number, theme: PosterTheme): Promise<Blob> {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  await loadFonts()

  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, W, H)

  const serif = '"Cormorant Garamond", Georgia, serif'
  const sans = '"Onest Variable", system-ui, sans-serif'

  ctx.fillStyle = theme.muted
  ctx.font = `italic 500 52px ${serif}`
  ctx.fillText('Оттенки', 96, 150)
  ctx.fillStyle = theme.ink
  ctx.font = `500 230px ${serif}`
  ctx.fillText(String(year), 84, 360)

  const byId = new Map(data.levels.map(l => [l.id, l]))
  const levels = [...data.levels].reverse()
  const cols = levels.length > 5 ? 2 : 1
  const perCol = Math.ceil(levels.length / cols)
  const legendH = perCol * 52
  const left = 150, top = 470, gridW = W - left - 96
  const gap = 7
  const cell = Math.floor((gridW - gap * 11) / 12)
  const gridBottom = H - 120 - legendH - 60
  const rowH = Math.min(cell, Math.floor((gridBottom - top - gap * 30) / 31))
  const r = Math.min(8, rowH / 4)

  ctx.font = `italic 500 34px ${serif}`
  ctx.textAlign = 'center'
  ctx.fillStyle = theme.muted
  for (let m = 0; m < 12; m++) ctx.fillText(ROMAN[m], left + m * (cell + gap) + cell / 2, top - 22)
  ctx.textAlign = 'right'
  ctx.font = `400 24px ${sans}`
  for (let dd = 1; dd <= 31; dd++) {
    if (dd === 1 || dd % 5 === 0) ctx.fillText(String(dd), left - 22, top + (dd - 1) * (rowH + gap) + rowH * 0.72)
  }

  let marked = 0
  for (let m = 0; m < 12; m++) {
    const n = daysInMonth(year, m)
    for (let dd = 1; dd <= n; dd++) {
      const e = data.entries[keyOf(year, m, dd)]
      const l = e ? byId.get(e.level) : undefined
      if (l) marked++
      ctx.fillStyle = l ? l.color : theme.empty
      roundRect(ctx, left + m * (cell + gap), top + (dd - 1) * (rowH + gap), cell, rowH, r)
      ctx.fill()
    }
  }

  // Легенда: от лучшего к худшему, в две колонки
  const legendTop = top + 31 * (rowH + gap) + 64
  ctx.textAlign = 'left'
  ctx.font = `400 32px ${sans}`
  levels.forEach((l, i) => {
    const col = Math.floor(i / perCol), row = i % perCol
    const x = 96 + col * 460, y = legendTop + row * 52
    ctx.fillStyle = l.color
    roundRect(ctx, x, y - 26, 30, 30, 8)
    ctx.fill()
    ctx.fillStyle = theme.ink
    ctx.fillText(l.name, x + 50, y, 400)
  })

  ctx.fillStyle = theme.muted
  ctx.font = `400 28px ${sans}`
  ctx.fillText(`${marked} ${plural(marked, 'день', 'дня', 'дней')} в цвете`, 96, H - 80)

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Не удалось нарисовать картинку'))), 'image/png'))
}

/** Картинка месяца 1080×1920: крупное название, сетка дней в цвете, сколько каких дней. */
export async function renderMonthPoster(data: Data, y: number, m: number, theme: PosterTheme): Promise<Blob> {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  await loadFonts()
  const serif = '"Cormorant Garamond", Georgia, serif'
  const sans = '"Onest Variable", system-ui, sans-serif'
  const byId = new Map(data.levels.map(l => [l.id, l]))

  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = theme.muted
  ctx.font = `italic 500 52px ${serif}`
  ctx.fillText('Оттенки', 96, 150)
  ctx.font = `500 40px ${sans}`
  ctx.textAlign = 'right'
  ctx.fillText(String(y), W - 96, 150)
  ctx.textAlign = 'left'
  const weeks = monthGrid(y, m, data.settings.weekStart)
  const gap = 16
  const cell = Math.floor((W - 192 - gap * 6) / 7)
  // Композиция по центру между шапкой и подвалом
  const usedCount = new Set(weeks.flat().filter(Boolean).map(k => data.entries[k!]?.level).filter(Boolean)).size
  const contentH = 370 + weeks.length * (cell + gap) + 80 + Math.ceil(usedCount / 2) * 60
  const startY = Math.max(200, Math.round((H - contentH) / 2) - 20)
  ctx.fillStyle = theme.ink
  ctx.font = `500 190px ${serif}`
  const name = MONTHS[m].charAt(0).toUpperCase() + MONTHS[m].slice(1)
  ctx.fillText(name, 84, startY + 200, W - 168)
  const top = startY + 340
  ctx.font = `500 30px ${sans}`
  ctx.textAlign = 'center'
  ctx.fillStyle = theme.muted
  weekdayOrder(data.settings.weekStart).forEach((w, i) => ctx.fillText(WEEKDAYS_SHORT[w].toUpperCase(), 96 + i * (cell + gap) + cell / 2, top - 26))
  ctx.textAlign = 'left'
  const counts = new Map<string, number>()
  weeks.forEach((week, wi) => week.forEach((k, i) => {
    if (!k) return
    const x = 96 + i * (cell + gap), yy = top + wi * (cell + gap)
    const e = data.entries[k]
    const l = e ? byId.get(e.level) : undefined
    if (l) counts.set(l.id, (counts.get(l.id) ?? 0) + 1)
    ctx.fillStyle = l ? l.color : theme.empty
    roundRect(ctx, x, yy, cell, cell, 22)
    ctx.fill()
    ctx.fillStyle = l ? inkFor(l.color) : theme.muted
    ctx.globalAlpha = 0.85
    ctx.font = `600 30px ${sans}`
    ctx.fillText(String(Number(k.slice(8))), x + 18, yy + 46)
    ctx.globalAlpha = 1
  }))

  const legendTop = top + weeks.length * (cell + gap) + 80
  const used = [...data.levels].reverse().filter(l => counts.get(l.id))
  ctx.font = `400 34px ${sans}`
  used.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const x = 96 + col * 460, yy = legendTop + row * 60
    ctx.fillStyle = l.color
    roundRect(ctx, x, yy - 28, 32, 32, 9)
    ctx.fill()
    const nameW = Math.min(ctx.measureText(l.name).width, 330)
    ctx.fillStyle = theme.ink
    ctx.fillText(l.name, x + 52, yy, 330)
    ctx.fillStyle = theme.muted
    ctx.fillText(String(counts.get(l.id)), x + 52 + nameW + 16, yy)
  })
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  ctx.fillStyle = theme.muted
  ctx.font = `400 28px ${sans}`
  ctx.fillText(`${total} ${plural(total, 'день', 'дня', 'дней')} в цвете`, 96, H - 80)

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Не удалось нарисовать картинку'))), 'image/png'))
}

function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#17150F' : '#FFFFFF'
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Шрифты картинок: fonts.ready не догружает начертания, которых ещё нет на экране, — грузим явно. */
async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('italic 500 52px "Cormorant Garamond"', 'Оттенки'),
      document.fonts.load('500 52px "Cormorant Garamond"', 'Январь 2026'),
      document.fonts.load('500 30px "Onest Variable"', 'дней 0123')
    ])
  } catch { /* шрифты не критичны */ }
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'needs-tap'

let pending: { file: File; title: string } | null = null

/**
 * Отдать файл: системное «Поделиться» на телефоне, иначе скачивание.
 * Safari разрешает «Поделиться» только сразу после нажатия; если файл готовился долго, вернётся 'needs-tap' —
 * тогда покажите кнопку, которая вызовет sharePending() новым нажатием.
 */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      const name = (e as DOMException)?.name
      if (name === 'AbortError') return 'cancelled'
      if (name === 'NotAllowedError') { pending = { file, title }; return 'needs-tap' }
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}

/** Повторить «Поделиться» для подготовленного файла — вызывать прямо из обработчика нажатия. */
export function sharePending() {
  const p = pending
  pending = null
  if (!p) return
  navigator.share({ files: [p.file], title: p.title }).catch(() => {})
}
