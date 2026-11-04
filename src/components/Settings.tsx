// Настройки: шкала, метки, вид, напоминание, данные, установка.

import { useEffect, useRef, useState } from 'preact/hooks'
import { inkOn, isHex, rampColors } from '../lib/color'
import { plural } from '../lib/dates'
import { MAX_LEVELS, MAX_TAGS, MIN_LEVELS, PALETTES, countByLevel } from '../lib/model'
import type { Data } from '../lib/model'
import { readBackup, saveBackup } from '../backup'
import {
  addLevel, addTag, applyPalette, data, deleteLevel, deleteTag, mergeIn, moveLevel, renameLevel,
  renameTag, replaceAll, resetScale, setLevelColor, setSetting, showToast
} from '../state'
import { defaultData } from '../lib/model'
import { IconClose, IconDown, IconPlus, IconShare, IconTrash, IconUp } from './icons'
import { ConfirmButton, Segmented, Switch } from './ui'
import { Keypad, PIN_LENGTH, PinDots } from './Lock'
import { checkPin, clearLock, hasLock, lockAvailable, setPin } from '../lib/lock'

export const SWATCHES = [
  '#E3263A', '#F0544F', '#FF7A3D', '#FFA62B', '#FFC53D', '#F3E37C', '#C6E85A', '#8FD14F',
  '#4CB963', '#14A090', '#2EC4B6', '#5FB3D3', '#3A86FF', '#3559D6', '#2E4A7D', '#1C2541',
  '#5E4AE3', '#9A3E9C', '#C2577E', '#FF8FAB', '#8E8AA8', '#A39E93', '#5B5852', '#1E1E1E'
]

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

export function Settings() {
  return (
    <section class="screen settings">
      <header class="screen-head">
        <div>
          <div class="eyebrow">Настройки</div>
          <h1 class="display screen-title">Ещё</h1>
        </div>
      </header>
      {!isStandalone() && <Install />}
      <ScaleEditor />
      <TagsEditor />
      <Look />
      <Reminder />
      <PinSection />
      <DataSection />
      <About />
    </section>
  )
}

function Install() {
  return (
    <div class="card install">
      <h2 class="card-title">Поставьте на экран «Домой»</h2>
      <ol class="steps">
        <li>Нажмите <b>«Поделиться»</b> внизу Safari <span class="share-glyph" aria-hidden="true"><IconShare size={18} /></span></li>
        <li>Выберите <b>«На экран „Домой“»</b></li>
        <li>Открывайте «Оттенки» с иконки — на весь экран, без интернета</li>
      </ol>
      <p class="muted card-sub">Важно: Safari и приложение с иконки хранят отметки отдельно. Если уже что-то отметили здесь — сохраните копию в разделе «Данные» и загрузите её в приложении.</p>
    </div>
  )
}

function ScaleEditor() {
  const d = data.value
  const [editing, setEditing] = useState<string | null>(null)
  const counts = countByLevel(d)
  const levels = [...d.levels].reverse()
  return (
    <div class="card">
      <h2 class="card-title">Шкала <span class="muted">{d.levels.length} из {MAX_LEVELS}</span></h2>
      <p class="muted card-sub">Сверху — лучший день. Название и цвет можно поменять, отметки при этом сохранятся.</p>

      <div class="palettes" role="radiogroup" aria-label="Палитра">
        {PALETTES.map(p => (
          <button key={p.id} role="radio" aria-checked={d.palette === p.id}
            class={`palette${d.palette === p.id ? ' is-on' : ''}`} onClick={() => applyPalette(p.id)}>
            <span class="palette-strip">
              {rampColors(p.stops, d.levels.length).map((c, i) => <i key={i} style={{ background: c }} />)}
            </span>
            <span>{p.name}</span>
          </button>
        ))}
        {d.palette === 'custom' && (
          <span class="palette is-on palette--custom">
            <span class="palette-strip">{d.levels.map(l => <i key={l.id} style={{ background: l.color }} />)}</span>
            <span>Своя</span>
          </span>
        )}
      </div>

      <ul class="level-list">
        {levels.map((l, i) => (
          <li key={l.id} class="level-item">
            <div class="level-main">
              <button class="level-swatch" style={{ background: l.color, color: inkOn(l.color) }}
                aria-label={`${levels.length - i} — цвет уровня «${l.name}»`} aria-expanded={editing === l.id}
                onClick={() => setEditing(editing === l.id ? null : l.id)}>
                {levels.length - i}
              </button>
              <input class="level-name" value={l.name} maxLength={40} aria-label="Название уровня"
                onChange={e => {
                  const v = (e.target as HTMLInputElement).value.trim()
                  if (v) renameLevel(l.id, v)
                  else (e.target as HTMLInputElement).value = l.name
                }} />
              <span class="level-count" title="Сколько дней отмечено">{counts[l.id] || ''}</span>
              <button class="icon-btn sm" onClick={() => moveLevel(l.id, 1)} disabled={i === 0} aria-label={`Поднять «${l.name}» выше`}><IconUp size={18} /></button>
              <button class="icon-btn sm" onClick={() => moveLevel(l.id, -1)} disabled={i === levels.length - 1} aria-label={`Опустить «${l.name}» ниже`}><IconDown size={18} /></button>
              {d.levels.length > MIN_LEVELS && (
                <ConfirmButton class="icon-btn sm danger" label={`Удалить уровень «${l.name}»`}
                  confirm={counts[l.id] ? `Удалить? ${counts[l.id]} ${plural(counts[l.id], 'день', 'дня', 'дней')} → соседний` : 'Точно?'}
                  onConfirm={() => deleteLevel(l.id)}>
                  <IconTrash size={18} />
                </ConfirmButton>
              )}
            </div>
            {editing === l.id && <ColorPicker value={l.color} onPick={c => setLevelColor(l.id, c)} />}
          </li>
        ))}
      </ul>
      <div class="row-actions">
        {d.levels.length < MAX_LEVELS && (
          <button class="pill-btn" onClick={addLevel}><IconPlus size={18} /> Уровень сверху</button>
        )}
        <ResetScale />
      </div>
    </div>
  )
}

