// Отметка дня: шкала цветов, заметка, метки. Используется на главном экране и в нижней панели.

import { useEffect, useRef, useState } from 'preact/hooks'
import { inkOn, withAlpha } from '../lib/color'
import type { DayKey } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { MAX_NOTE } from '../lib/model'
import { clearDay, data, go, mark, setNote, showToast, toggleTag } from '../state'
import { IconCheck } from './icons'

export function ScalePicker({ day, compact = false }: { day: DayKey; compact?: boolean }) {
  const d = data.value
  const current = d.entries[day]?.level
  const levels = [...d.levels].reverse() // лучший сверху
  const [burst, setBurst] = useState<string | null>(null)

  const pick = (id: string) => {
    haptic()
    if (id === current) return
    const level = d.levels.find(l => l.id === id)!
    const undo = mark(day, id)
    setBurst(id)
    setTimeout(() => setBurst(b => (b === id ? null : b)), 700)
    showToast(`${level.name}`, { label: 'Отменить', run: undo }, 3200)
  }

  return (
    <div class={`scale${compact ? ' scale--compact' : ''}${current ? ' has-pick' : ''}`}
      role="radiogroup" aria-label="Как прошёл день"
      style={{ '--rows': levels.length } as Record<string, number>}>
      {levels.map((l, i) => {
        const on = l.id === current
        return (
          <button key={l.id} role="radio" aria-checked={on}
            class={`scale-row${on ? ' is-on' : ''}${burst === l.id ? ' is-burst' : ''}`}
            style={{ '--c': l.color, '--ink-on': inkOn(l.color), '--soft': withAlpha(l.color, 0.14), '--d': `${i * 28}ms` } as Record<string, string>}
            onClick={() => pick(l.id)}>
            <span class="scale-fill" aria-hidden="true" />
            <span class="scale-dot" aria-hidden="true" />
            <span class="scale-name">{l.name}</span>
            <span class="scale-num" aria-hidden="true">{on ? <IconCheck size={18} /> : levels.length - i}</span>
          </button>
        )
      })}
    </div>
  )
}

export function NoteField({ day }: { day: DayKey }) {
  const entry = data.value.entries[day]
  const [value, setValue] = useState(entry?.note ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const ref = useRef<HTMLTextAreaElement>(null)
  const focused = useRef(false)

  // Сменился день или запись поменялась снаружи — показать актуальный текст.
  useEffect(() => {
    if (!focused.current) setValue(data.value.entries[day]?.note ?? '')
  }, [day, entry?.note])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(320, el.scrollHeight)}px`
  }, [value])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!entry) return null
  return (
    <label class="note">
      <span class="visually-hidden">Заметка о дне</span>
      <textarea ref={ref} rows={2} maxLength={MAX_NOTE} value={value} placeholder="Пара слов о дне…"
        onFocus={() => { focused.current = true }}
        onBlur={() => { focused.current = false; clearTimeout(timer.current); setNote(day, value) }}
        onInput={e => {
          const v = (e.target as HTMLTextAreaElement).value
          setValue(v)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setNote(day, v), 400)
        }} />
      {value.length > MAX_NOTE - 200 && <span class="note-count">{value.length}/{MAX_NOTE}</span>}
    </label>
  )
}

export function TagPicker({ day }: { day: DayKey }) {
  const d = data.value
  const entry = d.entries[day]
  if (!entry) return null
  if (!d.tags.length) {
    return <button class="link-btn" onClick={() => go('settings')}>Добавить метки в настройках</button>
  }
  const color = d.levels.find(l => l.id === entry.level)?.color ?? '#888888'
  return (
    <div class="tags" role="group" aria-label="Метки дня" style={{ '--c': color, '--ink-on': inkOn(color) } as Record<string, string>}>
      {d.tags.map(t => {
        const on = entry.tags?.includes(t.id) ?? false
        return (
          <button key={t.id} class={`tag${on ? ' is-on' : ''}`} aria-pressed={on}
            onClick={() => { haptic(); toggleTag(day, t.id) }}>
            {t.name}
          </button>
        )
      })}
    </div>
  )
}

export function ClearDay({ day, after }: { day: DayKey; after?: () => void }) {
  if (!data.value.entries[day]) return null
  return (
    <button class="link-btn link-btn--muted" onClick={() => {
      const undo = clearDay(day)
      showToast('Отметка удалена', { label: 'Вернуть', run: undo })
      after?.()
    }}>
      Убрать отметку
    </button>
  )
}
