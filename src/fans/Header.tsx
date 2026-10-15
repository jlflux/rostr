import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { PublicSite } from './api'
import { programsBySeason } from './format'
import { SocialRow } from './social'
import { Crest } from './ui'

/**
 * The site header: the school's name and crest, the main sections, and a
 * Teams menu listing every program by season.
 *
 * On a wide screen Teams opens a panel under the bar. On a phone the whole
 * navigation folds into one menu button, with the teams under it in the same
 * season order. Either closes on navigation, Escape, or a click elsewhere.
 */
export function Header({ site }: { site: PublicSite }) {
  const [teamsOpen, setTeamsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const ref = useRef<HTMLElement>(null)
  const seasons = programsBySeason(site)
  const hasNews = site.news.length > 0

  // Any navigation closes whatever was open.
  useEffect(() => { setTeamsOpen(false); setMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!teamsOpen && !menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setTeamsOpen(false); setMenuOpen(false) } }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setTeamsOpen(false); setMenuOpen(false) }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [teamsOpen, menuOpen])

  const onTeamPage = location.pathname.startsWith('/team')

  return (
    <header className="site-header" ref={ref}>
      <div className="sh-bar">
        <Link to="/" className="sh-brand">
          <Crest src={site.school.logo} initials={site.school.initials} size={44} />
          <span className="sh-name">
            <strong>{site.school.shortName}</strong>
            <span>Athletics</span>
          </span>
        </Link>

        <nav className="sh-nav" aria-label="Main">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/schedule">Schedule</NavLink>
          <button type="button" className={`sh-teams ${teamsOpen || onTeamPage ? 'on' : ''}`}
            aria-expanded={teamsOpen} aria-haspopup="true" onClick={() => setTeamsOpen(v => !v)}>
            Teams <Chevron open={teamsOpen} />
          </button>
          {hasNews && <NavLink to="/news">News</NavLink>}
        </nav>

        <SocialRow socials={site.school.socials} className="sh-social" label={site.school.shortName} />

        <button type="button" className="sh-menu-btn" aria-expanded={menuOpen} aria-label="Menu"
          onClick={() => setMenuOpen(v => !v)}>
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {teamsOpen && (
        <div className="teams-panel" role="menu">
          <div className="tp-inner">
            {seasons.map(s => (
              <div key={s.season} className="tp-season">
                <h3>{s.season}</h3>
                <ul>
                  {s.programs.map(p => (
                    <li key={p.key}>
                      <span className="tp-program">{p.label}</span>
                      <span className="tp-levels">
                        {p.teams.map(t => <Link key={t.id} to={`/team/${t.id}`}>{t.level}</Link>)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="tp-foot"><Link to="/teams">All teams →</Link></div>
        </div>
      )}

      {menuOpen && (
        <div className="mobile-menu">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/schedule">Schedule</NavLink>
          {hasNews && <NavLink to="/news">News</NavLink>}
          <NavLink to="/teams" end>All teams</NavLink>
          {seasons.map(s => (
            <div key={s.season} className="mm-season">
              <h3>{s.season}</h3>
              {s.programs.map(p => (
                <div key={p.key} className="mm-program">
                  <span>{p.label}</span>
                  <span className="tp-levels">
                    {p.teams.map(t => <Link key={t.id} to={`/team/${t.id}`}>{t.level}</Link>)}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <SocialRow socials={site.school.socials} className="mm-social" label={site.school.shortName} />
        </div>
      )}
    </header>
  )
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
