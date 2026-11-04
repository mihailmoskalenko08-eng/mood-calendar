// Главный экран: выбранный день крупно, шкала, заметка, неделя.

import { withAlpha } from '../lib/color'
import {
  addDays, capitalize, compareKeys, humanDate, isValidKey, parseKey, relativeLabel, WEEKDAYS, WEEKDAYS_SHORT, weekdayMon
} from '../lib/dates'
import { currentStreak } from '../lib/stats'
import { plural } from '../lib/dates'
import { backupDue, saveBackup } from '../backup'
import { isIosBrowserTab } from '../lib/env'
import { data, focusDay, go, levelOf, levelsById, sheetDay, snoozeBackup, today } from '../state'
import { ClearDay, NoteField, ScalePicker, TagPicker } from './DayEditor'
import { IconLeft, IconRight } from './icons'
import { useSwipe } from './ui'

export function Today() {
  const day = focusDay.value
  const now = today.value
  const d = data.value
  const level = levelOf(day)
  const rel = relativeLabel(day, now)
  const isFuture = compareKeys(day, now) > 0
  const date = parseKey(day)
  const streak = currentStreak(d, now)
  const yesterday = addDays(now, -1)
  const missedYesterday = day === now && !d.entries[yesterday] && Object.keys(d.entries).length > 0

  const shift = (n: number) => {
    const next = addDays(day, n)
    if (compareKeys(next, now) > 0) return
    focusDay.value = next
  }
  const swipe = useSwipe(dir => shift(dir))

  // Неделя, в которой выбранный день
  const ws = d.settings.weekStart
  const offset = (weekdayMon(day) - ws + 7) % 7
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - offset))

  return (
    <section class="screen today" {...swipe}
      style={{ '--wash': level ? withAlpha(level.color, 0.22) : 'transparent' } as Record<string, string>}>
      <div class="today-wash" aria-hidden="true" />
      <header class="today-head">
        <div class="eyebrow">
          {WEEKDAYS[weekdayMon(day)]}{rel ? <> · <b>{rel}</b></> : null}
          {streak > 1 && day === now && <span class="streak">{streak} {plural(streak, 'день', 'дня', 'дней')} подряд</span>}
        </div>
        <div class="today-date-row">
          <h1 class="display today-date">
            <label class="date-jump">
              <span class="today-num">{date.getDate()}</span>{' '}
              <span class="today-month">{humanDate(day, now).replace(/^\d+ /, '')}</span>
              <input type="date" class="date-jump-input" aria-label="Перейти к дате" value={day} max={now}
                onChange={e => {
                  const v = (e.target as HTMLInputElement).value
                  if (isValidKey(v) && compareKeys(v, now) <= 0) focusDay.value = v
                }} />
            </label>
          </h1>
          <div class="today-nav">
            <button class="icon-btn" onClick={() => shift(-1)} aria-label="Предыдущий день"><IconLeft /></button>
            <button class="icon-btn" onClick={() => shift(1)} disabled={day === now} aria-label="Следующий день"><IconRight /></button>
          </div>
        </div>
        <p class="today-q">
          {isFuture ? 'Этот день ещё не наступил' : level ? <>День — <em>{level.name.toLowerCase()}</em></> : day === now ? 'Как прошёл день?' : 'Как прошёл этот день?'}
        </p>
        {missedYesterday && (
          <button class="nudge-line" onClick={() => { focusDay.value = yesterday }}>
            <i class="nudge-dot" aria-hidden="true" />Вчера без цвета · <u>отметить</u>
          </button>
        )}
        {isIosBrowserTab() && Object.keys(d.entries).length > 0 && (
          <button class="nudge-line nudge-line--warn" onClick={() => go('settings')}>
            Вы в Safari: эти отметки не попадут в приложение с иконки · <u>как перенести</u>
          </button>
        )}
      </header>

      {!isFuture && <ScalePicker day={day} />}

      {level && d.settings.showDetails && (
        <div class="details">
          <NoteField key={day} day={day} />
          <TagPicker day={day} />
          <ClearDay day={day} />
        </div>
      )}

      {day === now && backupDue(d) && (
        <div class="nudge nudge--backup">
          <span>Месяц без резервной копии. Отметки живут только на этом телефоне — сохраните копию в «Файлы».</span>
          <span class="row-actions">
            <button class="pill-btn" onClick={() => saveBackup()}>Сохранить копию</button>
            <button class="pill-btn ghost" onClick={() => snoozeBackup(7)}>Позже</button>
          </span>
        </div>
      )}

      <Memories day={day} />

      <nav class="week" aria-label="Неделя">
        {week.map(k => {
          const l = levelOf(k)
          const future = compareKeys(k, now) > 0
          return (
            <button key={k} class={`week-day${k === day ? ' is-focus' : ''}${k === now ? ' is-today' : ''}`}
              disabled={future} onClick={() => { focusDay.value = k }}>
              <span class="visually-hidden">{`${capitalize(WEEKDAYS[weekdayMon(k)])}, ${humanDate(k, now)}${l ? `: ${l.name}` : ''}`}</span>
              <span class="week-label" aria-hidden="true">{WEEKDAYS_SHORT[weekdayMon(k)]}</span>
              <span class={`week-cell${l ? ' is-set' : ''}`} style={l ? { background: l.color } : undefined} />
              <span class="week-num" aria-hidden="true">{parseKey(k).getDate()}</span>
            </button>
          )
        })}
      </nav>
    </section>
  )
}

/** «В этот день» — тот же день в прошлые годы, если он был отмечен. */
function Memories({ day }: { day: string }) {
  const d = data.value
  const [y, md] = [Number(day.slice(0, 4)), day.slice(4)]
  const past: { key: string; years: number }[] = []
  for (let back = 1; back <= 10; back++) {
    const k = `${y - back}${md}`
    if (d.entries[k]) past.push({ key: k, years: back })
  }
  if (!past.length) return null
  return (
    <section class="memories" aria-label="В этот день раньше">
      <div class="eyebrow">В этот день</div>
      {past.map(({ key, years }) => {
        const e = d.entries[key]
        const l = levelsById.value.get(e.level)
        return (
          <button key={key} class="memory" onClick={() => { sheetDay.value = key }}>
            <span class="memory-swatch" style={{ background: l?.color }} />
            <span class="memory-text">
              <b>{years === 1 ? 'Год назад' : `${years} ${plural(years, 'год', 'года', 'лет')} назад`}</b> — {l?.name.toLowerCase()}
              {e.note && <span class="memory-note">{e.note}</span>}
            </span>
          </button>
        )
      })}
    </section>
  )
}
