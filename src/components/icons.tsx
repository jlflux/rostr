// Minimal inline icon set (stroke-based, lucide-style)
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', width: 16, height: 16 }

export const I = {
  dashboard: () => <svg {...base}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  calendar: () => <svg {...base}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  event: () => <svg {...base}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  sponsor: () => <svg {...base}><path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>,
  team: () => <svg {...base}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  request: () => <svg {...base}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/></svg>,
  asset: () => <svg {...base}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
  report: () => <svg {...base}><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>,
  settings: () => <svg {...base}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  search: () => <svg {...base} width={15} height={15}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  bell: () => <svg {...base}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  chevron: () => <svg {...base} width={14} height={14}><path d="m6 9 6 6 6-6"/></svg>,
  left: () => <svg {...base} width={15} height={15}><path d="m15 18-6-6 6-6"/></svg>,
  right: () => <svg {...base} width={15} height={15}><path d="m9 18 6-6-6-6"/></svg>,
  plus: () => <svg {...base} width={15} height={15}><path d="M12 5v14M5 12h14"/></svg>,
  check: () => <svg {...base} width={12} height={12} strokeWidth={3}><path d="M20 6 9 17l-5-5"/></svg>,
  x: () => <svg {...base} width={15} height={15}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  warn: () => <svg {...base} width={15} height={15}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>,
  menu: () => <svg {...base}><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  sun: () => <svg {...base}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  moon: () => <svg {...base}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  external: () => <svg {...base} width={13} height={13}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>,
  broadcast: () => <svg {...base} width={14} height={14}><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>,
}

const sportBase = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }

const SPORT_SVGS: Record<string, JSX.Element> = {
  Football: <svg {...sportBase}><ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-38 12 12)"/><path d="M9.5 13.5l5-3M10.4 11l1 1.4M12.6 9.7l1 1.4"/></svg>,
  'Flag Football': <svg {...sportBase}><path d="M5 21V4"/><path d="M5 4c3-1.6 6 1.6 9 0v7c-3 1.6-6-1.6-9 0"/></svg>,
  Volleyball: <svg {...sportBase}><circle cx="12" cy="12" r="9"/><path d="M12 3c1.5 3.5 1.5 8-1 12M3.8 8.5c4 .3 8.4 2 11 6M20.2 8.5c-3 2.7-7.4 4.3-12 3.5"/></svg>,
  'Cross Country': <svg {...sportBase}><circle cx="15" cy="4.5" r="1.7"/><path d="M13.5 7.5 9.7 11l3 2.6-2.2 5.9M9.7 11 6.5 10M12.7 13.6l4.3 1.9 2.5-1.2M9 17l-3.5 2.5"/></svg>,
  Cheerleading: <svg {...sportBase}><path d="M4 14 15 4l3 8-9.5 4z"/><path d="M8.5 16.5 10 21M18 12l3-1M17 8.5l2.5-2"/></svg>,
  Basketball: <svg {...sportBase}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.5 5.5c3.5 3.5 3.5 9.5 0 13M18.5 5.5c-3.5 3.5-3.5 9.5 0 13"/></svg>,
}

const SPORT_FALLBACK = <svg {...sportBase}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>

/** Small inline icon representing a sport, with an accessible title. */
export function SportIcon({ sport, size = 20 }: { sport: string; size?: number }) {
  const svg = SPORT_SVGS[sport] ?? SPORT_FALLBACK
  return (
    <span className="sport-svg" title={sport} aria-label={sport} style={{ width: size, height: size, display: 'inline-flex' }}>
      {svg}
    </span>
  )
}