function ColorPicker({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div class="picker">
      <div class="picker-grid">
        {SWATCHES.map((c, i) => (
          <button key={c} class={`picker-c${c === value.toUpperCase() ? ' is-on' : ''}`} style={{ background: c }}
            aria-label={`Цвет ${i + 1} из ${SWATCHES.length}`} aria-pressed={c === value.toUpperCase()} onClick={() => onPick(c)} />
        ))}
      </div>
      <label class="picker-own">
        <input type="color" value={value} onInput={e => {
          const v = (e.target as HTMLInputElement).value
          if (isHex(v)) onPick(v)
        }} />
        <span>Свой цвет</span>
        <code>{value}</code>
      </label>
    </div>
  )
}

function ResetScale() {
  const d = data.value
  const [open, setOpen] = useState(false)
  const [n, setN] = useState(d.levels.length)
  if (!open) return <button class="pill-btn ghost" onClick={() => { setN(d.levels.length); setOpen(true) }}>Другое число цветов</button>
  return (
    <div class="reset">
      <div class="stepper">
        <button class="icon-btn" onClick={() => setN(Math.max(MIN_LEVELS, n - 1))} disabled={n <= MIN_LEVELS} aria-label="Меньше">−</button>
        <span class="display stepper-n">{n}</span>
        <button class="icon-btn" onClick={() => setN(Math.min(MAX_LEVELS, n + 1))} disabled={n >= MAX_LEVELS} aria-label="Больше">+</button>
      </div>
      <div class="palette-strip palette-strip--wide">
        {rampColors(PALETTES.find(p => p.id === d.palette)?.stops ?? PALETTES[0].stops, n).map((c, i) => <i key={i} style={{ background: c }} />)}
      </div>
      <p class="muted card-sub">Шкала соберётся заново со стандартными названиями. Уже отмеченные дни встанут на соответствующее место новой шкалы.</p>
      <div class="row-actions">
        <button class="pill-btn" onClick={() => {
          resetScale(n, d.palette === 'custom' ? 'spectrum' : d.palette)
          setOpen(false)
          showToast(`Шкала на ${n} ${plural(n, 'цвет', 'цвета', 'цветов')}`)
        }}>Применить</button>
        <button class="pill-btn ghost" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </div>
  )
}

