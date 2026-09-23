-- Where are the files?
--
-- Run this when "Files need moving" reports files as not in the bucket. It is
-- READ-ONLY — it changes nothing. The SQL editor runs as the service role, so it
-- sees every object regardless of the bucket's access rules, which is exactly
-- what's needed: a file the app can't reach looks identical to one that isn't
-- there, and this tells the two apart.
--
-- Work down the four sections. The first one that surprises you is the answer.


-- ---------- 1. Which buckets exist, and how full are they ----------
-- If `assets` isn't here, the app is pointed at a bucket that doesn't exist and
-- every file is unreachable. If it's here but empty, the uploads never landed.

select b.id            as bucket,
       b.public        as is_public,
       count(o.id)     as files,
       pg_size_pretty(coalesce(sum((o.metadata ->> 'size')::bigint), 0)) as total_size
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by b.id, b.public
order by b.id;


-- ---------- 2. How files are filed, and whether a school owns them ----------
-- Every file should sit under a folder named for the school that owns it
-- (`org-hhs/…`), or `__platform__`. A folder like `opponent-logo` is a file
-- uploaded before that was true — those are what "Files need moving" moves.

select split_part(o.name, '/', 1) as top_folder,
       count(*)                   as files,
       case
         when split_part(o.name, '/', 1) = '__platform__' then 'shared'
         when exists (select 1 from public.workspaces w where w.id = split_part(o.name, '/', 1))
           then 'filed under a school'
         else 'NOT FILED — needs moving'
       end                        as status
from storage.objects o
where o.bucket_id = 'assets'
group by 1, 3
order by 3, 1;


-- ---------- 3. Every file, newest first ----------
-- The list to compare against what the app says is missing. If a file the app
-- reports as absent appears here under a different path, it was moved and the
-- app's record is stale; if it appears nowhere, it really is gone.

select o.name,
       pg_size_pretty((o.metadata ->> 'size')::bigint) as size,
       o.created_at,
       o.updated_at
from storage.objects o
where o.bucket_id = 'assets'
order by o.created_at desc nulls last
limit 200;


-- ---------- 4. Can the app reach them? ----------
-- A file the app has no permission to see reports as "not found" — the storage
-- API will not admit that a file exists if you can't read it. So if section 3
-- lists a file the app says is missing, the access rules are the reason, not the
-- file. This shows what is installed and whether you count as a platform owner.

select 'tightened policies installed' as check,
       count(*)::text                 as value
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'assets % for members'
union all
select 'can_reach_storage_path exists',
       coalesce(to_regproc('public.can_reach_storage_path')::text, 'no')
union all
select 'platform_owners table exists',
       coalesce(to_regclass('public.platform_owners')::text, 'no')
union all
-- Read through query_to_xml so this still runs when the table doesn't exist —
-- naming it directly would fail to parse, before the check could report it.
select 'platform owners listed',
       case when to_regclass('public.platform_owners') is null then 'n/a'
            else (xpath('/row/c/text()',
                    query_to_xml('select count(*) as c from public.platform_owners',
                                 false, true, '')))[1]::text
       end;

-- Unfiled files sit under a folder that is not a school, so `can_reach_storage_path`
-- finds no school to check you against — only a platform owner can touch them.
-- If the count above is 0, or your email isn't in that table, that's the blocker:
-- run supabase/role-enforcement.sql, add your email, then move the files.


-- ---------- 5. Look up one specific file ----------
-- Paste the filename from an error message (the part after the last slash) to
-- find it wherever it lives, in any bucket.
--
--   select bucket_id, name, created_at
--   from storage.objects
--   where name like '%d7def1af-9647-4a3a-aa16-152b64ed347e%';
