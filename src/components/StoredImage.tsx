import { useEffect, useState } from 'react'
import { isStoredPath, resolveSignedUrl } from '../lib/storage'

/**
 * Renders an image from either a plain/data URL or a `storage:` reference (which
 * it resolves to a temporary signed URL, since the bucket is private). Shows
 * `fallback` while resolving or if there's nothing to show.
 */
export function StoredImage({ src, alt, className, style, fallback }: {
  src?: string
  alt: string
  className?: string
  style?: React.CSSProperties
  fallback?: React.ReactNode
}) {
  const [url, setUrl] = useState<string | null>(isStoredPath(src) ? null : src ?? null)

  useEffect(() => {
    let active = true
    if (!src) { setUrl(null); return }
    if (!isStoredPath(src)) { setUrl(src); return }
    setUrl(null)
    resolveSignedUrl(src).then(u => { if (active) setUrl(u) })
    return () => { active = false }
  }, [src])

  if (!url) return <>{fallback ?? null}</>
  return <img src={url} alt={alt} className={className} style={style} />
}
