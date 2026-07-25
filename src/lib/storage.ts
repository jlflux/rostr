// File uploads via Supabase Storage (a private bucket of real files, separate
// from the JSON app state). Images are stored by *path*; because the bucket is
// private, viewing them needs a short-lived signed URL, which we fetch on demand
// and cache. When Supabase isn't configured (local/demo), storage is disabled and
// the app falls back to its catalog-only behavior.
import { getSupabase } from './supabase'

/** Marker prefix distinguishing a stored file path from a plain/data URL. */
export const STORAGE_PREFIX = 'storage:'

function bucket(): string {
  return import.meta.env.VITE_STORAGE_BUCKET || 'assets'
}

/** Whether real file uploads are available. */
export function storageEnabled(): boolean {
  return getSupabase() !== null
}

/** True for values produced by uploadToStorage() (as opposed to data:/http URLs). */
export function isStoredPath(value?: string): boolean {
  return !!value && value.startsWith(STORAGE_PREFIX)
}

function makePath(folder: string, file: File): string {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const slug = folder.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'misc'
  const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  return `${slug}/${id}.${ext}`
}

/**
 * Upload a file. Returns a `storage:`-prefixed reference to store on the record,
 * or an error message. `folder` groups files within the bucket (e.g. asset type).
 */
export async function uploadToStorage(file: File, folder: string): Promise<{ ref: string } | { error: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Storage is not configured.' }
  const path = makePath(folder, file)
  const { error } = await sb.storage.from(bucket()).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) return { error: error.message }
  return { ref: STORAGE_PREFIX + path }
}

const signedCache = new Map<string, { url: string; expires: number }>()

/** Resolve a `storage:` reference to a temporary viewable URL (cached). */
export async function resolveSignedUrl(ref: string, expiresInSec = 3600): Promise<string | null> {
  if (!isStoredPath(ref)) return ref // already a plain/data URL
  const path = ref.slice(STORAGE_PREFIX.length)
  const cached = signedCache.get(path)
  const now = Date.now()
  if (cached && cached.expires - 60_000 > now) return cached.url
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.storage.from(bucket()).createSignedUrl(path, expiresInSec)
  if (error || !data?.signedUrl) return null
  signedCache.set(path, { url: data.signedUrl, expires: now + expiresInSec * 1000 })
  return data.signedUrl
}

/** Remove a stored file (best effort; ignores errors). */
export async function removeFromStorage(ref?: string): Promise<void> {
  if (!isStoredPath(ref)) return
  const sb = getSupabase()
  if (!sb) return
  const path = ref!.slice(STORAGE_PREFIX.length)
  signedCache.delete(path)
  await sb.storage.from(bucket()).remove([path]).catch(() => {})
}
