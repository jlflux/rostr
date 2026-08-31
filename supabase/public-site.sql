-- ============================================================
--  Phase A — the public site's data foundation
--
--  Fans are anonymous: they have no sign-in, so they cannot read `workspaces`,
--  and they must never be able to. Opening that table would expose staffing,
--  sponsorship terms, and athlete contact and medical records.
--
--  Instead this builds a SEPARATE table holding only the fields a fan page
--  needs, rebuilt automatically whenever a school's data changes. Anonymous
--  read is granted on that table and nowhere else.
--
--  The projection is an ALLOW-LIST: it names the fields that go out. A field
--  added to the app next season is excluded until someone deliberately adds it
--  here. A deny-list would be one forgotten field away from a leak.
--
--  Run this once. Section 5 verifies it.
-- ============================================================


-- ---------- 1. The table ----------

create table if not exists public_site (
  org_id      text primary key,
  slug        text not null unique,
  published   boolean not null default false,
  data        jsonb  not null,
  updated_at  timestamptz not null default now()
);

create index if not exists public_site_slug on public_site (slug) where published;

alter table public_site enable row level security;

-- Anyone, signed in or not, may read a PUBLISHED school. Nothing may be written
-- from outside: the trigger below is the only writer, and it runs as the table
-- owner.
drop policy if exists "published schools are public" on public_site;
create policy "published schools are public" on public_site
  for select to anon, authenticated
  using (published);


-- ---------- 2. URL slug ----------
-- "Homewood High School Athletics" -> "homewood". Used for hhs.fluxathletics.com
-- and later a custom domain.

create or replace function public_site_slug(org jsonb, org_id text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(regexp_replace(lower(coalesce(org ->> 'shortName', org ->> 'name', '')),
                          '[^a-z0-9]+', '-', 'g'), ''),
    org_id)
$$;


-- ---------- 3. The projection ----------
-- Everything a fan page shows, and nothing else.
--
-- Deliberately excluded, though they sit on the same records:
--   events    - staffSlots, runOfShow, broadcastChecklist, checkoutTime, notes
--   moments   - ownerId and notes (only the title and timing go out)
--   athletes  - phone, email, medicalNotes, guardians
--   entirely  - users, requests, tasks, activity, agreements, tier settings,
--               benefit templates, and any sponsor not actually appearing on a
--               game (a pipeline prospect must not become public knowledge)

create or replace function build_public_site(src jsonb)
returns jsonb
language sql
stable
as $$
with
org as (select src -> 'orgs' -> 0 as o),

-- Only games that are visible in the app: not trashed.
ev as (
  select e
  from jsonb_array_elements(coalesce(src -> 'events', '[]'::jsonb)) e
  where e ->> 'deletedAt' is null
),

-- Sponsors named by an activation on a real game. Nothing else about them.
named_sponsors as (
  select distinct a ->> 'sponsorId' as sponsor_id
  from ev, jsonb_array_elements(coalesce(e -> 'sponsorActivations', '[]'::jsonb)) a
  where a ->> 'sponsorId' is not null
),

-- A logo's public path is derived from its asset id, so the projection can name
-- it before the file has been copied into the public bucket.
logo as (
  select a ->> 'id' as asset_id,
         (src -> 'orgs' -> 0 ->> 'id') || '/' || (a ->> 'id') as path
  from jsonb_array_elements(coalesce(src -> 'assets', '[]'::jsonb)) a
)

