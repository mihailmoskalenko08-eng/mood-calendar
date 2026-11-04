// Экран кода-пароля и клавиатура для его ввода.

import { signal } from '@preact/signals'
import { useEffect, useState } from 'preact/hooks'
import { haptic } from '../lib/haptic'
import { cancelReset, checkPin, clearLock, readLock, requestReset, resetAt } from '../lib/lock'
import { restoreSession, sheetDay } from '../state'
import { ConfirmButton } from './ui'

/** Приложение закрыто кодом. */
const resumedAt = typeof window !== 'undefined' ? restoreSession() : null
export const locked = signal(typeof localStorage !== 'undefined' && !!readLock() && !(resumedAt && Date.now() - resumedAt < 30_000))
/** Шторка на время, пока приложение свёрнуто: снимок в переключателе приложений не покажет дневник. */
export const shielded = signal(false)
/** Сколько можно отсутствовать, прежде чем код спросят снова. */
const GRACE_MS = 30_000

export function lockNow() {
  locked.value = true
  sheetDay.value = null
  ;(document.activeElement as HTMLElement | null)?.blur?.()
}

if (typeof document !== 'undefined') {
  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (!readLock()) { shielded.value = false; return }
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      shielded.value = true
    } else {
      if (hiddenAt && Date.now() - hiddenAt > GRACE_MS) lockNow()
      shielded.value = false
    }
  })
}

export const PIN_LENGTH = 4

export function Keypad({ onDigit, onBack, disabled }: { onDigit: (d: string) => void; onBack: () => void; disabled?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, [contenteditable]')) return
      if (/^\d$/.test(e.key)) onDigit(e.key)
      else if (e.key === 'Backspace') onBack()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDigit, onBack, disabled])
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
  return (
    <div class="keypad">
      {keys.map((k, i) => k === '' ? <span key={i} /> : (
        <button key={i} class={`key${k === '⌫' ? ' key--back' : ''}`} disabled={disabled}
          aria-label={k === '⌫' ? 'Стереть' : k}
          onClick={() => { haptic(); k === '⌫' ? onBack() : onDigit(k) }}>
          {k}
        </button>
      ))}
    </div>
  )
}

export function PinDots({ value, error }: { value: string; error?: boolean }) {
  return (
    <div class={`pin-dots${error ? ' is-error' : ''}`} aria-label={`Введено ${value.length} из ${PIN_LENGTH}`} role="status">
      {Array.from({ length: PIN_LENGTH }, (_, i) => <i key={i} class={i < value.length ? 'is-on' : ''} />)}
    </div>
  )
}

export function LockScreen() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    if (pin.length < PIN_LENGTH) return
    setBusy(true)
    checkPin(pin).then(ok => {
      setBusy(false)
      if (ok) { cancelReset(); locked.value = false; return }
      haptic()
      setError(true)
      setTimeout(() => { setError(false); setPin('') }, 520)
    }).catch(() => { setBusy(false); setPin('') })
  }, [pin])

  return (
    <div class="lock" role="dialog" aria-modal="true" aria-label="Введите код">
      <div class="lock-inner">
      <p class="display lock-title">Оттенки</p>
      <p class="lock-sub">{error ? 'Неверный код' : 'Введите код'}</p>
      <PinDots value={pin} error={error} />
      <Keypad disabled={busy || error}
        onDigit={d => setPin(p => (p.length < PIN_LENGTH ? p + d : p))}
        onBack={() => setPin(p => p.slice(0, -1))} />
      {!help && !resetAt() ? (
        <button class="link-btn link-btn--muted lock-help" onClick={() => setHelp(true)}>Забыли код?</button>
      ) : <ForgotPin />}
      </div>
    </div>
  )
}

/** Непрозрачная шторка, пока приложение в фоне. */
export function Shield() {
  return (
    <div class="lock lock--shield" aria-hidden="true">
      <p class="display lock-title">Оттенки</p>
    </div>
  )
}

/** Забытый код снимается только через 10 минут ожидания — данные при этом остаются на месте. */
function ForgotPin() {
  const [, tick] = useState(0)
  const at = resetAt()
  useEffect(() => {
    if (!at) return
    const t = setInterval(() => tick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [at])
  const left = at ? Math.max(0, at - Date.now()) : null
  const mm = left != null ? Math.floor(left / 60000) : 0
  const ss = left != null ? String(Math.floor((left % 60000) / 1000)).padStart(2, '0') : '00'
  return (
    <div class="lock-forgot">
      {left == null ? (
        <>
          <p>Код можно снять без него, но только через 10 минут ожидания — чтобы его не сняли мимоходом. Отметки останутся на месте.</p>
          <button class="pill-btn ghost" onClick={() => { requestReset(); tick(x => x + 1) }}>Начать ожидание</button>
        </>
      ) : left > 0 ? (
        <>
          <p>Код можно будет снять через <b class="lock-timer">{mm}:{ss}</b>. Если вспомните — просто введите его.</p>
          <button class="link-btn link-btn--muted" onClick={() => { cancelReset(); tick(x => x + 1) }}>Не снимать</button>
        </>
      ) : (
        <>
          <p>Ожидание прошло.</p>
          <ConfirmButton class="pill-btn ghost" confirm="Нажмите ещё раз, чтобы снять код"
            onConfirm={() => { clearLock(); locked.value = false }}>
            Снять код
          </ConfirmButton>
        </>
      )}
    </div>
  )
}
