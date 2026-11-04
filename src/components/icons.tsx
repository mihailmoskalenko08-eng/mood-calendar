// Иконки — тонкие линии, рисуются цветом текста.

import type { JSX, SVGAttributes } from 'preact'

type P = SVGAttributes<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...rest }: P & { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={1.6}
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

export const IconToday = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.2" /><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" /></Svg>
)
export const IconMonth = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
    <path d="M3.5 9.5h17M8 3v3M16 3v3" />
    <rect x="7" y="12.5" width="3" height="3" rx=".8" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconYear = (p: P) => (
  <Svg {...p}>
    {[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => (
      <rect x={4 + c * 4.3} y={4 + r * 4.3} width="3" height="3" rx=".8"
        fill={(r * 4 + c) % 3 === 0 ? 'currentColor' : 'none'} stroke-width={1.3} />
    ))).flat()}
  </Svg>
)
export const IconStats = (p: P) => (
  <Svg {...p}><path d="M4.5 20V13M9.5 20V6M14.5 20v-9M19.5 20V9" /></Svg>
)
export const IconMore = (p: P) => (
  <Svg {...p}><circle cx="5.5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" /></Svg>
)
export const IconLeft = (p: P) => <Svg {...p}><path d="M14.5 6l-6 6 6 6" /></Svg>
export const IconRight = (p: P) => <Svg {...p}><path d="M9.5 6l6 6-6 6" /></Svg>
export const IconUp = (p: P) => <Svg {...p}><path d="M6 14.5l6-6 6 6" /></Svg>
export const IconDown = (p: P) => <Svg {...p}><path d="M6 9.5l6 6 6-6" /></Svg>
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>
export const IconClose = (p: P) => <Svg {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></Svg>
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const IconTrash = (p: P) => (
  <Svg {...p}><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.5 7M10.2 10.5v5.5M13.8 10.5v5.5" /></Svg>
)
export const IconShare = (p: P) => (
  <Svg {...p}><path d="M12 3.5v11M8 7.5l4-4 4 4M6 11.5H5v8.5h14v-8.5h-1" /></Svg>
)
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6" /><path d="M15.5 15.5L20 20" /></Svg>
export const IconNote = (p: P) => <Svg {...p}><path d="M5 5.5h14M5 10h14M5 14.5h9" /></Svg>
