# Turn on real file uploads (images & assets)

This lets people upload real images and files — asset library items and the school
logo — instead of the placeholder catalog records. Files live in **Supabase
Storage** (a private file bucket), separate from the app data.

You chose **private** storage: only **signed-in** people can view uploaded files.
Because of that, uploads become viewable only once logins are on (see
`AUTH_SETUP.md`) — so it's best to roll these out together, or turn on logins first.

Until you do the steps below, the app keeps its current placeholder behavior, so
nothing breaks.

---

## Step 1 — Create the bucket

In your Supabase dashboard → **Storage**:

1. Click **New bucket**.
2. Name it exactly **`assets`**.
3. Leave **Public** **OFF** (this is the private choice).
4. *(Optional)* Set a file size limit (e.g. 25 MB) and restrict types to images.
5. Create it.

*(If you name the bucket something other than `assets`, add a Vercel env var
`VITE_STORAGE_BUCKET` set to that name.)*

## Step 2 — Let each school reach only its own files

Files are stored under the id of the school that owns them —
`org-hhs/team-photo/<id>.jpg` — and these rules read that first part of the path
to decide who may touch the file. Without it, any signed-in user could list and
download every file in the bucket, including another school's.

**Run `supabase/role-enforcement.sql` first**, since these rules use the helpers
it creates.

**And move existing files first.** Anything uploaded before paths carried the
school has no school in its path, so these rules would make it unreachable. The
app shows a **Files need moving** card in Settings while any remain — use it
before running the SQL below. If you have already run the SQL and files have gone
missing, put the old policies back, move the files, then run this again.

The card lists every file with where it is now and where it is going. Two
outcomes are not failures:

- **Already in place.** If an earlier run moved the files but its record updates
  were never saved, the move reports the file as missing. The card checks the
  destination, finds it there, and relinks the record instead.
- **Nothing to move.** The card disappears once every file is filed by school.

A file reported as **not in the bucket** means the storage API would not return
it, which covers two different things: it isn't there, or you have no permission
to see it (the API won't admit a file exists if you can't read it). Run
`supabase/find-missing-files.sql` to tell them apart — it reads through the SQL
editor, which sees everything, and returns one table: the buckets, every access
rule on stored files, and every file with whether a school owns it.

- **The file is listed there.** It exists and the app can't reach it. Unfiled
  files sit under a folder that is not a school, so the access rules find no
  school to check you against and only a platform owner may touch them. Make
  sure `supabase/role-enforcement.sql` has been run and your email is in
  `platform_owners`, then move the files.
- **The file is not listed anywhere.** It really is gone. Re-upload the image in
  the asset library and the stale reference is replaced.

```sql
-- Members of a school may reach that school's files. Platform owners reach all.
create or replace function public.can_reach_storage_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Shared platform files (the browser tab icon): any signed-in user may read.
    when split_part(object_name, '/', 1) = '__platform__' then true
    when public.is_platform_owner() then true
    else exists (
      select 1
      from public.workspaces w,
           jsonb_array_elements(coalesce(w.data -> 'users', '[]'::jsonb)) u
      where w.id = split_part(object_name, '/', 1)
        and lower(u ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', ''))
        and coalesce(u ->> 'status', 'active') <> 'revoked'
    )
  end
$$;

drop policy if exists "assets read for authenticated"   on storage.objects;
drop policy if exists "assets upload for authenticated" on storage.objects;
drop policy if exists "assets delete for authenticated" on storage.objects;
drop policy if exists "assets read for members"   on storage.objects;
drop policy if exists "assets write for members"  on storage.objects;
drop policy if exists "assets update for members" on storage.objects;
drop policy if exists "assets delete for members" on storage.objects;

create policy "assets read for members" on storage.objects
  for select to authenticated
  using (bucket_id = 'assets' and public.can_reach_storage_path(name));

-- Writing the shared platform folder stays with the owner, unlike reading it.
create policy "assets write for members" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assets' and public.can_reach_storage_path(name)
              and (split_part(name, '/', 1) <> '__platform__' or public.is_platform_owner()));

create policy "assets update for members" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and public.can_reach_storage_path(name)
         and (split_part(name, '/', 1) <> '__platform__' or public.is_platform_owner()));

create policy "assets delete for members" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and public.can_reach_storage_path(name)
         and (split_part(name, '/', 1) <> '__platform__' or public.is_platform_owner()));
```

