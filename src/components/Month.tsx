// Месяц: сетка дней в цвете и короткая сводка.

import { inkOn } from '../lib/color'
import {
  capitalize, compareKeys, humanDate, MONTHS, monthGrid, parseKey, plural, WEEKDAYS_SHORT, weekdayOrder
} from '../lib/dates'
import { levelAtScore } from '../lib/model'
import { average, distribution, elapsedDays, entriesIn, monthRange } from '../lib/stats'

const fmt = (n: number) => n.toLocaleString('ru', { maximumFractionDigits: 1 })

const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре']
import { data, levelOf, sheetDay, showToast, today, viewMonth } from '../state'
import { useState } from 'preact/hooks'
import { renderMonthPoster, shareOrDownload } from '../lib/poster'
import { IconLeft, IconRight, IconShare } from './icons'
import { useSwipe } from './ui'

export function Month() {
  const { y, m } = viewMonth.value
  const now = today.value
  const d = data.value
  const weeks = monthGrid(y, m, d.settings.weekStart)
  const range = monthRange(y, m)
  const list = entriesIn(d, range)
  const elapsed = elapsedDays(range, now)
  const avg = average(d, list)
  const nowDate = parseKey(now)
  const isCurrent = y === nowDate.getFullYear() && m === nowDate.getMonth()

  const [busy, setBusy] = useState(false)
  const share = async () => {
    setBusy(true)
    try {
      const css = getComputedStyle(document.documentElement)
      const v = (n: string) => css.getPropertyValue(n).trim()
      const blob = await renderMonthPoster(d, y, m, { bg: v('--bg'), ink: v('--ink'), muted: v('--muted'), empty: v('--empty') })
      const r = await shareOrDownload(blob, `ottenki-${y}-${String(m + 1).padStart(2, '0')}.png`, `${capitalize(MONTHS[m])} в цвете`)
      if (r === 'downloaded') showToast('Картинка сохранена')
    } catch {
      showToast('Не получилось сделать картинку')
    } finally {
      setBusy(false)
    }
  }

  const shift = (n: number) => {
    const t = new Date(y, m + n, 1)
    viewMonth.value = { y: t.getFullYear(), m: t.getMonth() }
  }
  const swipe = useSwipe(dir => shift(dir))

  return (
    <section class="screen month" {...swipe}>
      <header class="screen-head">
        <div>
          <div class="eyebrow">{y}</div>
          <h1 class="display screen-title" key={`${y}-${m}`}>{capitalize(MONTHS[m])}</h1>
        </div>
        <div class="head-nav">
          {!isCurrent && (
            <button class="pill-btn" onClick={() => { viewMonth.value = { y: nowDate.getFullYear(), m: nowDate.getMonth() } }}>
              Сегодня
            </button>
          )}
          <button class="icon-btn" onClick={() => shift(-1)} aria-label="Предыдущий месяц"><IconLeft /></button>
          <button class="icon-btn" onClick={() => shift(1)} aria-label="Следующий месяц"><IconRight /></button>
        </div>
      </header>

      <div class="cal" role="grid" aria-label={`${capitalize(MONTHS[m])} ${y}`}>
        <div class="cal-row cal-weekdays" role="row">
          {weekdayOrder(d.settings.weekStart).map(w => (
            <span role="columnheader" key={w} class={w >= 5 ? 'is-weekend' : ''}>{WEEKDAYS_SHORT[w]}</span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div class="cal-row" role="row" key={wi}>
            {week.map((k, i) => {
              if (!k) return <span class="cal-cell is-out" role="gridcell" key={`o${i}`} />
              const l = levelOf(k)
              const future = compareKeys(k, now) > 0
              const e = d.entries[k]
              return (
                <button key={k} role="gridcell"
                  class={`cal-cell${l ? ' is-set' : ''}${k === now ? ' is-today' : ''}${future ? ' is-future' : ''}`}
                  style={l ? { '--c': l.color, '--ink-on': inkOn(l.color), '--i': `${(wi * 7 + i) * 12}ms` } as Record<string, string> : undefined}
                  disabled={future}
                  onClick={() => { sheetDay.value = k }}
                  aria-label={`${humanDate(k, now)}${l ? `: ${l.name}` : ', без отметки'}`}>
                  <span class="cal-num">{parseKey(k).getDate()}</span>
                  {e?.note && <span class="cal-note" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div class="month-summary">
        {list.length ? (
          <>
            <div class="summary-line">
              <span>Отмечено <b>{list.length}</b> из {elapsed || list.length} {plural(elapsed || list.length, 'дня', 'дней', 'дней')}</span>
              {avg != null && (
                <span class="summary-avg">в среднем <i class="dot" style={{ background: levelAtScore(d, avg).color }} /> <b>{levelAtScore(d, avg).name.toLowerCase()}</b></span>
              )}
            </div>
            <SegmentBar />
            <Compare />
            <button class="pill-btn ghost month-share" onClick={share} disabled={busy}>
              <IconShare size={18} /> {busy ? 'Рисую…' : 'Картинка месяца'}
            </button>
          </>
        ) : (
          <p class="empty-note">{compareKeys(range.from, now) > 0 ? 'Этот месяц ещё впереди.' : 'В этом месяце пока нет отметок. Нажмите на день, чтобы раскрасить его.'}</p>
        )}
      </div>
    </section>
  )

  function Compare() {
    const p = new Date(y, m - 1, 1)
    const prev = entriesIn(d, monthRange(p.getFullYear(), p.getMonth()))
    const pa = average(d, prev)
    if (avg == null || pa == null || list.length < 3 || prev.length < 3) return null
    const delta = (avg - pa) * (d.levels.length - 1)
    const name = MONTHS_PREP[p.getMonth()]
    if (Math.abs(delta) < 0.2) return <p class="compare">По настроению — примерно как в {name}.</p>
    const amount = Math.abs(delta)
    const rounded = Math.round(amount * 10) / 10
    const words = amount < 0.75 ? 'на полшага' : amount < 1.25 ? 'на целый шаг'
      : Number.isInteger(rounded) ? `на ${rounded} ${plural(rounded, 'шаг', 'шага', 'шагов')}` : `на ${fmt(amount)} шага`
    return (
      <p class="compare">
        {delta > 0 ? 'Светлее' : 'Тяжелее'}, чем в {name}: в среднем <span class="nb">{words}</span> {delta > 0 ? 'выше' : 'ниже'} по шкале.
      </p>
    )
  }

  function SegmentBar() {
    const dist = distribution(d, list).filter(x => x.count > 0).reverse()
    return (
      <>
        <div class="segbar" role="img" aria-label={dist.map(x => `${d.levels.find(l => l.id === x.id)!.name}: ${x.count}`).join(', ')}>
          {dist.map(x => (
            <span key={x.id} style={{ flexGrow: x.count, background: d.levels.find(l => l.id === x.id)!.color }} />
          ))}
        </div>
        <ul class="legend">
          {dist.map(x => {
            const l = d.levels.find(l => l.id === x.id)!
            return <li key={x.id}><i class="dot" style={{ background: l.color }} />{l.name}<span>{x.count}</span></li>
          })}
        </ul>
      </>
    )
  }
}
