// Картинка года для «Поделиться»: холст 1080×1920 (сторис) с сеткой месяцев и легендой.

import { daysInMonth, keyOf, plural, ROMAN } from './dates'
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
  try { await document.fonts.ready } catch { /* шрифты не критичны */ }

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
    ctx.fillText(l.name, x + 50, y)
  })

  ctx.fillStyle = theme.muted
  ctx.font = `400 28px ${sans}`
  ctx.fillText(`${marked} ${plural(marked, 'день', 'дня', 'дней')} в цвете`, 96, H - 80)

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Не удалось нарисовать картинку'))), 'image/png'))
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

/** Отдать файл: системное «Поделиться» на телефоне, иначе скачивание. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
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