Check it with `supabase/verify-storage-access.sql`, which lists every stored file
and the school it belongs to, and flags any that no school owns.

## Step 3 — Make sure people are signed in

Since the bucket is private, a person must be **signed in** for images to display
and for uploads to work. Follow `AUTH_SETUP.md` to turn on logins. (If logins are
off, everyone is anonymous and uploaded images won't load.)

## Step 4 — Try it

1. Sign in.
2. Go to **Assets → Upload**. You'll now see a **File** picker (not the old "mock"
   note). Choose an image and upload — its thumbnail should appear on the card.
3. Go to **Settings → School logo** and upload a logo — it should show in the
   sidebar.

That's it. No redeploy is needed for uploads themselves; they use the same Supabase
project you're already connected to.

---

## Good to know

- **Where files go.** Each upload is stored under a folder named for its asset type
  (e.g. `sponsor-logo/…`, `logos/…`) with a random filename, so names never collide.
- **What's saved in the app.** The app stores only a small reference to the file, not
  the file itself — so the database stays small and fast. (The old school logo was
  stored *inside* the database as text; new uploads no longer do that.)
- **Downloads / viewing.** The Download button and thumbnails open the file through a
  temporary signed link that expires after an hour and is refreshed automatically.
- **Approval flow unchanged.** Uploaded assets still start as "pending" and go through
  the same approve/reject step as before.
- **Existing placeholder assets** stay as they are; they simply don't have a file
  attached. You can re-upload real files for them any time.

---

# The public bucket (for the fan-facing site)

The `assets` bucket above is **private**: its files are served through signed URLs
that expire, which is right for rosters, documents and anything internal. Those
URLs cannot back a public web page — a fan has no sign-in, and the link would go
dead anyway.

So the handful of images that appear publicly live in a second, **public** bucket.
Only logos go in it: the school logo, opponent logos, and sponsor logos. Athlete
photos, team photos and documents stay in the private bucket.

## Public bucket, step A — Create it

Supabase dashboard → **Storage** → **New bucket**

- Name: `public-assets`
- Public bucket: **on** (this one is deliberately public)

## Public bucket, step B — Only the app may write to it

Anyone may read; only signed-in staff may add or replace files. Without this,
**Publish logos** fails every file with *"new row violates row-level security
policy"* — the bucket exists but nothing lets anyone put a file in it.

Safe to run more than once.

```sql
drop policy if exists "public assets are readable by anyone"      on storage.objects;
drop policy if exists "signed-in staff can write public assets"   on storage.objects;
drop policy if exists "signed-in staff can replace public assets" on storage.objects;
drop policy if exists "signed-in staff can remove public assets"  on storage.objects;

create policy "public assets are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'public-assets');

create policy "signed-in staff can write public assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets');

create policy "signed-in staff can replace public assets"
  on storage.objects for update to authenticated
  using (bucket_id = 'public-assets');

create policy "signed-in staff can remove public assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets');
```

## Public bucket, step C — Copy the files across

**Settings → Public site → Publish logos**, in the app. The database names where
each logo will live but cannot move the file — storage is outside its reach — so
this copies them. Do it after adding or changing a logo.

If this reports **"Bucket not found"**, step A hasn't been done in this project.
If it reports **"new row violates row-level security policy"**, step B hasn't.

## How files are named

An opponent's or sponsor's logo lives at `<schoolId>/<assetId>` — for example
`org-hhs/as-2f9c1`. The school's own logo is not an asset record (it is a
storage path on the school itself), so it lives at the fixed `<schoolId>/school`.

Both are fixed, so `supabase/public-site.sql` can name the path when it builds a
school's public data without needing to know whether the file has been copied
across yet. An image that hasn't been copied simply doesn't appear — the site
falls back to the school's initials, and nothing breaks.
