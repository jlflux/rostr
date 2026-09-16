-- ============================================================
--  Check who can reach which files — safe on a live project
--
--  READ ONLY. Run after tightening the bucket policies in STORAGE_SETUP.md.
-- ============================================================

-- ---------- 1. Are the scoped policies in place? ----------
-- The old open ones must be gone; four scoped ones should remain.

select policyname, cmd as applies_to,
       case when qual like '%can_reach_storage_path%'
              or with_check like '%can_reach_storage_path%'
            then 'scoped to school' else '*** OPEN ***' end as scope
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'assets%'
order by policyname;


-- ---------- 2. Every file, and the school it belongs to ----------
-- `owner` is the first part of the path. Anything showing "no school" is
-- unreachable under the new rules and needs moving.

with files as (
  select split_part(name, '/', 1)                     as owner,
         coalesce((metadata ->> 'size')::bigint, 0)   as bytes
  from storage.objects
  where bucket_id = 'assets'
)
select owner,
       count(*)                     as files,
       pg_size_pretty(sum(bytes))   as size,
       case
         when owner = '__platform__' then 'shared, readable by all'
         when exists (select 1 from public.workspaces w where w.id = owner)
              then 'that school''s members only'
         else '*** no school owns this — move it ***'
       end                          as reachable_by
from files
group by owner
order by owner;


-- ---------- 3. Files no school owns ----------
-- Should be empty. Each row is a file the app can no longer read.

select name, created_at
from storage.objects
where bucket_id = 'assets'
  and split_part(name, '/', 1) <> '__platform__'
  and not exists (select 1 from public.workspaces w where w.id = split_part(name, '/', 1))
order by name;


-- ---------- 4. The public bucket, for contrast ----------
-- This one is meant to be world-readable: it holds only the logos the fan site
-- shows. Anything here that isn't a logo does not belong.

select split_part(name, '/', 1) as owner, count(*) as files
from storage.objects
where bucket_id = 'public-assets'
group by 1
order by 1;
