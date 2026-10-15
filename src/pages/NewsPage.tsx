import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { can, currentOrg, currentUser, defaultSeasonLabel, teams as allTeams } from '../lib/derive'
import { fmtDate, todayISO } from '../lib/dates'
import { Badge, Card, ConfirmDialog, Empty, Field, Modal } from '../components/ui'
import { I } from '../components/icons'
import { StoredImage } from '../components/StoredImage'
import { isStoredPath, storageEnabled, uploadToStorage } from '../lib/storage'
import { publishNewsImage } from '../lib/publicLogos'
import { publicSiteUrl } from '../lib/publicSite'
import type { Asset, NewsPost } from '../types'

const IMAGE_TYPES = /^(png|jpe?g|gif|webp|svg)$/i

/** Where a post stands from a fan's point of view. */
function standing(p: NewsPost, today = todayISO()): { label: string; tone: 'ok' | 'warn' | 'outline' } {
  if (p.status === 'draft') return { label: 'Draft', tone: 'outline' }
  if (p.publishedAt > today) return { label: `Scheduled for ${fmtDate(p.publishedAt)}`, tone: 'warn' }
  return { label: 'Live', tone: 'ok' }
}

/**
 * News for the public site's front page.
 *
 * Posts are written here and appear on the public site on their own — the
 * database rebuilds the public data whenever the school's data changes. Only
 * the photo needs copying, and saving does that too.
 */