function TagsEditor() {
  const d = data.value
  const [name, setName] = useState('')
  const [edit, setEdit] = useState<string | null>(null)
  const submit = (e: Event) => {
    e.preventDefault()
    if (addTag(name)) setName('')
    else if (name.trim()) showToast(d.tags.length >= MAX_TAGS ? 'Меток уже слишком много' : 'Такая метка уже есть')
  }
  return (
    <div class="card">
      <h2 class="card-title">Метки</h2>
      <p class="muted card-sub">Отмечайте, что было в течение дня, — в «Итогах» станет видно, что помогает, а что тянет вниз.</p>
      <div class="tags tags--edit">
        {d.tags.map(t => edit === t.id ? (
          <input key={t.id} class="tag tag-input" ref={el => { if (el && document.activeElement !== el) el.focus() }} defaultValue={t.name} maxLength={32} aria-label="Название метки"
            onBlur={e => { renameTag(t.id, (e.target as HTMLInputElement).value); setEdit(null) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        ) : (
          <span key={t.id} class="tag tag--editable">
            <button class="tag-label" onClick={() => setEdit(t.id)} aria-label={`Переименовать метку «${t.name}»`}>{t.name}</button>
            <button class="tag-x" aria-label={`Удалить метку «${t.name}»`} onClick={() => {
              const undo = deleteTag(t.id)
              showToast(`Метка «${t.name}» удалена`, { label: 'Вернуть', run: undo }, 6000)
            }}><IconClose size={14} /></button>
          </span>
        ))}
      </div>
      {d.tags.length < MAX_TAGS && (
        <form class="add-tag" onSubmit={submit}>
          <input value={name} maxLength={32} placeholder="Новая метка" onInput={e => setName((e.target as HTMLInputElement).value)} />
          <button class="pill-btn" type="submit" disabled={!name.trim()}><IconPlus size={18} /> Добавить</button>
        </form>
      )}
    </div>
  )
}

function Look() {
  const s = data.value.settings
  return (
    <div class="card">
      <h2 class="card-title">Вид</h2>
      <div class="field">
        <span class="field-label">Тема</span>
        <Segmented label="Тема" value={s.theme} onChange={v => {
          setSetting('theme', v)
          if (isStandalone()) showToast('Цвет часов и батареи вверху обновится при следующем запуске')
        }}
          options={[{ value: 'system', label: 'Авто' }, { value: 'light', label: 'Светлая' }, { value: 'dark', label: 'Тёмная' }]} />
      </div>
      <div class="field">
        <span class="field-label">Неделя начинается</span>
        <Segmented label="Начало недели" value={s.weekStart} onChange={v => setSetting('weekStart', v)}
          options={[{ value: 0, label: 'С понедельника' }, { value: 6, label: 'С воскресенья' }]} />
      </div>
      <Switch label="Заметка и метки под шкалой" checked={s.showDetails} onChange={v => setSetting('showDetails', v)} />
    </div>
  )
}

function Reminder() {
  return (
    <details class="card disclosure">
      <summary><h2 class="card-title">Напоминание каждый вечер</h2></summary>
      <p class="muted card-sub">Веб-приложение не может само присылать уведомления по расписанию, но это умеет приложение «Команды» на iPhone:</p>
      <ol class="steps">
        <li>Откройте <b>«Команды»</b> → вкладка <b>«Автоматизация»</b> → <b>«+»</b></li>
        <li>Выберите <b>«Время суток»</b>, например 21:30, <b>«Ежедневно»</b>, и <b>«Запускать сразу»</b></li>
        <li>Добавьте действие <b>«Показать уведомление»</b> с текстом «Как прошёл день?»</li>
      </ol>
      <p class="muted card-sub">Действие «Открыть URL» не подойдёт: ссылка откроется в Safari, а у Safari отдельное хранилище — отметки окажутся не в приложении с иконки.</p>
    </details>
  )
}

function DataSection() {
  const d = data.value
  const file = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Data | null>(null)
  const total = Object.keys(d.entries).length
  const days = d.lastBackup ? Math.floor((Date.now() - d.lastBackup) / 86400000) : null

  const exportFile = (kind: 'json' | 'csv') => saveBackup(kind)

  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    try {
      setPending(await readBackup(f))
    } catch (err) {
      showToast((err as Error).message || 'Не удалось прочитать файл')
    }
  }

  return (
    <div class="card">
      <h2 class="card-title">Данные</h2>
      <p class="muted card-sub">
        Всё хранится только на этом устройстве. {total} {plural(total, 'день', 'дня', 'дней')} в цвете.{' '}
        {days == null ? 'Копию вы ещё не сохраняли.' : days === 0 ? 'Копия сохранена сегодня.' : `Последняя копия — ${days} ${plural(days, 'день', 'дня', 'дней')} назад.`}
      </p>
      <div class="row-actions">
        <button class="pill-btn" onClick={() => exportFile('json')}>Сохранить копию</button>
        <button class="pill-btn ghost" onClick={() => file.current?.click()}>Загрузить копию</button>
        <button class="pill-btn ghost" onClick={() => exportFile('csv')}>Таблица CSV</button>
      </div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
      {pending && (
        <div class="import-box">
          <p>В файле {Object.keys(pending.entries).length} {plural(Object.keys(pending.entries).length, 'день', 'дня', 'дней')} и шкала на {pending.levels.length} {plural(pending.levels.length, 'цвет', 'цвета', 'цветов')}.</p>
          <div class="row-actions">
            <button class="pill-btn" onClick={() => { mergeIn(pending); setPending(null); showToast('Копия объединена') }}>Объединить</button>
            <ConfirmButton class="pill-btn ghost" confirm="Текущие отметки пропадут. Точно?"
              onConfirm={() => { replaceAll(pending); setPending(null); showToast('Данные заменены копией') }}>
              Заменить всё
            </ConfirmButton>
            <button class="pill-btn ghost" onClick={() => setPending(null)}>Отмена</button>
          </div>
        </div>
      )}
      <div class="danger-zone">
        <ConfirmButton class="link-btn danger" confirm="Нажмите ещё раз — всё будет стёрто"
          onConfirm={() => { replaceAll({ ...defaultData(), onboarded: true }); showToast('Всё стёрто') }}>
          Стереть все данные
        </ConfirmButton>
      </div>
    </div>
  )
}

function About() {
  return (
    <div class="about">
      <p class="display about-name">Оттенки</p>
      <p class="muted">Каждый день — один цвет. Версия {__APP_VERSION__}.</p>
      <p class="muted">Без регистрации, рекламы и серверов: отметки не покидают ваш телефон.</p>
    </div>
  )
}

type PinStep = 'idle' | 'new' | 'repeat' | 'current'

function PinSection() {
  const has = hasLock.value
  const [step, setStep] = useState<PinStep>('idle')
  const [pin, setPinValue] = useState('')
  const [first, setFirst] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [after, setAfter] = useState<'change' | 'remove'>('change')
  const attempt = useRef(0)

  const reset = () => { attempt.current++; setStep('idle'); setPinValue(''); setFirst(''); setError(false); setBusy(false) }

  // Набранные 4 цифры обрабатываются здесь, а не в обработчике нажатия, — без гонок с медленным хешированием.
  useEffect(() => {
    if (pin.length < PIN_LENGTH || step === 'idle') return
    const id = ++attempt.current
    const live = () => id === attempt.current
    if (step === 'new') { setFirst(pin); setPinValue(''); setStep('repeat'); return }
    if (step === 'repeat') {
      if (pin !== first) {
        showToast('Коды не совпали — попробуйте ещё раз')
        setFirst(''); setPinValue(''); setStep('new')
        return
      }
      setBusy(true)
      setPin(pin).then(() => {
        if (!live()) return
        reset()
        showToast('Код установлен. Его спросят при запуске и после 30 секунд вне приложения')
      }).catch(() => { if (live()) { setBusy(false); showToast('Не удалось сохранить код') } })
      return
    }
    // step === 'current'
    setBusy(true)
    checkPin(pin).then(ok => {
      if (!live()) return
      setBusy(false)
      if (!ok) {
        setError(true)
        setTimeout(() => { if (live()) { setError(false); setPinValue('') } }, 520)
        return
      }
      if (after === 'remove') { clearLock(); reset(); showToast('Код снят') }
      else { setPinValue(''); setStep('new') }
    }).catch(() => { if (live()) { setBusy(false); setPinValue('') } })
  }, [pin, step])

  if (!lockAvailable()) return null

  const prompt = step === 'new' ? 'Придумайте код из 4 цифр' : step === 'repeat' ? 'Повторите код' : 'Введите текущий код'
  return (
    <div class="card">
      <h2 class="card-title">Код-пароль</h2>
      <p class="muted card-sub">Закрывает дневник от случайного взгляда, если кто-то возьмёт телефон. Отметки им не шифруются.</p>
      {step === 'idle' ? (
        <div class="row-actions">
          {has ? (
            <>
              <button class="pill-btn ghost" onClick={() => { setAfter('change'); setStep('current') }}>Сменить код</button>
              <button class="pill-btn ghost" onClick={() => { setAfter('remove'); setStep('current') }}>Снять код</button>
            </>
          ) : (
            <button class="pill-btn" onClick={() => setStep('new')}>Задать код</button>
          )}
        </div>
      ) : (
        <div class="pin-setup">
          <p class="pin-prompt">{error ? 'Неверный код' : prompt}</p>
          <PinDots value={pin} error={error} />
          <Keypad disabled={error || busy}
            onDigit={dgt => setPinValue(p => (p.length < PIN_LENGTH ? p + dgt : p))}
            onBack={() => setPinValue(p => p.slice(0, -1))} />
          <button class="link-btn link-btn--muted" onClick={reset}>Отмена</button>
        </div>
      )}
    </div>
  )
}
