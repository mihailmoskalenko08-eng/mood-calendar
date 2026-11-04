// Год: каждый день — пиксель. Два вида: «месяцы × дни» и «недели» (как лента активности).

import { Fragment } from 'preact'
import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../lib/haptic'
import {
  addDays, compareKeys, daysInMonth, humanDate, keyOf, MONTH_LETTERS, MONTHS_SHORT, parseKey, plural, weekdayMon
} from '../lib/dates'
import { renderPoster, shareOrDownload } from '../lib/poster'
import { entriesIn, yearRange, elapsedDays } from '../lib/stats'
import { data, levelOf, setSetting, sheetDay, showToast, today, viewYear } from '../state'
import { IconLeft, IconRight, IconShare } from './icons'
import { gesture, Segmented, useSwipe } from './ui'

export function Year() {
  const y = viewYear.value
  const now = today.value
  const d = data.value
  const layout = d.settings.yearLayout
  const marked = entriesIn(d, yearRange(y)).length
  const elapsed = elapsedDays(yearRange(y), now)
  const [busy, setBusy] = useState(false)
  const swipe = useSwipe(dir => { viewYear.value = y + dir })

  const share = async () => {
    setBusy(true)
    try {
      const css = getComputedStyle(document.documentElement)
      const v = (n: string) => css.getPropertyValue(n).trim()
      const blob = await renderPoster(d, y, { bg: v('--bg'), ink: v('--ink'), muted: v('--muted'), empty: v('--empty') })
      const r = await shareOrDownload(blob, `ottenki-${y}.png`, `Мой ${y} в цвете`)
      if (r === 'downloaded') showToast('Картинка сохранена')
    } catch {
      showToast('Не получилось сделать картинку')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="screen year" {...swipe}>
      <header class="screen-head">
        <div>
          <div class="eyebrow">{marked} из {elapsed} {plural(elapsed, 'дня', 'дней', 'дней')} в цвете</div>
          <h1 class="display screen-title year-title" key={y}>{y}</h1>
        </div>
        <div class="head-nav">
          <button class="icon-btn" onClick={() => { viewYear.value = y - 1 }} aria-label="Предыдущий год"><IconLeft /></button>
          <button class="icon-btn" onClick={() => { viewYear.value = y + 1 }} aria-label="Следующий год"><IconRight /></button>
        </div>
      </header>

      <div class="year-tools">
        <Segmented label="Вид года" value={layout} onChange={v => setSetting('yearLayout', v)}
          options={[{ value: 'months', label: 'По месяцам' }, { value: 'weeks', label: 'По неделям' }]} />
        <button class="pill-btn" onClick={share} disabled={busy}>
          <IconShare size={18} /> {busy ? 'Рисую…' : 'Картинка'}
        </button>
      </div>

      <Scrub now={now}>
        {layout === 'months' ? <MonthsGrid y={y} now={now} /> : <WeeksGrid y={y} now={now} />}
      </Scrub>
      <p class="hint">Нажмите на день, чтобы открыть его. Зажмите и ведите пальцем — чтобы пролистать дни.</p>

      <ul class="legend legend--year">
        {[...d.levels].reverse().map(l => <li key={l.id}><i class="dot" style={{ background: l.color }} />{l.name}</li>)}
      </ul>
    </section>
  )
}

function Pixel({ k, now }: { k: string; now: string }) {
  const l = levelOf(k)
  const future = compareKeys(k, now) > 0
  return (
    <button class={`px${l ? ' is-set' : ''}${k === now ? ' is-today' : ''}${future ? ' is-future' : ''}`}
      style={l ? { background: l.color } : undefined} disabled={future}
      data-day={k}
      onClick={() => { if (!scrubbedRecently()) sheetDay.value = k }}
      aria-label={`${humanDate(k, now)}${l ? `: ${l.name}` : ''}`} />
  )
}

function MonthsGrid({ y, now }: { y: number; now: string }) {
  return (
    <div class="ygrid" role="grid" aria-label={`${y} по месяцам`}>
      <span />
      {MONTH_LETTERS.map((l, m) => <span class="ygrid-m" key={m} title={MONTHS_SHORT[m]}>{l}</span>)}
      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
        <Fragment key={day}>
          <span class="ygrid-d">{day === 1 || day % 5 === 0 ? day : ''}</span>
          {Array.from({ length: 12 }, (_, m) => {
            if (day > daysInMonth(y, m)) return <span class="px is-out" key={`${m}-${day}`} />
            const k = keyOf(y, m, day)
            return <Pixel k={k} now={now} key={k} />
          })}
        </Fragment>
      ))}
    </div>
  )
}

