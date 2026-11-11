// Клавиатура и точки кода. Без зависимостей от состояния — используется и до загрузки данных.

import { useEffect } from 'preact/hooks'
import { haptic } from '../lib/haptic'

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

