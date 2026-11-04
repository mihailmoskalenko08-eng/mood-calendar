// Небольшой праздник из квадратиков цветов шкалы — без библиотек, на CSS-анимациях.

export function confetti(colors: string[], count = 46) {
  if (typeof document === 'undefined') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.createElement('div')
  layer.className = 'confetti'
  layer.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i')
    const size = 7 + Math.random() * 9
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `width:${size}px`,
      `height:${size}px`,
      `background:${colors[i % colors.length]}`,
      `--dx:${(Math.random() - 0.5) * 160}px`,
      `--rot:${(Math.random() - 0.5) * 720}deg`,
      `animation-delay:${Math.random() * 260}ms`,
      `animation-duration:${1400 + Math.random() * 900}ms`
    ].join(';')
    layer.append(p)
  }
  document.body.append(layer)
  setTimeout(() => layer.remove(), 2800)
}

export const MILESTONES = [7, 30, 100, 200, 365, 500, 1000]
