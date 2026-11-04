// Год: каждый день — пиксель. Два вида: «месяцы × дни» и «недели» (как лента активности).

import { Fragment } from 'preact'
import { useState } from 'preact/hooks'
import {
  addDays, compareKeys, daysInMonth, humanDate, keyOf, MONTH_LETTERS, MONTHS_SHORT, parseKey, plural, weekdayMon
} from '../lib/dates'
import { renderPoster, shareOrDownload } from '../lib/poster'
import { entriesIn, yearRange, elapsedDays } from '../lib/stats'
import { data, levelOf, setSetting, sheetDay, showToast, today, viewYear } from '../state'
import { IconLeft, IconRight, IconShare } from './icons'
import { Segmented, useSwipe } from './ui'

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

      {layout === 'months' ? <MonthsGrid y={y} now={now} /> : <WeeksGrid y={y} now={now} />}

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
      onClick={() => { sheetDay.value = k }}
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