select jsonb_build_object(
  'school', (
    select jsonb_build_object(
      'id',        o ->> 'id',
      'name',      o ->> 'name',
      'shortName', o ->> 'shortName',
      'mascot',    o ->> 'mascot',
      'city',      o ->> 'city',
      'state',     o ->> 'state',
      'initials',  o ->> 'initials',
      'theme',     o -> 'theme',
      'logo',      (select path from logo where asset_id = o ->> 'logoAssetId'))
    from org),

  'teams', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',          t ->> 'id',
      'name',        t ->> 'name',
      'sport',       t ->> 'sport',
      'level',       t ->> 'level',
      'gender',      t ->> 'gender',
      'season',      t ->> 'season',
      'seasonLabel', t ->> 'seasonLabel',
      'postseasonFinish', t ->> 'postseasonFinish',
      -- Roster: playing details only. An athlete flagged hidePublic is omitted.
      'roster', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',       r ->> 'id',
          'number',   r ->> 'number',
          'name',     r ->> 'name',
          'grade',    r ->> 'grade',
          'position', r ->> 'position'))
        from jsonb_array_elements(coalesce(t -> 'roster', '[]'::jsonb)) r
        where coalesce((r ->> 'hidePublic')::boolean, false) = false
      ), '[]'::jsonb)))
    from jsonb_array_elements(coalesce(src -> 'teams', '[]'::jsonb)) t
  ), '[]'::jsonb),

  'events', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',              e ->> 'id',
      'teamId',          e ->> 'teamId',
      'sport',           e ->> 'sport',
      'level',           e ->> 'level',
      'date',            e ->> 'date',
      'time',            e ->> 'time',
      'homeAway',        e ->> 'homeAway',
      'eventKind',       e ->> 'eventKind',
      'opponent',        e ->> 'opponent',
      'opponentId',      e ->> 'opponentId',
      'opponentIds',     e -> 'opponentIds',
      'gameType',        e ->> 'gameType',
      'venue',           e ->> 'venue',
      'status',          e ->> 'status',
      'designation',     e ->> 'designation',
      'ticketLink',      e ->> 'ticketLink',
      'broadcastLink',   e ->> 'broadcastLink',
      'broadcastStatus', e ->> 'broadcastStatus',
      'multiDay',        e ->> 'multiDay',
      'score',           case when e -> 'score' is null then null
                              else jsonb_build_object(
                                'us',     e -> 'score' -> 'us',
                                'them',   e -> 'score' -> 'them',
                                'result', e -> 'score' ->> 'result',
                                'recap',  e -> 'score' ->> 'recap',
                                'sample', coalesce((e -> 'score' ->> 'sample')::boolean, false))
                         end,
      -- "Senior night", "honoring the state championship track team".
      -- Title and timing only: who owns it and how it's run stay internal.
      'moments', coalesce((
        select jsonb_agg(jsonb_build_object('title', m ->> 'title', 'timing', m ->> 'timing'))
        from jsonb_array_elements(coalesce(e -> 'gameMoments', '[]'::jsonb)) m
      ), '[]'::jsonb),
      -- "Presented by X" — the sponsor and the billing, not the arrangement.
      'sponsors', coalesce((
        select jsonb_agg(jsonb_build_object(
          'sponsorId', a ->> 'sponsorId',
          'activation', a ->> 'activation'))
        from jsonb_array_elements(coalesce(e -> 'sponsorActivations', '[]'::jsonb)) a
      ), '[]'::jsonb)))
    from ev
  ), '[]'::jsonb),

  'opponents', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',     o2 ->> 'id',
      'name',   o2 ->> 'name',
      'mascot', o2 ->> 'mascot',
      'tint',   o2 ->> 'tint',
      'logo',   (select path from logo where asset_id = o2 ->> 'logoAssetId')))
    from jsonb_array_elements(coalesce(src -> 'opponents', '[]'::jsonb)) o2
    where o2 ->> 'deletedAt' is null
  ), '[]'::jsonb),

  'sponsors', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',      s ->> 'id',
      'name',    s ->> 'name',
      'website', s ->> 'website',
      'logo',    (select path from logo a2
                  where a2.asset_id = (
                    select a3 ->> 'id'
                    from jsonb_array_elements(coalesce(src -> 'assets', '[]'::jsonb)) a3
                    where a3 ->> 'sponsorId' = s ->> 'id'
                      and a3 ->> 'type' = 'Sponsor Logo'
                    limit 1))))
    from jsonb_array_elements(coalesce(src -> 'sponsors', '[]'::jsonb)) s
    where s ->> 'id' in (select sponsor_id from named_sponsors)
  ), '[]'::jsonb)
)
$$;


-- ---------- 4. Keep it current ----------
-- Rebuilds a school's public row on every change, so the site is never stale and
-- the app doesn't have to remember to publish. Publishing stays off until it is
-- switched on per school.

create or replace function refresh_public_site()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org jsonb;
begin
  -- Only per-school rows have an org; skip __platform__ and anything else.
  org := new.data -> 'orgs' -> 0;
  if org is null or org ->> 'id' is distinct from new.id then
    return new;
  end if;

  insert into public_site (org_id, slug, data, updated_at)
  values (new.id, public_site_slug(org, new.id), build_public_site(new.data), now())
  on conflict (org_id) do update
    set slug = excluded.slug,
        data = excluded.data,
        updated_at = now();
  return new;
end $$;

drop trigger if exists workspaces_refresh_public_site on workspaces;
create trigger workspaces_refresh_public_site
  after insert or update on workspaces
  for each row
  execute function refresh_public_site();

-- Remove a school's public row when the school is deleted.
create or replace function drop_public_site()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public_site where org_id = old.id;
  return old;
end $$;

drop trigger if exists workspaces_drop_public_site on workspaces;
create trigger workspaces_drop_public_site
  after delete on workspaces
  for each row
  execute function drop_public_site();

-- Build rows for the schools that already exist.
update workspaces set updated_at = updated_at where data -> 'orgs' -> 0 is not null;


-- ---------- 5. Verify ----------

-- One row per school, with its slug. `published` is false until switched on.
select org_id, slug, published, updated_at,
       jsonb_array_length(data -> 'events') as events,
       jsonb_array_length(data -> 'teams')  as teams,
       pg_size_pretty(length(data::text)::bigint) as size
from public_site
order by org_id;

-- Nothing private may appear anywhere in the projection. Every count must be 0.
select org_id,
       (data::text ilike '%medicalNotes%')::int  as medical_notes,
       (data::text ilike '%guardians%')::int     as guardians,
       (data::text ilike '%staffSlots%')::int    as staff_slots,
       (data::text ilike '%runOfShow%')::int     as run_of_show,
       (data::text ilike '%"email"%')::int       as emails,
       (data::text ilike '%checkoutTime%')::int  as checkout_time
from public_site
order by org_id;


-- ---------- 6. Publishing a school ----------
-- Nothing is visible to the public until this is run for that school:
--
--   update public_site set published = true where org_id = 'org-hhs';
--
-- and to take it down again:
--
--   update public_site set published = false where org_id = 'org-hhs';