export default function NewsPage() {
  const { state, add, update, remove, toast, logActivity } = useStore()
  const me = currentUser(state)
  const org = currentOrg(state)
  const canPost = can(me.role, 'admin') || me.role === 'comms_admin'
  const [editing, setEditing] = useState<NewsPost | 'new' | null>(null)
  const [deleting, setDeleting] = useState<NewsPost | null>(null)

  const posts = useMemo(() => (state.news ?? [])
    .filter(n => n.orgId === org.id)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.publishedAt.localeCompare(a.publishedAt)),
  [state.news, org.id])

  const teamName = (id?: string) => state.teams.find(t => t.id === id)?.name

  const save = async (post: NewsPost, isNew: boolean) => {
    if (isNew) add('news', post)
    else update('news', post.id, post)
    logActivity(`${isNew ? 'posted' : 'updated'} the news post “${post.title}”`)
    setEditing(null)
    if (post.status === 'published' && post.imageAssetId) {
      const err = await publishNewsImage(state, post)
      if (err) { toast(`Saved — but the photo couldn't be published yet: ${err}`, 'error'); return }
    }
    toast(post.status === 'draft' ? 'Draft saved' : isNew ? 'Posted to the public site' : 'Post updated')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">News</h1>
          <p className="page-sub">Posts for the front page of {org.shortName}'s public site. A post tied to a team shows on that team's page too.</p>
        </div>
        {canPost && <button className="btn primary" onClick={() => setEditing('new')}><I.plus /> New post</button>}
      </div>

      <Card pad={false}>
        {posts.length === 0 ? (
          <Empty icon="📰" title="No news yet" hint={canPost ? 'Write the first post — it appears on the public site as soon as it is published.' : undefined} />
        ) : (
          <div className="news-admin-list">
            {posts.map(p => {
              const st = standing(p)
              const image = state.assets.find(a => a.id === p.imageAssetId)
              return (
                <div key={p.id} className="news-admin-row">
                  <div className="news-admin-thumb">
                    {image?.storagePath
                      ? <StoredImage src={image.storagePath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span>📰</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650 }}>{p.title || 'Untitled'}</div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>
                      {fmtDate(p.publishedAt)}{teamName(p.teamId) ? ` · ${teamName(p.teamId)}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {p.pinned && <Badge tone="brand">Pinned</Badge>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {st.label === 'Live' && (
                      <a className="btn sm ghost" href={publicSiteUrl(org, undefined, `/news/${p.id}`)} target="_blank" rel="noreferrer" title="View on the public site">
                        <I.external />
                      </a>
                    )}
                    {canPost && <button className="btn sm" onClick={() => setEditing(p)}><I.edit /> Edit</button>}
                    {canPost && <button className="btn sm ghost" onClick={() => setDeleting(p)} aria-label="Delete post"><I.x /></button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {editing && (
        <PostEditor
          post={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this post?"
          message={`“${deleting.title}” will be removed from the public site straight away. This can't be undone.`}
          confirmLabel="Delete post" danger
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            remove('news', deleting.id)
            logActivity(`deleted the news post “${deleting.title}”`)
            toast('Post deleted')
            setDeleting(null)
          }}
        />
      )}
    </>
  )
}

function PostEditor({ post, onClose, onSave }: {
  post: NewsPost | null
  onClose: () => void
  onSave: (post: NewsPost, isNew: boolean) => void
}) {
  const { state, add, toast } = useStore()
  const org = currentOrg(state)
  const [form, setForm] = useState({
    title: post?.title ?? '',
    summary: post?.summary ?? '',
    body: post?.body ?? '',
    publishedAt: post?.publishedAt ?? todayISO(),
    teamId: post?.teamId ?? '',
    imageAssetId: post?.imageAssetId ?? '',
    pinned: !!post?.pinned,
  })
  const [uploading, setUploading] = useState(false)
  const [tried, setTried] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  const teamOptions = useMemo(() => [...allTeams(state)].sort((a, b) => a.name.localeCompare(b.name)), [state])
  // This school's uploaded images, newest news photos first.
  const images = useMemo(() => state.assets
    .filter(a => a.orgId === org.id && isStoredPath(a.storagePath) && IMAGE_TYPES.test(a.fileType ?? ''))
    .sort((a, b) => Number(b.type === 'News Photo') - Number(a.type === 'News Photo') || b.uploadedAt.localeCompare(a.uploadedAt)),
  [state.assets, org.id])
  const chosen = state.assets.find(a => a.id === form.imageAssetId)

  const upload = async (file: File) => {
    setUploading(true)
    const res = await uploadToStorage(file, 'News Photo', org.id)
    setUploading(false)
    if ('error' in res) { toast(`Upload failed: ${res.error}`, 'error'); return }
    const asset: Asset = {
      id: `as-news-${Date.now()}`, orgId: org.id,
      name: file.name.replace(/\.[^.]+$/, ''), type: 'News Photo',
      fileType: (file.name.split('.').pop() || 'png').toUpperCase(),
      sizeKB: Math.max(1, Math.round(file.size / 1024)), storagePath: res.ref,
      teamId: form.teamId || undefined, season: defaultSeasonLabel(state),
      // Whoever may post may publish their own photo; there is no one to approve it.
      approvalStatus: 'approved', uploadedById: state.currentUserId,
      uploadedAt: todayISO(), tint: org.theme.primary,
    }
    add('assets', asset)
    set('imageAssetId', asset.id)
  }

  const submit = (status: NewsPost['status']) => {
    setTried(true)
    if (!form.title.trim() || !form.body.trim()) return
    const now = new Date().toISOString()
    onSave({
      id: post?.id ?? `news-${Date.now()}`,
      orgId: org.id,
      title: form.title.trim(),
      summary: form.summary.trim() || undefined,
      body: form.body.trim(),
      publishedAt: form.publishedAt || todayISO(),
      teamId: form.teamId || undefined,
      imageAssetId: form.imageAssetId || undefined,
      pinned: form.pinned || undefined,
      status,
      authorId: post?.authorId ?? state.currentUserId,
      createdAt: post?.createdAt ?? now,
      updatedAt: now,
    }, !post)
  }

  const future = form.publishedAt > todayISO()

  return (
    <Modal wide title={post ? 'Edit post' : 'New post'} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => submit('draft')} disabled={uploading}>Save as draft</button>
        <button className="btn primary" onClick={() => submit('published')} disabled={uploading}>
          {future ? 'Schedule' : post?.status === 'published' ? 'Update' : 'Publish'}
        </button>
      </>
    }>
      <Field label="Headline" required error={tried && !form.title.trim() ? 'A post needs a headline' : undefined}>
        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Girls soccer advances to the state semifinal" autoFocus />
      </Field>

      <div className="grid grid-2">
        <Field label="Date">
          <input type="date" value={form.publishedAt} onChange={e => set('publishedAt', e.target.value)} />
        </Field>
        <Field label="Team (optional)">
          <select value={form.teamId} onChange={e => set('teamId', e.target.value)}>
            <option value="">Whole athletic department</option>
            {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>
      {future && <p className="tiny muted" style={{ marginTop: -6 }}>Dated in the future: it goes live on the public site on {fmtDate(form.publishedAt)}.</p>}

      <Field label="Story" required error={tried && !form.body.trim() ? 'Write something for the post' : undefined}>
        <textarea rows={9} value={form.body} onChange={e => set('body', e.target.value)}
          placeholder={'Write the story here.\n\nLeave a blank line between paragraphs.'} />
      </Field>

      <Field label="Front-page teaser (optional)">
        <input value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="Leave blank to use the start of the story" maxLength={200} />
      </Field>

      <Field label="Photo (optional)">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {chosen?.storagePath && (
            <span style={{ width: 96, height: 60, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0 }}>
              <StoredImage src={chosen.storagePath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </span>
          )}
          <select value={form.imageAssetId} onChange={e => set('imageAssetId', e.target.value)} style={{ flex: 1, minWidth: 200 }}>
            <option value="">No photo</option>
            {images.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
          </select>
          {storageEnabled() && (
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              {uploading ? 'Uploading…' : 'Upload new'}
              <input type="file" accept="image/*" hidden disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
            </label>
          )}
        </div>
      </Field>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
        <input type="checkbox" checked={form.pinned} onChange={e => set('pinned', e.target.checked)} />
        Pin to the top of the front page
      </label>
    </Modal>
  )
}
