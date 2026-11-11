// Вход в зашифрованный дневник при запуске приложения на iPhone: Face ID или код.
// Работает до загрузки данных, поэтому не зависит от state.ts.

import { useEffect, useState } from 'preact/hooks'
import { Keypad, PIN_LENGTH, PinDots } from './Keypad'
import type * as Secure from '../native-secure'

export function BootLock({ secure, face, onOpen }: {
  secure: typeof Secure
  face: boolean
  onOpen: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [armed, setArmed] = useState(false)

  const finish = async () => {
    if (await secure.openData()) onOpen()
    else setError('Не удалось открыть данные')
  }

  const tryFace = async () => {
    setBusy(true)
    try {
      await secure.unlockWithFace()
      await finish()
    } catch {
      setError(null)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { if (face) tryFace() }, [])

  useEffect(() => {
    if (pin.length < PIN_LENGTH) return
    setBusy(true)
    secure.unlockWithPin(pin).then(async ok => {
      if (ok) { await finish(); return }
      setError('Неверный код')
      setTimeout(() => { setError(null); setPin('') }, 520)
    }).finally(() => setBusy(false))
  }, [pin])

  return (
    <div class="lock" role="dialog" aria-modal="true" aria-label="Введите код">
      <div class="lock-inner">
        <p class="display lock-title">Оттенки</p>
        <p class="lock-sub">{error ?? (busy && pin.length === PIN_LENGTH ? 'Открываю…' : 'Введите код')}</p>
        <PinDots value={pin} error={error === 'Неверный код'} />
        <Keypad disabled={busy || !!error}
          onDigit={d => setPin(p => (p.length < PIN_LENGTH ? p + d : p))}
          onBack={() => setPin(p => p.slice(0, -1))} />
        {face && <button class="pill-btn ghost lock-face" onClick={tryFace} disabled={busy}>Войти по Face ID</button>}
        {!forgot ? (
          <button class="link-btn link-btn--muted lock-help" onClick={() => setForgot(true)}>Забыли код?</button>
        ) : (
          <div class="lock-forgot">
            <p>Отметки зашифрованы, и без кода {face ? 'или Face ID ' : ''}их не открыть — так задумано. Можно начать заново и загрузить сохранённую копию в «Ещё → Данные».</p>
            <button class={`pill-btn ghost${armed ? ' is-armed' : ''}`} onClick={async () => {
              if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3500); return }
              await secure.wipeEncrypted()
              location.reload()
            }}>{armed ? 'Нажмите ещё раз — данные будут стёрты' : 'Стереть и начать заново'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
