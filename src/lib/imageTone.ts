/**
 * What a logo looks like, so it can be given a backing it shows up on.
 *
 * Schools often upload the version of their logo made for dark backgrounds —
 * white, on a transparent background — and just as often the opposite. Put
 * either on the wrong backing and it disappears: a white logo on a white circle
 * is a white circle. So the image is measured once and the backing follows it.
 *
 * Dependency-free on purpose: the public site's bundle uses this too.
 */

export type LogoTone =
  /** Mostly light marks on a transparent background — needs a dark backing. */
  | 'light'
  /** Mostly dark or colored marks on a transparent background — needs a light one. */
  | 'dark'
  /** Fills its own square with a background color; shown as it is. */
  | 'opaque'
  /** Nothing visible in it at all. */
  | 'empty'

export interface LogoInfo {
  tone: LogoTone
  width: number
  height: number
  /** For an opaque image, the color at its corner, to fill around it. */
  edge?: string
}

const cache = new Map<string, Promise<LogoInfo | null>>()

/** Relative luminance, 0 (black) to 1 (white). */
const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/**
 * Measure an image. Resolves to null when it can't be read — not found, or a
 * server that won't allow its pixels to be inspected — and callers fall back to
 * a plain light backing, which is what the site did before this existed.
 *
 * The measuring copy is loaded separately from the one on screen: asking for
 * pixel access makes a server without permission headers refuse the image
 * outright, and that must never cost the visitor the logo itself.
 */
export function analyzeLogo(url: string): Promise<LogoInfo | null> {
  const hit = cache.get(url)
  if (hit) return hit
  const job = new Promise<LogoInfo | null>(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => resolve(null)
    img.onload = () => {
      try {
        const N = 48
        const c = document.createElement('canvas')
        c.width = N; c.height = N
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, N, N)
        const px = ctx.getImageData(0, 0, N, N).data
        let opaque = 0, clear = 0, light = 0, sum = 0
        for (let i = 0; i < px.length; i += 4) {
          const a = px[i + 3]
          if (a < 40) { clear++; continue }
          opaque++
          const l = lum(px[i], px[i + 1], px[i + 2])
          sum += l
          if (l > 0.8) light++
        }
        const total = N * N
        const info = { width: img.naturalWidth, height: img.naturalHeight }
        if (opaque < total * 0.01) return resolve({ ...info, tone: 'empty' })
        if (clear < total * 0.04) {
          const edge = `rgb(${px[0]}, ${px[1]}, ${px[2]})`
          return resolve({ ...info, tone: 'opaque', edge })
        }
        // Light when most of what's drawn is near-white. A logo with a white
        // fill but a strong dark outline averages darker and counts as dark,
        // which is right: the outline carries it on a light backing.
        const tone: LogoTone = light / opaque > 0.6 || sum / opaque > 0.78 ? 'light' : 'dark'
        resolve({ ...info, tone })
      } catch {
        resolve(null)   // pixels not readable from this origin
      }
    }
    img.src = url
  })
  cache.set(url, job)
  return job
}
