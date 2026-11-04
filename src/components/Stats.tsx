// Итоги: средний день, распределение, месяцы, дни недели, серии, метки, записи.

import { useMemo, useState } from 'preact/hooks'
import {
  capitalize, humanDate, MONTHS, MONTHS_GEN, parseKey, plural, ROMAN, WEEKDAYS, WEEKDAYS_SHORT, weekdayOrder
} from '../lib/dates'
import { inkOn, sampleRamp } from '../lib/color'
import { levelAtScore, type Data } from '../lib/model'
import {
  average, currentStreak, distribution, entriesIn, extremeMonths, isGood, longestRun, monthlyAverages,
  monthRange, tagInsights, weekdayAverages, yearRange, yearsWithData, type Range
} from '../lib/stats'
import { data, go, levelsById, sheetDay, tagsById, today } from '../state'
import { IconLeft, IconRight, IconSearch } from './icons'
import { Segmented } from './ui'

type Period = 'month' | 'year' | 'all'

const fmt = (n: number) => n.toLocaleString('ru', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function Stats() {
  const d = data.value
  const now = today.value
  const nd = parseKey(now)
  const [period, setPeriod] = useState<Period>('year')
  const [ym, setYm] = useState({ y: nd.getFullYear(), m: nd.getMonth() })

  const range: Range | null = period === 'all' ? null : period === 'year' ? yearRange(ym.y) : monthRange(ym.y, ym.m)
  const list = useMemo(() => entriesIn(d, range), [d, range?.from, range?.to])
  const avg = average(d, list)

  const shift = (n: number) => {
    if (period === 'year') setYm({ ...ym, y: ym.y + n })
    else {
      const t = new Date(ym.y, ym.m + n, 1)
      setYm({ y: t.getFullYear(), m: t.getMonth() })
    }
  }
  const title = period === 'all' ? 'Всё время' : period === 'year' ? String(ym.y) : `${capitalize(MONTHS[ym.m])} ${ym.y}`

  return (
    <section class="screen stats">
      <header class="screen-head">
        <div>
          <div class="eyebrow">Итоги</div>
          <h1 class="display screen-title">{title}</h1>
        </div>
        {period !== 'all' && (
          <div class="head-nav">
            <button class="icon-btn" onClick={() => shift(-1)} aria-label="Назад"><IconLeft /></button>
            <button class="icon-btn" onClick={() => shift(1)} aria-label="Вперёд"><IconRight /></button>
          </div>
        )}
      </header>

      <Segmented label="Период" value={period} onChange={setPeriod}
        options={[{ value: 'month', label: 'Месяц' }, { value: 'year', label: 'Год' }, { value: 'all', label: 'Всё время' }]} />

      {!list.length ? (
        <div class="empty-card">
          <p class="display empty-title">Здесь пока пусто</p>
          <p>Отмечайте дни — и через пару недель тут появятся закономерности: какие дни недели легче, что поднимает настроение, как меняется месяц к месяцу.</p>
          <button class="pill-btn" onClick={() => go('today')}>Отметить сегодня</button>
        </div>
      ) : (
        <>
          <Hero d={d} avg={avg!} count={list.length} />
          <Distribution d={d} list={list} />
          {period !== 'month' && <ByMonth d={d} year={period === 'year' ? ym.y : null} />}
          <ByWeekday d={d} list={list} />
          <Streaks d={d} range={range} now={now} />
          <Tags d={d} list={list} />
          <Notes list={list} />
        </>
      )}
    </section>
  )
}

function Hero({ d, avg, count }: { d: Data; avg: number; count: number }) {
  const l = levelAtScore(d, avg)
  const c = scoreColor(d, avg)
  return (
    <div class="card hero" style={{ '--c': c, '--ink-on': inkOn(c) } as Record<string, string>}>
      <div class="eyebrow">Средний день</div>
      <div class="display hero-name">{l.name}</div>
      <div class="hero-meta">{count} {plural(count, 'день', 'дня', 'дней')} в цвете · {fmt(avg * (d.levels.length - 1) + 1)} из {d.levels.length}</div>
    </div>
  )
}

function Distribution({ d, list }: { d: Data; list: ReturnType<typeof entriesIn> }) {
  const dist = distribution(d, list).reverse()
  const max = Math.max(...dist.map(x => x.count), 1)
  return (
    <div class="card">
      <h2 class="card-title">Какими были дни</h2>
      <ul class="bars">
        {dist.map(x => {
          const l = levelsById.value.get(x.id)!
          return (
            <li key={x.id}>
              <span class="bars-name">{l.name}</span>
              <span class="bars-track">
                {x.count > 0 && <span class="bars-fill" style={{ width: `${(x.count / max) * 100}%`, background: l.color }} />}
              </span>
              <span class="bars-val">{x.count}<small>{x.count ? ` · ${Math.round(x.share * 100)}%` : ''}</small></span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Цвет для средней оценки — плавно между соседними уровнями шкалы. */
function scoreColor(d: Data, score: number): string {
  return sampleRamp(d.levels.map(l => l.color), score)
}

/**
 * Средние по группам точками. Шкала по вертикали растянута на диапазон данных (с запасом),
 * поэтому различия видны; точки, а не столбики, — чтобы не изображать «ноль» там, где его нет.
 */
function Columns({ d, items, labels, titles, caption }: {
  d: Data
  items: { avg: number | null; count: number }[]
  labels: string[]
  titles: string[]
  caption: string
}) {
  const [sel, setSel] = useState<number | null>(null)
  const s = sel != null ? items[sel] : null
  const known = items.filter(x => x.avg != null).map(x => x.avg!)
  const min = Math.min(...known), max = Math.max(...known)
  const pad = Math.max(0.06, (max - min) * 0.3)
  const lo = Math.max(0, min - pad), hi = Math.min(1, max + pad)
  const pos = (v: number) => (hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100)
  let total = 0, n = 0
  for (const it of items) if (it.avg != null) { total += it.avg * it.count; n += it.count }
  const mean = n ? total / n : null
  return (
    <>
      <div class="cols" role="group" aria-label={caption}
        style={mean != null ? { '--mean': `${100 - pos(mean)}%` } as Record<string, string> : undefined}>
        
        {items.map((it, i) => {
          const l = it.avg != null ? levelAtScore(d, it.avg) : null
          return (
            <button key={i} class={`col${sel === i ? ' is-sel' : ''}`}
              onClick={() => setSel(sel === i ? null : i)}
              aria-label={`${titles[i]}: ${l ? `${l.name}, ${it.count} ${plural(it.count, 'день', 'дня', 'дней')}` : 'нет отметок'}`}>
              <span class="col-track">
                {it.avg != null && (
                  <span class="col-dot" style={{ bottom: `${pos(it.avg)}%`, background: scoreColor(d, it.avg), '--i': `${i * 40}ms` } as Record<string, string>} />
                )}
              </span>
              <span class="col-label">{labels[i]}</span>
            </button>
          )
        })}
      </div>
      <p class="cols-readout" aria-live="polite">
        {s && sel != null ? (
          s.avg != null
            ? <><b>{capitalize(titles[sel])}</b> — в среднем «{levelAtScore(d, s.avg).name.toLowerCase()}», {s.count} {plural(s.count, 'день', 'дня', 'дней')}</>
            : <><b>{capitalize(titles[sel])}</b> — нет отметок</>
        ) : <span class="muted">Пунктир — средний день за период. Чем выше точка, тем светлее.</span>}
      </p>
    </>
  )
}

function ByMonth({ d, year }: { d: Data; year: number | null }) {
  // «Всё время» — среднее по каждому месяцу за все годы; «Год» — по месяцам выбранного года
  const items = year != null
    ? monthlyAverages(d, year)
    : Array.from({ length: 12 }, (_, m) => {
      const all = yearsWithData(d).flatMap(y => entriesIn(d, monthRange(y, m)))
      return { avg: average(d, all), count: all.length }
    })
  const ex = year != null ? extremeMonths(d, year) : { best: null, worst: null }
  return (
    <div class="card">
      <h2 class="card-title">По месяцам</h2>
      <Columns d={d} items={items} labels={ROMAN} titles={MONTHS} caption="Среднее по месяцам" />
      {(ex.best != null || ex.worst != null) && (
        <div class="facts">
          {ex.best != null && <div><span class="eyebrow">Самый светлый</span><b>{capitalize(MONTHS[ex.best])}</b></div>}
          {ex.worst != null && <div><span class="eyebrow">Самый тяжёлый</span><b>{capitalize(MONTHS[ex.worst])}</b></div>}
        </div>
      )}
    </div>
  )
}

function ByWeekday({ d, list }: { d: Data; list: ReturnType<typeof entriesIn> }) {
  const raw = weekdayAverages(d, list)
  const order = weekdayOrder(d.settings.weekStart)
  const items = order.map(i => raw[i])
  const known = raw.map((x, i) => ({ ...x, i })).filter(x => x.avg != null && x.count >= 2)
  const best = known.length > 1 ? known.reduce((a, b) => (b.avg! > a.avg! ? b : a)) : null
  const worst = known.length > 1 ? known.reduce((a, b) => (b.avg! < a.avg! ? b : a)) : null
  return (
    <div class="card">
      <h2 class="card-title">Дни недели</h2>
      <Columns d={d} items={items} labels={order.map(i => WEEKDAYS_SHORT[i])} titles={order.map(i => WEEKDAYS[i])} caption="Среднее по дням недели" />
      {best && worst && best.i !== worst.i && (
        <p class="insight">Легче всего проходит <b>{WEEKDAYS[best.i]}</b>, тяжелее — <b>{WEEKDAYS[worst.i]}</b>.</p>
      )}
    </div>
  )
}

function Streaks({ d, range, now }: { d: Data; range: Range | null; now: string }) {
  const marked = longestRun(d, () => true, range)
  const good = longestRun(d, e => isGood(d, e), range)
  const cur = currentStreak(d, now)
  const span = (r: typeof marked) => r.from && r.to
    ? r.from === r.to ? humanDate(r.from, now) : `${humanDate(r.from, now)} — ${humanDate(r.to, now)}`
    : ''
  return (
    <div class="card">
      <h2 class="card-title">Серии</h2>
      <div class="tiles">
        {range === null || range.to >= now ? (
          <div class="tile">
            <span class="display tile-num">{cur}</span>
            <span class="tile-label">{plural(cur, 'день', 'дня', 'дней')} подряд — сейчас</span>
          </div>
        ) : null}
        <div class="tile">
          <span class="display tile-num">{marked.length}</span>
          <span class="tile-label">рекорд отметок подряд</span>
          <span class="muted">{span(marked)}</span>
        </div>
        <div class="tile">
          <span class="display tile-num">{good.length}</span>
          <span class="tile-label">хороших дней подряд</span>
          <span class="muted">{good.length ? span(good) : 'ещё впереди'}</span>
        </div>
      </div>
    </div>
  )
}

function Tags({ d, list }: { d: Data; list: ReturnType<typeof entriesIn> }) {
  const ins = tagInsights(d, list)
  if (!ins.length) return null
  const steps = d.levels.length - 1
  const maxDelta = Math.max(0.5, ...ins.map(t => Math.abs((t.delta ?? 0) * steps)))
  return (
    <div class="card">
      <h2 class="card-title">Что влияет на день</h2>
      <p class="muted card-sub">Средний уровень в дни с меткой по сравнению с остальными днями</p>
      <ul class="tag-ins">
        {ins.map(t => {
          const tag = tagsById.value.get(t.id)!
          const delta = t.delta != null ? t.delta * steps : null
          const dir = delta == null || Math.abs(delta) < 0.15 ? 'flat' : delta > 0 ? 'up' : 'down'
          const w = delta == null ? 0 : (Math.abs(delta) / maxDelta) * 50
          return (
            <li key={t.id}>
              <span class="tag-ins-name">{tag.name}<small>{t.count} {plural(t.count, 'день', 'дня', 'дней')}</small></span>
              <span class="tag-ins-bar" aria-hidden="true">
                <span class={`tag-ins-fill is-${dir}`} style={{ width: `${w}%`, [dir === 'down' ? 'right' : 'left']: '50%' }} />
              </span>
              <span class={`tag-ins-val is-${dir}`}>
                {delta == null ? '—' : dir === 'flat' ? '≈ 0' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`}
              </span>
            </li>
          )
        })}
      </ul>
      <p class="muted card-sub">Это наблюдение, а не причина: чем больше отмеченных дней, тем ему можно больше доверять.</p>
    </div>
  )
}

function Notes({ list }: { list: ReturnType<typeof entriesIn> }) {
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(20)
  const withNotes = list.filter(([, e]) => e.note).reverse()
  if (!withNotes.length) return null
  const query = q.trim().toLowerCase()
  const found = query ? withNotes.filter(([, e]) => e.note!.toLowerCase().includes(query)) : withNotes
  const now = today.value
  return (
    <div class="card">
      <h2 class="card-title">Записи <span class="muted">{withNotes.length}</span></h2>
      {withNotes.length > 4 && (
        <label class="search">
          <IconSearch size={18} />
          <input type="search" placeholder="Найти в записях" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
        </label>
      )}
      <ul class="notes">
        {found.slice(0, limit).map(([k, e]) => {
          const l = levelsById.value.get(e.level)
          const dt = parseKey(k)
          return (
            <li key={k}>
              <button onClick={() => { sheetDay.value = k }}>
                <span class="notes-bar" style={{ background: l?.color }} />
                <span class="notes-date">
                  <b>{dt.getDate()}</b> {MONTHS_GEN[dt.getMonth()]}{dt.getFullYear() !== parseKey(now).getFullYear() ? ` ${dt.getFullYear()}` : ''}
                  <small>{l?.name}</small>
                </span>
                <span class="notes-text">{e.note}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {!found.length && <p class="muted">Ничего не нашлось</p>}
      {found.length > limit && <button class="link-btn" onClick={() => setLimit(limit + 40)}>Показать ещё</button>}
    </div>
  )
}
