// Где запущено приложение.

/** Открыто с иконки на экране «Домой» (а не во вкладке браузера). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** iPhone или iPad во вкладке Safari — там у сайта и у приложения с иконки разные хранилища. */
export function isIosBrowserTab(): boolean {
  if (typeof navigator === 'undefined') return false
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios && !isStandalone()
}
