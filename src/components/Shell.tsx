import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { useAuth } from '../lib/auth'
import { StoredImage } from './StoredImage'
import { resolveSignedUrl } from '../lib/storage'
import { I } from './icons'
import { Avatar } from './ui'
import { ROLE_LABELS, SECTION_LABELS, canSee, sectionLabel, openRequests, overdueTasks, unfilledSlots } from '../lib/derive'
import { fmtDateTime } from '../lib/dates'

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return ref
}

function GlobalSearch() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const ref = useClickOutside(() => { setOpen(false); setMobileOpen(false) })

  const me = state.users.find(u => u.id === state.currentUserId)!
  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []
    const out: { kind: string; label: string; sub: string; to: string }[] = []
    const match = (s?: string) => !!s && s.toLowerCase().includes(term)
    for (const e of state.events) {
      if (match(e.opponent) || match(e.sport) || match(e.venue) || match(e.designation)) {
        out.push({ kind: 'Event', label: `${e.sport} ${e.level} vs ${e.opponent}`, sub: e.date, to: `/events/${e.id}` })
      }
    }
    if (canSee(state, me.role, 'sponsors')) for (const s of state.sponsors) if (match(s.name) || match(s.contactName)) out.push({ kind: 'Sponsor', label: s.name, sub: `${s.tier} tier`, to: `/sponsors/${s.id}` })
    if (canSee(state, me.role, 'teams')) for (const t of state.teams) if (match(t.name) || match(t.sport)) out.push({ kind: 'Team', label: t.name, sub: t.seasonLabel, to: `/teams/${t.id}` })
    if (canSee(state, me.role, 'opponents')) for (const o of state.opponents) if (!o.deletedAt && (match(o.name) || match(o.mascot))) out.push({ kind: 'Opponent', label: o.name, sub: o.mascot ?? 'Opponent', to: `/opponents?open=${o.id}` })
    if (canSee(state, me.role, 'requests')) for (const r of state.requests) if (match(r.title)) out.push({ kind: 'Request', label: r.title, sub: r.type, to: `/requests/${r.id}` })
    for (const a of state.assets) if (match(a.name)) out.push({ kind: 'Asset', label: a.name, sub: a.type, to: '/assets' })
    if (canSee(state, me.role, 'settings')) for (const u of state.users) if (match(u.name)) out.push({ kind: 'Person', label: u.name, sub: u.title, to: '/settings' })
    return out.slice(0, 12)
  }, [q, state])

  const go = (to: string) => { navigate(to); setOpen(false); setMobileOpen(false); setQ('') }

  return (
    <>
      {/* On phones the field collapses to this magnifying-glass button */}
      <button className="iconbtn gsearch-trigger" aria-label="Search" onClick={() => { setMobileOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}>
        <I.search />
      </button>
      <div className={`gsearch ${mobileOpen ? 'mobile-open' : ''}`} ref={ref}>
        <span className="icon"><I.search /></span>
        <input
          ref={inputRef}
          placeholder="Search events, sponsors, teams, requests…"
          value={q}
          aria-label="Global search"
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {mobileOpen && <button className="gsearch-close" aria-label="Close search" onClick={() => { setMobileOpen(false); setQ('') }}>×</button>}
        {open && q.trim().length >= 2 && (
          <div className="gsearch-results">
            {results.length === 0 && <div style={{ padding: '14px', fontSize: '0.85rem', color: 'var(--text-3)' }}>No matches for “{q}”</div>}
            {results.map((r, i) => (
              <a key={i} onClick={() => go(r.to)} style={{ cursor: 'pointer' }}>
                <span className="kind">{r.kind}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.label}</div>
                  <div className="tiny">{r.sub}</div>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function OrgSelector() {
  const { state, setState, toast } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const org = state.orgs.find(o => o.id === state.currentOrgId)!
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="org-select" onClick={() => setOpen(v => !v)} aria-haspopup="true" aria-expanded={open}>
        <span className="org-name">{org.shortName}</span>
        <I.chevron />
      </button>
      {open && (
        <div className="menu">
          <div className="menu-label">Organizations</div>
          {state.orgs.map(o => (
            <button key={o.id} className={`menu-item ${o.id === state.currentOrgId ? 'active' : ''}`}
              onClick={() => {
                setState({ currentOrgId: o.id })
                setOpen(false)
                if (o.id !== org.id) toast(`Switched to ${o.name}`)
              }}>
              <span>
                <div style={{ fontWeight: 600 }}>{o.name}</div>
                <div className="tiny">{o.city}, {o.state} · {o.mascot}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const overdue = overdueTasks(state)
  const gaps = unfilledSlots(state)
  const reqs = openRequests(state).filter(r => r.status === 'submitted')
  const count = overdue.length + reqs.length
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="iconbtn" onClick={() => setOpen(v => !v)} aria-label={`Notifications (${count})`}>
        <I.bell />
        {count > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="menu" style={{ minWidth: 330 }}>
          <div className="menu-head"><strong>Notifications</strong></div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {overdue.slice(0, 4).map(t => (
              <div key={t.id} className="notif-item">
                <span style={{ color: 'var(--danger)' }}><I.warn /></span>
                <span><strong>Overdue:</strong> {t.title}<div className="tiny">Due {t.dueDate}</div></span>
              </div>
            ))}
            {reqs.slice(0, 4).map(r => (
              <Link to={`/requests/${r.id}`} key={r.id} className="notif-item" onClick={() => setOpen(false)}>
                <span style={{ color: 'var(--info)' }}><I.request /></span>
                <span><strong>New request:</strong> {r.title}<div className="tiny">Needed by {r.neededBy}</div></span>
              </Link>
            ))}
            {gaps.slice(0, 3).map(g => (
              <Link to={`/events/${g.event.id}`} key={g.event.id} className="notif-item" onClick={() => setOpen(false)}>
                <span style={{ color: 'var(--warn)' }}><I.team /></span>
                <span>{g.count} unfilled staff {g.count === 1 ? 'role' : 'roles'} — {g.event.sport} vs {g.event.opponent}<div className="tiny">{g.event.date}</div></span>
              </Link>
            ))}
            {count === 0 && gaps.length === 0 && <div style={{ padding: 16, fontSize: '0.85rem', color: 'var(--text-3)' }}>You're all caught up.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { state, setState, toast } = useStore()
  const { enabled: authOn, email, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const user = state.users.find(u => u.id === state.currentUserId)!
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button style={{ background: 'none', border: 'none', padding: 0, display: 'flex' }} onClick={() => setOpen(v => !v)} aria-label="User menu">
        <Avatar user={user} />
      </button>
      {open && (
        <div className="menu">
          <div className="menu-head">
            <div style={{ fontWeight: 700 }}>{user.name}</div>
            <div className="tiny">{user.title} · {ROLE_LABELS[user.role]}</div>
            {authOn && email && <div className="tiny muted">{email}</div>}
          </div>
          {authOn ? (
            <button className="menu-item" onClick={async () => { setOpen(false); await signOut() }}>
              <span><div style={{ fontWeight: 600 }}>Sign out</div></span>
            </button>
          ) : (
            <>
              <div className="menu-label">View as (demo)</div>
              {state.users.filter(u => u.status !== 'revoked').slice(0, 16).map(u => (
                <button key={u.id} className={`menu-item ${u.id === state.currentUserId ? 'active' : ''}`}
                  onClick={() => { setState({ currentUserId: u.id }); setOpen(false); toast(`Now viewing as ${u.name} (${ROLE_LABELS[u.role]})`) }}>
                  <Avatar user={u} size="sm" />
                  <span>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div className="tiny">{ROLE_LABELS[u.role]}</div>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

type NavItem = { to: string; label: string; icon: () => JSX.Element; end?: boolean; section: import('../lib/derive').Section }

/** Preferred order for the mobile bottom bar — action-oriented, not the full list. */
const MOBILE_TAB_ORDER = ['/', '/events', '/sponsors', '/requests']

/** Shorter labels for the tab bar, where width is tight. Sidebar keeps its own. */
const MOBILE_LABELS: Record<string, string> = { '/': 'Home' }

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: I.dashboard, end: true, section: 'dashboard' },
  { to: '/calendar', label: 'Calendar', icon: I.calendar, section: 'calendar' },
  { to: '/events', label: 'Events', icon: I.event, section: 'events' },
  { to: '/opponents', label: 'Opponents', icon: I.team, section: 'opponents' },
  { to: '/sponsors', label: 'Sponsors', icon: I.sponsor, section: 'sponsors' },
  { to: '/teams', label: 'Teams', icon: I.team, section: 'teams' },
  { to: '/requests', label: 'Requests', icon: I.request, section: 'requests' },
  { to: '/assets', label: 'Assets', icon: I.asset, section: 'assets' },
  { to: '/reports', label: 'Reports', icon: I.report, section: 'reports' },
  { to: '/settings', label: 'Settings', icon: I.settings, section: 'settings' },
  { to: '/platform', label: 'Platform', icon: I.sponsor, section: 'platform' },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, toasts, theme, setTheme } = useStore()
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const contentRef = useRef<HTMLElement>(null)
  useEffect(() => setNavOpen(false), [location.pathname])
  // Start every page at the top rather than inheriting the previous scroll position
  useEffect(() => { contentRef.current?.scrollTo(0, 0) }, [location.pathname])
  const org = state.orgs.find(o => o.id === state.currentOrgId)!
  const me = state.users.find(u => u.id === state.currentUserId)!
  const nav = NAV.filter(n => canSee(state, me.role, n.section))
  const openReqCount = openRequests(state).filter(r => r.status === 'submitted').length
  // Bottom bar shows the four most useful destinations on a phone, then "More".
  // Priority items the current role can't see are skipped and topped up from the
  // rest of their nav, so every role gets a full bar.
  const tabs = [
    ...MOBILE_TAB_ORDER.map(to => nav.find(n => n.to === to)).filter((n): n is NavItem => !!n),
    ...nav.filter(n => !MOBILE_TAB_ORDER.includes(n.to)),
  ].slice(0, 4)

  useEffect(() => {
    document.documentElement.style.setProperty('--brand', org.theme.primary)
    document.documentElement.style.setProperty('--brand-navy', org.theme.navy)
  }, [org])

  useEffect(() => {
    document.title = `${org.shortName} Command Center — Powered by Flux Athletics`
  }, [org])

  // Swap the browser-tab icon for the org's uploaded favicon (or its logo).
  // Uploads live in a private bucket, so the URL has to be signed and re-signed;
  // the default icon from index.html stays put until one resolves.
  useEffect(() => {
    const ref = org.faviconUrl ?? org.logoUrl
    if (!ref) return
    let active = true
    resolveSignedUrl(ref).then(url => {
      if (!active || !url) return
      const link = document.getElementById('app-favicon') as HTMLLinkElement | null
      if (link) link.href = url
    })
    return () => { active = false }
  }, [org.faviconUrl, org.logoUrl])

  return (
    <div className="shell">
      {navOpen && <div className="backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <span className="mark">
            {org.logoUrl ? <StoredImage src={org.logoUrl} alt={`${org.shortName} logo`} fallback={<>{org.initials}</>} /> : org.initials}
          </span>
          <span>{org.shortName}<small>Athletics Command Center</small></span>
        </div>
        <nav className="nav">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <n.icon />
              {sectionLabel(state, n.section)}
              {n.section === 'requests' && openReqCount > 0 && <span className="count">{openReqCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          Powered by Flux Athletics<br />Demo date: {state.demoToday}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="iconbtn hamburger" onClick={() => setNavOpen(true)} aria-label="Open menu"><I.menu /></button>
          <GlobalSearch />
          <div style={{ flex: 1 }} />
          <OrgSelector />
          <button className="iconbtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <I.sun /> : <I.moon />}
          </button>
          <Notifications />
          <UserMenu />
        </header>
        <main className="content" ref={contentRef}><div className="content-inner">{children}</div></main>
      </div>
      <nav className="bottom-nav" aria-label="Main">
        {tabs.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `bottom-tab${isActive ? ' active' : ''}`}>
            <span className="bt-icon">
              <n.icon />
              {n.section === 'requests' && openReqCount > 0 && <span className="bt-dot">{openReqCount}</span>}
            </span>
            {/* A school's custom name wins over the short mobile label. */}
            <span className="bt-label">
              {sectionLabel(state, n.section) !== SECTION_LABELS[n.section]
                ? sectionLabel(state, n.section)
                : MOBILE_LABELS[n.to] ?? n.label}
            </span>
          </NavLink>
        ))}
        <button type="button" className="bottom-tab" onClick={() => setNavOpen(true)} aria-label="More navigation">
          <span className="bt-icon"><I.menu /></span>
          <span className="bt-label">More</span>
        </button>
      </nav>
      <div className="toasts">
        {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'success' ? <I.check /> : <I.warn />} {t.msg}</div>)}
      </div>
    </div>
  )
}
