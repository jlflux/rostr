-- Where are the files?
--
-- Run this when "Files need moving" reports files it couldn't reach. It is
-- READ-ONLY — it changes nothing. The SQL editor runs as the service role, so it
-- sees every file regardless of the bucket's access rules: a file the app can't
-- read looks identical to one that isn't there, and this tells the two apart.
--
-- It is ONE query on purpose. The Supabase editor only shows the last result, so
-- anything split across several queries would never be seen.
--
-- Read it top to bottom:
--   bucket   which buckets exist and how many files each holds
--   policy   every access rule on stored files — if nothing grants "select",
--            nobody signed in can read anything, which also looks like "missing"
--   file     every file in the assets bucket, and whether a school owns it

select 'bucket'::text as kind,
       b.id           as item,
       (select count(*) from storage.objects o where o.bucket_id = b.id)::text || ' files'
         || case when b.public then ', public' else ', private' end as detail
from storage.buckets b

union all

select 'policy',
       p.policyname,
       p.cmd || ' for ' || array_to_string(p.roles, ',')
from pg_policies p
where p.schemaname = 'storage' and p.tablename = 'objects'

union all

select 'file',
       o.name,
       case
         when split_part(o.name, '/', 1) = '__platform__' then 'shared'
         when exists (select 1 from public.workspaces w where w.id = split_part(o.name, '/', 1))
           then 'filed under a school'
         else 'NOT FILED — needs moving'
       end
from storage.objects o
where o.bucket_id = 'assets'

order by 1, 2;
