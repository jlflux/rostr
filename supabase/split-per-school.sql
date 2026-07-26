-- ============================================================
--  Split the single combined workspace into one row per school
--
--  Creates a row per school (row id = the school's id) plus a `__platform__`
--  row. The original `default` row is LEFT COMPLETELY UNTOUCHED so reverting the
--  site restores the previous behavior with the data intact.
--
--  Run section 1, then section 2. Only continue if section 2 reports OK.
-- ============================================================

-- ---------- 1. Build the new rows ----------
-- Safe to re-run: it replaces the derived rows and never touches 'default'.

do $$
declare
  src        jsonb;
  org        jsonb;
  org_id     text;
  doc        jsonb;
  coll       text;
  collections text[] := array[
    'users','teams','events','opponents','sponsors','agreements',
    'benefitTemplates','tierSettings','requests','assets','tasks','activity'];
begin
  select data into src from workspaces where id = 'default';
  if src is null then
    raise exception 'No "default" workspace row found — nothing to split.';
  end if;

  for org in select * from jsonb_array_elements(src -> 'orgs') loop
    org_id := org ->> 'id';

    -- Start with the fields every school document carries.
    doc := jsonb_build_object(
      'version',           coalesce(src -> 'version', '13'::jsonb),
      'showSampleResults', coalesce(src -> 'showSampleResults', 'true'::jsonb),
      'orgs',              jsonb_build_array(org));

    -- Then this school's slice of each collection, preserving record order.
    foreach coll in array collections loop
      doc := jsonb_set(doc, array[coll], coalesce((
        select jsonb_agg(e order by ord)
        from jsonb_array_elements(coalesce(src -> coll, '[]'::jsonb))
             with ordinality as t(e, ord)
        where e ->> 'orgId' = org_id
      ), '[]'::jsonb));
    end loop;

    insert into workspaces (id, data, updated_at) values (org_id, doc, now())
    on conflict (id) do update set data = excluded.data, updated_at = now();
    raise notice 'wrote row % (% bytes)', org_id, length(doc::text);
  end loop;

  -- Platform-wide settings live in their own row.
  insert into workspaces (id, data, updated_at)
  values ('__platform__',
          jsonb_build_object('version', coalesce(src -> 'version', '13'::jsonb),
                             'platform', coalesce(src -> 'platform', '{}'::jsonb)),
          now())
  on conflict (id) do update set data = excluded.data, updated_at = now();
  raise notice 'wrote row __platform__';
end $$;


-- ---------- 1b. Let everyone read the platform row ----------
-- The existing policy grants access when your email is in that row's user list.
-- The __platform__ row has no user list, so nobody could read it and the shared
-- tab icon would never load. It holds only platform branding — nothing private —
-- so any signed-in user may READ it. Writing it still requires the owner, since
-- that's governed by the existing policy.

drop policy if exists "platform row readable" on workspaces;
create policy "platform row readable" on workspaces
  for select to authenticated
  using (id = '__platform__');


-- ---------- 2. Verify BEFORE using the new rows ----------
-- Every collection must have the same number of records after the split, and
-- every record must appear exactly once. Anything other than all-OK means stop.

with src as (select data from workspaces where id = 'default'),
colls(name) as (
  values ('users'),('teams'),('events'),('opponents'),('sponsors'),('agreements'),
         ('benefitTemplates'),('tierSettings'),('requests'),('assets'),('tasks'),('activity')
),
before as (
  select c.name,
         jsonb_array_length(coalesce((select data -> c.name from src), '[]'::jsonb)) as n
  from colls c
),
after as (
  select c.name,
         coalesce(sum(jsonb_array_length(coalesce(w.data -> c.name, '[]'::jsonb))), 0) as n
  from colls c
  left join workspaces w
    on w.id <> 'default' and w.id <> '__platform__'
  group by c.name
)
select b.name                                as collection,
       b.n                                   as before_split,
       a.n                                   as after_split,
       case when b.n = a.n then 'OK' else '*** MISMATCH ***' end as status
from before b join after a using (name)
order by case when b.n = a.n then 1 else 0 end, b.name;

-- Schools: the count of per-school rows must equal the number of schools.
select (select jsonb_array_length(data -> 'orgs') from workspaces where id = 'default') as schools_before,
       (select count(*) from workspaces where id not in ('default', '__platform__'))    as rows_after,
       case when (select jsonb_array_length(data -> 'orgs') from workspaces where id = 'default')
               = (select count(*) from workspaces where id not in ('default','__platform__'))
            then 'OK' else '*** MISMATCH ***' end as status;

-- No record may have been dropped or reassigned: every id must appear once.
with src as (select data from workspaces where id = 'default'),
colls(name) as (
  values ('users'),('teams'),('events'),('opponents'),('sponsors'),('agreements'),
         ('benefitTemplates'),('tierSettings'),('requests'),('assets'),('tasks'),('activity')
),
before_ids as (
  select c.name, e ->> 'id' as id
  from colls c, src,
       jsonb_array_elements(coalesce(src.data -> c.name, '[]'::jsonb)) e
),
after_ids as (
  select c.name, e ->> 'id' as id
  from colls c
  join workspaces w on w.id not in ('default', '__platform__'),
       jsonb_array_elements(coalesce(w.data -> c.name, '[]'::jsonb)) e
)
select coalesce(b.name, a.name) as collection,
       count(*) filter (where a.id is null) as missing_after,
       count(*) filter (where b.id is null) as unexpected_after,
       case when count(*) filter (where a.id is null) = 0
             and count(*) filter (where b.id is null) = 0
            then 'OK' else '*** MISMATCH ***' end as status
from before_ids b full outer join after_ids a on b.name = a.name and b.id = a.id
group by 1
order by 4, 1;


-- ---------- 3. Rolling back ----------
-- The 'default' row was never modified. To roll back, redeploy the previous
-- site build; it reads 'default' and everything is as it was. The derived rows
-- can then be removed with:
--   delete from workspaces where id not in ('default');
