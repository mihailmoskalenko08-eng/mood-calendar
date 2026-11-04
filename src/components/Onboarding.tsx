// Первое знакомство: живая картинка года и выбор палитры.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { readBackup } from '../backup'
import { plural } from '../lib/dates'
import { rampColors } from '../lib/color'
import { PALETTES } from '../lib/model'
import { applyPalette, data, finishOnboarding, replaceAll, resetScale, showToast } from '../state'

export function Onboarding() {
  const d = data.value
  const [step, setStep] = useState(0)
  const [n, setN] = useState(d.levels.length)
  const [pal, setPal] = useState(d.palette === 'custom' ? 'spectrum' : d.palette)
  const colors = rampColors(PALETTES.find(p => p.id === pal)!.stops, n)

  // Демонстрационная мозаика «как будто прожитых» дней
  const seeds = useMemo(() => {
    let s = 7
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    let mood = 0.6
    return Array.from({ length: 216 }, () => {
      mood = Math.min(1, Math.max(0, mood + (rnd() - 0.5) * 0.55))
      return mood
    })
  }, [])
  const [filled, setFilled] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setFilled(seeds.length); return }
    const t = setInterval(() => setFilled(f => {
      if (f >= seeds.length) { clearInterval(t); return f }
      return f + 3
    }), 24)
    return () => clearInterval(t)
  }, [])

  const file = useRef<HTMLInputElement>(null)
  const restore = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    try {
      const next = await readBackup(f)
      replaceAll(next)
      const n = Object.keys(next.entries).length
      showToast(`Загружено: ${n} ${plural(n, 'день', 'дня', 'дней')} в цвете`)
    } catch (err) {
      showToast((err as Error).message)
    }
  }

  const done = () => {
    if (n !== d.levels.length) resetScale(n, pal)
    else applyPalette(pal)
    finishOnboarding()
  }

  return (
    <div class="onboard" role="dialog" aria-modal="true" aria-label="Знакомство">
      <div class="onboard-mosaic" aria-hidden="true">
        {seeds.map((v, i) => (
          <i key={i} class={i < filled ? 'is-on' : ''}
            style={{ background: i < filled ? colors[Math.round(v * (n - 1))] : undefined }} />
        ))}
      </div>

      {step === 0 ? (
        <div class="onboard-text">
          <p class="eyebrow">Дневник без слов</p>
          <h1 class="display onboard-title">Оттенки</h1>
          <p class="onboard-lead">Каждый вечер — один цвет: каким был день. Через месяц это узор, через год — картина твоей жизни.</p>
          <button class="cta" onClick={() => setStep(1)}>Дальше</button>
          <button class="link-btn onboard-restore" onClick={() => file.current?.click()}>Уже вели «Оттенки»? Загрузить копию</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={restore} />
        </div>
      ) : (
        <div class="onboard-text">
          <p class="eyebrow">Шаг 2 из 2</p>
          <h2 class="display onboard-title onboard-title--sm">Своя шкала</h2>
          <div class="onboard-count">
            <span>Сколько оттенков</span>
            <div class="stepper">
              <button class="icon-btn" onClick={() => setN(Math.max(2, n - 1))} disabled={n <= 2} aria-label="Меньше">−</button>
              <span class="display stepper-n">{n}</span>
              <button class="icon-btn" onClick={() => setN(Math.min(10, n + 1))} disabled={n >= 10} aria-label="Больше">+</button>
            </div>
          </div>
          <div class="palettes palettes--onboard" role="radiogroup" aria-label="Палитра">
            {PALETTES.map(p => (
              <button key={p.id} role="radio" aria-checked={pal === p.id} class={`palette${pal === p.id ? ' is-on' : ''}`} onClick={() => setPal(p.id)}>
                <span class="palette-strip">{rampColors(p.stops, n).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <p class="muted onboard-hint">Названия, цвета и количество можно поменять потом в «Ещё».</p>
          <button class="cta" onClick={done}>Начать</button>
        </div>
      )}
    </div>
  )
}
