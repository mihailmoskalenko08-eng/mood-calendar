// Общие элементы: нижняя панель, уведомление, переключатель, подтверждение.

import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { hideToast, toast } from '../state'
import { IconClose } from './icons'

export function Sheet({ open, onClose, children, label }: {
  open: boolean
  onClose: () => void
  children: ComponentChildren
  label: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number; scroll: boolean } | null>(null)
  const [shown, setShown] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setShown(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(r)
    }
    setVisible(false)
    const t = setTimeout(() => setShown(false), 320)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('locked')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('locked')
    }
  }, [open])

  if (!shown) return null

  const onTouchStart = (e: TouchEvent) => {
    const el = panel.current
    if (!el) return
    const target = e.target as HTMLElement
    if (target.closest('textarea, input')) return
    drag.current = { y: e.touches[0].clientY, dy: 0, scroll: el.scrollTop > 0 }
  }
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current, el = panel.current
    if (!d || !el || d.scroll) return
    d.dy = Math.max(0, e.touches[0].clientY - d.y)
    el.style.transition = 'none'
    el.style.transform = `translateY(${d.dy}px)`
  }
  const onTouchEnd = () => {
    const d = drag.current, el = panel.current
    drag.current = null
    if (!d || !el) return
    el.style.transition = ''
    el.style.transform = ''
    if (d.dy > 110) onClose()
  }

  return (
    <div class={`sheet-wrap${visible ? ' is-open' : ''}`}>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet" ref={panel} role="dialog" aria-modal="true" aria-label={label}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div class="sheet-grip" aria-hidden="true" />
        <button class="icon-btn sheet-close" onClick={onClose} aria-label="Закрыть"><IconClose size={20} /></button>
        {children}
      </div>
    </div>
  )
}

export function ToastHost() {
  const t = toast.value
  return (
    <div class={`toast${t ? ' is-on' : ''}`} role="status" aria-live="polite">
      {t && (
        <>
          <span>{t.text}</span>
          {t.action && (
            <button onClick={() => { t.action!.run(); hideToast() }}>{t.action.label}</button>
          )}
        </>
      )}
    </div>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  const i = Math.max(0, options.findIndex(o => o.value === value))
  return (
    <div class="segmented" role="radiogroup" aria-label={label}
      style={{ '--n': options.length, '--i': i } as Record<string, number>}>
      <span class="segmented-thumb" aria-hidden="true" />
      {options.map(o => (
        <button role="radio" aria-checked={o.value === value} class={o.value === value ? 'is-on' : ''}
          onClick={() => onChange(o.value)} key={String(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label class="switch-row">
      <span>{label}</span>
      <span class={`switch${checked ? ' is-on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={e => onChange((e.target as HTMLInputElement).checked)} />
        <span class="switch-knob" />
      </span>
    </label>
  )
}

/** Кнопка, которая просит нажать второй раз для подтверждения. */
export function ConfirmButton({ children, confirm, onConfirm, class: cls = '' }: {
  children: ComponentChildren
  confirm: string
  onConfirm: () => void
  class?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button class={`${cls}${armed ? ' is-armed' : ''}`} onClick={() => {
      if (armed) { setArmed(false); onConfirm() } else setArmed(true)
    }}>
      {armed ? confirm : children}
    </button>
  )
}

/** Горизонтальный свайп: вызывает onSwipe(-1 | 1). */
export function useSwipe(onSwipe: (dir: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  return {
    onTouchStart: (e: TouchEvent) => {
      // В полях ввода свайп двигает курсор — не перелистываем
      if ((e.target as HTMLElement).closest('textarea, input, .palettes, .sheet-wrap')) { start.current = null; return }
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x, dy = t.clientY - s.y
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - s.t < 600) onSwipe(dx < 0 ? 1 : -1)
    }
  }
}