function WeeksGrid({ y, now }: { y: number; now: string }) {
  const ws = data.value.settings.weekStart
  const first = keyOf(y, 0, 1)
  const start = addDays(first, -((weekdayMon(first) - ws + 7) % 7))
  const last = keyOf(y, 11, 31)
  const weeks: string[][] = []
  for (let k = start; compareKeys(k, last) <= 0; k = addDays(k, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(k, i)))
  }
  // Горизонтально: 7 строк (дни недели) — недели идут сверху вниз, чтобы помещалось на телефоне.
  return (
    <div class="wgrid" role="grid" aria-label={`${y} по неделям`}>
      {weeks.map((w, i) => {
        const firstOfMonth = w.find(k => k.endsWith('-01') && k.startsWith(String(y)))
        return (
          <div class="wgrid-row" key={i}>
            <span class="wgrid-m">{firstOfMonth ? MONTHS_SHORT[parseKey(firstOfMonth).getMonth()] : ''}</span>
            {w.map(k => k.startsWith(String(y)) ? <Pixel k={k} now={now} key={k} /> : <span class="px is-out" key={k} />)}
          </div>
        )
      })}
    </div>
  )
}

const scrubbedRecently = () => Date.now() - gesture.scrubEnd < 400

/**
 * Пролистывание года пальцем: долгое нажатие на сетке включает режим, в котором над пальцем
 * видно дату, уровень и начало заметки каждого дня под ним. Обычное нажатие по-прежнему открывает день.
 */
function Scrub({ children, now }: { children: ComponentChildren; now: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ k: string; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let active = false
    let start = { x: 0, y: 0 }
    let current = ''
    let hl: HTMLElement | null = null

    const show = (x: number, y: number) => {
      const target = document.elementFromPoint(x, y) as HTMLElement | null
      const px = target?.closest<HTMLElement>('[data-day]')
      if (!px || px.dataset.day === current) { if (px) setTip(t => (t ? { ...t, x, y } : t)); return }
      current = px.dataset.day!
      hl?.classList.remove('is-scrub')
      hl = px
      px.classList.add('is-scrub')
      haptic()
      setTip({ k: current, x, y })
    }
    const stop = () => {
      clearTimeout(timer)
      if (active) gesture.scrubEnd = Date.now()
      active = false
      current = ''
      hl?.classList.remove('is-scrub')
      hl = null
      el.classList.remove('is-scrubbing')
      setTip(null)
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return stop()
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY }
      timer = setTimeout(() => {
        active = true
        el.classList.add('is-scrubbing')
        show(start.x, start.y)
      }, 260)
    }
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (active) {
        e.preventDefault()
        show(t.clientX, t.clientY)
      } else if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 8) {
        clearTimeout(timer)
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', stop)
    el.addEventListener('touchcancel', stop)
    el.addEventListener('contextmenu', e => e.preventDefault())
    return () => {
      stop()
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', stop)
      el.removeEventListener('touchcancel', stop)
    }
  }, [])

  const d = data.value
  const e = tip ? d.entries[tip.k] : undefined
  const l = e ? d.levels.find(x => x.id === e.level) : undefined
  const left = tip ? Math.min(window.innerWidth - 16 - 220, Math.max(16, tip.x - 110)) : 0
  return (
    <div class="scrub" ref={box}>
      {children}
      {tip && (
        <div class="scrub-tip" style={{ left: `${left}px`, top: `${Math.max(12, tip.y - 96)}px` }} aria-hidden="true">
          <span class="scrub-swatch" style={{ background: l?.color ?? 'var(--empty)' }} />
          <span class="scrub-body">
            <b>{humanDate(tip.k, now)}</b>
            <span>{l ? l.name : compareKeys(tip.k, now) > 0 ? 'ещё впереди' : 'без отметки'}</span>
            {e?.note && <i>{e.note}</i>}
          </span>
        </div>
      )}
    </div>
  )
}
