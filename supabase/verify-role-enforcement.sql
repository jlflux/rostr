-- ============================================================
--  Check that role enforcement is installed — safe on a live project
--
--  READ ONLY. Creates nothing, changes nothing, drops nothing. Run this in the
--  Supabase SQL editor after `supabase/role-enforcement.sql`.
--
--  (The other file, rls-policy-test.sql, is a local harness that drops tables.
--  It refuses to run here, and you should never need it.)
-- ============================================================


-- ---------- 1. Are the pieces there? ----------
-- Every line should say "installed".

select 'platform_owners table' as piece,
       case when to_regclass('public.platform_owners') is not null
            then 'installed' else '*** MISSING ***' end as status
union all
select 'is_platform_owner()',
       case when to_regproc('public.is_platform_owner') is not null
            then 'installed' else '*** MISSING ***' end
union all
select 'role_in_workspace()',
       case when to_regproc('public.role_in_workspace') is not null
            then 'installed' else '*** MISSING ***' end
union all
select 'role check on updates',
       case when exists (
         select 1 from pg_trigger
         where tgrelid = 'public.workspaces'::regclass
           and tgname = 'workspaces_enforce_roles' and not tgisinternal
           and (tgtype::int & 16) > 0)          -- UPDATE
       then 'installed' else '*** MISSING ***' end
union all
select 'role check on deletes',
       case when exists (
         select 1 from pg_trigger
         where tgrelid = 'public.workspaces'::regclass
           and tgname = 'workspaces_enforce_roles' and not tgisinternal
           and (tgtype::int & 8) > 0)           -- DELETE
       then 'installed' else '*** MISSING ***' end
union all
select 'membership policy',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'workspaces'
           and policyname = 'workspace member access')
       then 'installed' else '*** MISSING ***' end
order by 1;


-- ---------- 2. Is the old hard-coded email gone? ----------
-- Should return no rows. Anything here still has an address written into it.

select policyname, 'still contains a hard-coded email' as problem
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') like '%@%' or coalesce(with_check, '') like '%@%');


-- ---------- 3. Who are the platform owners? ----------
-- These accounts can reach every school. There should be no surprises here.

select email, added_at from public.platform_owners order by email;


-- ---------- 4. What would each person actually be allowed to do? ----------
-- Read straight down: this is what the database grants, regardless of what the
-- app shows. Anyone marked "revoked" should read as no access.

select w.id                                        as school,
       u ->> 'name'                                as person,
       u ->> 'email'                               as email,
       coalesce(u ->> 'role', 'read_only')         as role,
       case
         when coalesce(u ->> 'status', 'active') = 'revoked' then 'no access'
         when exists (select 1 from public.platform_owners po
                      where lower(po.email) = lower(u ->> 'email'))
              then 'everything, every school'
         when coalesce(u ->> 'role', 'read_only') = 'read_only' then 'read only'
         when coalesce(u ->> 'role', 'read_only') = 'school_admin'
              then 'edit records + manage access + delete the school'
         when coalesce(u ->> 'role', 'read_only') = 'platform_owner'
              then 'edit records + manage access'
         else 'edit records'
       end                                          as allowed
from public.workspaces w,
     jsonb_array_elements(coalesce(w.data -> 'users', '[]'::jsonb)) u
where w.data -> 'orgs' -> 0 is not null
order by w.id, allowed, person;


-- ---------- 5. All other policies on the table ----------
-- Anything permissive and unexpected here widens access.

select policyname,
       case when permissive = 'PERMISSIVE' then 'permissive' else 'RESTRICTIVE' end as kind,
       cmd as applies_to
from pg_policies
where schemaname = 'public' and tablename = 'workspaces'
order by permissive, policyname;
