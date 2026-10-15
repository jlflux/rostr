import type { PublicSocials } from './api'

type Network = keyof PublicSocials

const NETWORKS: { key: Network; label: string; base: string; at: boolean }[] = [
  { key: 'instagram', label: 'Instagram', base: 'https://instagram.com/', at: false },
  { key: 'x',         label: 'X',         base: 'https://x.com/',         at: false },
  { key: 'facebook',  label: 'Facebook',  base: 'https://facebook.com/',  at: false },
  { key: 'youtube',   label: 'YouTube',   base: 'https://youtube.com/',   at: true },
  { key: 'tiktok',    label: 'TikTok',    base: 'https://tiktok.com/',    at: true },
]

/**
 * Turn whatever the school typed into a link: a full URL is kept, a bare
 * "instagram.com/…" gets its https, and a handle becomes that network's
 * profile address. Anything that can't be a handle is dropped rather than
 * linked somewhere wrong.
 */
export function socialHref(network: Network, value?: string | null): string | null {
  const v = value?.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (/^[\w-]+(\.[\w-]+)+\//.test(v)) return `https://${v}`
  const handle = v.replace(/^@/, '')
  if (!/^[\w.-]+$/.test(handle)) return null
  const n = NETWORKS.find(x => x.key === network)!
  return `${n.base}${n.at ? '@' : ''}${handle}`
}

/** The accounts that resolve to a link, in a fixed order. */
export function socialLinks(socials?: PublicSocials | null) {
  return NETWORKS
    .map(n => ({ ...n, href: socialHref(n.key, socials?.[n.key]) }))
    .filter((n): n is typeof n & { href: string } => !!n.href)
}

const P = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const

export function SocialIcon({ network }: { network: Network }) {
  switch (network) {
    case 'instagram': return <svg {...P}><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1C2.6 9.9 2.6 10.3 2.6 12s0 2.1.1 3.3c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-3.3s0-2.1-.1-3.3c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.6-1.3-.8-.4-.2-1-.3-2.1-.4C15.5 4 15.1 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 8a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm6.2-8.2a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0Z"/></svg>
    case 'x': return <svg {...P}><path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>
    case 'facebook': return <svg {...P}><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg>
    case 'youtube': return <svg {...P}><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12c0 1.6.2 3.2.5 4.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.3-1.6.5-3.2.5-4.8s-.2-3.2-.5-4.8ZM9.8 15V9l5.8 3-5.8 3Z"/></svg>
    case 'tiktok': return <svg {...P}><path d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v2.6c-1.4.1-2.6-.3-3.9-1.1v5.4c0 6.8-7.4 8.9-10.4 4-1.9-3.1-.7-8.6 5.6-8.8v2.8c-.5.1-1 .2-1.4.4-1.4.5-2.2 1.4-2 3 .4 3.1 6.1 4 5.6-2V3h2.6Z"/></svg>
  }
}

/** A row of linked social icons. Renders nothing when no account is set. */
export function SocialRow({ socials, className = 'social-row', label }: {
  socials?: PublicSocials | null; className?: string; label?: string
}) {
  const links = socialLinks(socials)
  if (links.length === 0) return null
  return (
    <div className={className}>
      {links.map(l => (
        <a key={l.key} href={l.href} target="_blank" rel="noreferrer"
          aria-label={`${label ?? ''} ${l.label}`.trim()} title={l.label}>
          <SocialIcon network={l.key} />
        </a>
      ))}
    </div>
  )
}
