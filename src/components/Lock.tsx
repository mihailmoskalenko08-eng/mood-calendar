// Экран кода-пароля и клавиатура для его ввода.

import { signal } from '@preact/signals'
import { useEffect, useState } from 'preact/hooks'
import { haptic } from '../lib/haptic'
import { checkPin, clearLock, readLock } from '../lib/lock'
import { ConfirmButton } from './ui'

/** Приложение закрыто кодом. */
export const locked = signal(typeof localStorage !== 'undefined' && !!readLock())
/** Сколько можно отсутствовать, прежде чем код спросят снова. */
const GRACE_MS = 30_000

if (typeof document !== 'undefined') {
  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
    else if (readLock() && hiddenAt && Date.now() - hiddenAt > GRACE_MS) locked.value = true
  })
}

export const PIN_LENGTH = 4

export function Keypad({ onDigit, onBack, disabled }: { onDigit: (d: string) => void; onBack: () => void; disabled?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return
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
      if (ok) { locked.value = false; return }
      haptic()
      setError(true)
      setTimeout(() => { setError(false); setPin('') }, 520)
    })
  }, [pin])

  return (
    <div class="lock" role="dialog" aria-modal="true" aria-label="Введите код">
      <p class="display lock-title">Оттенки</p>
      <p class="lock-sub">{error ? 'Неверный код' : 'Введите код'}</p>
      <PinDots value={pin} error={error} />
      <Keypad disabled={busy || error}
        onDigit={d => setPin(p => (p.length < PIN_LENGTH ? p + d : p))}
        onBack={() => setPin(p => p.slice(0, -1))} />
      {!help ? (
        <button class="link-btn link-btn--muted lock-help" onClick={() => setHelp(true)}>Забыли код?</button>
      ) : (
        <div class="lock-forgot">
          <p>Код закрывает экран от случайного взгляда, отметки им не шифруются. Его можно снять — данные останутся на месте.</p>
          <ConfirmButton class="pill-btn ghost" confirm="Нажмите ещё раз, чтобы снять код"
            onConfirm={() => { clearLock(); locked.value = false }}>
            Снять код
          </ConfirmButton>
        </div>
      )}
    </div>
  )
}
