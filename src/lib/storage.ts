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

/**
 * Every file lives under the id of the school that owns it. The bucket's access
 * rules read that first segment to decide who may touch the file, so a path
 * without it cannot be protected — one school's staff could list and download
 * another's uploads.
 *
 * Platform-wide files (the shared tab icon) use `__platform__`.
 */
function makePath(owner: string, folder: string, file: File): string {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const slug = folder.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'misc'
  const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  return `${owner}/${slug}/${id}.${ext}`
}

/** The school (or `__platform__`) a stored file belongs to, by its path. */
export function ownerOfPath(ref: string): string | null {
  if (!isStoredPath(ref)) return null
  const first = ref.slice(STORAGE_PREFIX.length).split('/')[0]
  return first || null
}

/** True for a file uploaded before paths carried the owning school. */
export function isLegacyPath(ref: string, owner: string): boolean {
  return isStoredPath(ref) && ownerOfPath(ref) !== owner
}

/**
 * Upload a file. Returns a `storage:`-prefixed reference to store on the record,
 * or an error message. `folder` groups files within the bucket (e.g. asset type),
 * and `owner` is the school the file belongs to — it decides who can reach it.
 */
export async function uploadToStorage(file: File, folder: string, owner: string): Promise<{ ref: string } | { error: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Storage is not configured.' }
  if (!owner) return { error: 'No school selected for this upload.' }
  const path = makePath(owner, folder, file)
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

// ---------- The public site's images ----------
//
// The bucket above is private: its files are reached through signed URLs that
// expire, which is right for rosters and documents but cannot back a public web
// page. The handful of images that appear publicly are copied into a second,
// public bucket, at a path derived from the school and asset ids so the database
// projection can name the file without knowing whether it has been copied yet.

function publicBucket(): string {
  return import.meta.env.VITE_PUBLIC_STORAGE_BUCKET || 'public-assets'
}

/** Where a logo lives publicly. Must match `supabase/public-site.sql`. */
export function publicLogoPath(orgId: string, assetId: string): string {
  return `${orgId}/${assetId}`
}

/**
 * Where the school's own logo lives publicly.
 *
 * Opponent and sponsor logos are asset records, so their public path can be
 * derived from an asset id. The school's logo is a plain storage path on the
 * school record, so it gets a fixed name instead. Must match the same file.
 */
export function publicSchoolLogoPath(orgId: string): string {
  return `${orgId}/school`
}

/**
 * Copy one stored file into the public bucket, replacing whatever is there.
 * Returns an error message, or null on success.
 */
export async function copyToPublicBucket(ref: string, publicPath: string): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return 'Storage is not configured.'
  if (!isStoredPath(ref)) return 'That file was never uploaded.'
  const path = ref.slice(STORAGE_PREFIX.length)

  const { data: file, error: readErr } = await sb.storage.from(bucket()).download(path)
  if (readErr || !file) return readErr?.message ?? 'Could not read the file.'

  const { error: writeErr } = await sb.storage.from(publicBucket()).upload(publicPath, file, {
    contentType: file.type || undefined,
    upsert: true,
  })
  return writeErr ? writeErr.message : null
}

/** Remove a file from the public bucket (best effort). */
export async function removeFromPublicBucket(publicPath: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  await sb.storage.from(publicBucket()).remove([publicPath]).catch(() => {})
}

/**
 * Move a stored file to a new path, keeping its contents. Used to bring files
 * uploaded before per-school paths under the owning school's folder.
 */
export async function movePath(fromRef: string, toPath: string): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return 'Storage is not configured.'
  if (!isStoredPath(fromRef)) return 'That file was never uploaded.'
  const from = fromRef.slice(STORAGE_PREFIX.length)
  if (from === toPath) return null

  // Copy, then delete — not the storage API's own move. A move is an UPDATE of
  // the file's record, and a bucket set up with read/upload/delete rules but no
  // update rule refuses it as "Object not found" on a file that is plainly
  // there. Copy needs read + upload, delete needs delete: the rules every bucket
  // here has had from the start.
  const { error: copyErr } = await sb.storage.from(bucket()).copy(from, toPath)
  // Already at the destination (an earlier run copied it but stopped short of
  // the delete): carry on and finish the job.
  if (copyErr && !/already exists|duplicate/i.test(copyErr.message)) return copyErr.message

  const { error: removeErr } = await sb.storage.from(bucket()).remove([from])
  // The copy is safe either way. A leftover original is clutter, not a fault,
  // so it doesn't fail the move — the record is pointed at the new copy.
  if (removeErr) console.warn('[storage] moved but could not remove the original', from, removeErr)
  signedCache.delete(from)
  return null
}

/**
 * Whether a file is actually in the bucket at that path.
 *
 * Used to tell "this file is somewhere else" apart from "this file is gone",
 * which are the same error from a move.
 */
export async function fileExistsAt(path: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const cut = path.lastIndexOf('/')
  const dir = cut < 0 ? '' : path.slice(0, cut)
  const name = path.slice(cut + 1)
  const { data, error } = await sb.storage.from(bucket()).list(dir, { limit: 100, search: name })
  return !error && !!data?.some(f => f.name === name)
}

/** Where a legacy file should live, keeping its folder and filename. */
export function repathFor(ref: string, owner: string): string {
  const path = ref.slice(STORAGE_PREFIX.length)
  return `${owner}/${path}`
}
