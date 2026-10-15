import { Link, useParams } from 'react-router-dom'
import { logoUrl, type PublicNews, type PublicSite } from './api'
import { excerpt, fmtDate, paragraphs, visibleNews } from './format'
import { Crest } from './ui'

/** A news photo, or the school's crest on its colors when the post has none. */
function NewsImage({ site, n, className }: { site: PublicSite; n: PublicNews; className: string }) {
  const url = logoUrl(n.image)
  return (
    <div className={`${className} ${url ? '' : 'no-photo'}`}>
      {url
        ? <img src={url} alt="" loading="lazy" />
        : <Crest src={site.school.logo} initials={site.school.initials} size={56} />}
    </div>
  )
}

const teamName = (site: PublicSite, id?: string | null) => site.teams.find(t => t.id === id)?.name

/** A post as a card: photo, date and team, headline, teaser. */
export function NewsCard({ site, n, featured }: { site: PublicSite; n: PublicNews; featured?: boolean }) {
  const team = teamName(site, n.teamId)
  return (
    <Link to={`/news/${n.id}`} className={`news-card ${featured ? 'featured' : ''}`}>
      <NewsImage site={site} n={n} className="nc-image" />
      <div className="nc-body">
        <div className="nc-meta">
          <span>{fmtDate(n.publishedAt, { weekday: undefined, year: 'numeric' })}</span>
          {team && <span className="nc-team">{team}</span>}
        </div>
        <h3>{n.title}</h3>
        <p>{excerpt(n, featured ? 240 : 140)}</p>
      </div>
    </Link>
  )
}

export function NewsIndex({ site }: { site: PublicSite }) {
  const posts = visibleNews(site)
  return (
    <div className="wrap">
      <h1 className="page-h1">News</h1>
      {posts.length === 0
        ? <p className="empty">No news has been posted yet.</p>
        : <div className="news-grid">{posts.map(n => <NewsCard key={n.id} site={site} n={n} />)}</div>}
    </div>
  )
}

export function Article({ site }: { site: PublicSite }) {
  const { id } = useParams()
  const all = visibleNews(site)
  const n = all.find(x => x.id === id)
  if (!n) {
    return (
      <div className="wrap">
        <p className="crumb"><Link to="/news">← News</Link></p>
        <p className="empty">That story isn't available.</p>
      </div>
    )
  }
  const team = site.teams.find(t => t.id === n.teamId)
  const photo = logoUrl(n.image)
  const more = all.filter(x => x.id !== n.id).slice(0, 3)
  return (
    <div className="wrap">
      <article className="article">
        <p className="crumb"><Link to="/news">← News</Link></p>
        <div className="article-meta">
          <span>{fmtDate(n.publishedAt, { weekday: 'long', year: 'numeric', month: 'long' })}</span>
          {team && <Link to={`/team/${team.id}`} className="nc-team">{team.name}</Link>}
        </div>
        <h1>{n.title}</h1>
        {photo && <img className="article-photo" src={photo} alt="" />}
        {paragraphs(n.body).map((p, i) => (
          <p key={i}>{p.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}{line}</span>)}</p>
        ))}
      </article>
      {more.length > 0 && (
        <section className="article-more">
          <h2 className="section-title">More news</h2>
          <div className="news-grid">{more.map(x => <NewsCard key={x.id} site={site} n={x} />)}</div>
        </section>
      )}
    </div>
  )
}
