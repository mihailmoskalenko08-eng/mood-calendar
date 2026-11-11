// Лёгкая вибрация. На Android — Vibration API. На iPhone (iOS 18+) Safari даёт отклик
// при переключении системного переключателя <input type="checkbox" switch> — используем его скрытым.

let label: HTMLLabelElement | null = null

function ensure(): HTMLLabelElement | null {
  if (label || typeof document === 'undefined') return label
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.id = 'ottenki-haptic'
  input.tabIndex = -1
  input.setAttribute('aria-hidden', 'true')
  label = document.createElement('label')
  label.htmlFor = input.id
  label.setAttribute('aria-hidden', 'true')
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:-10px'
  wrap.append(input, label)
  document.body.append(wrap)
  return label
}

export function haptic() {
  if (__NATIVE__) { import('../native').then(m => m.hapticNative()).catch(() => {}); return }
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function' && !/iPhone|iPad/.test(navigator.userAgent)) {
      navigator.vibrate(8)
      return
    }
    ensure()?.click()
  } catch {
    /* отклик — приятное дополнение, без него тоже работает */
  }
}
