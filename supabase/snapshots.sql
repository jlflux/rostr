-- ============================================================
--  Hourly snapshots of the workspace document
--  Complements Supabase Pro's daily physical backups with fine-grained,
--  self-service restore points. The whole dataset is ~250 KB, so a year of
--  hourly snapshots (deduped, 30-day retention) costs a few MB.
-- ============================================================

create table if not exists workspace_snapshots (
  id           bigserial primary key,
  workspace_id text        not null,
  data         jsonb       not null,
  taken_at     timestamptz not null default now()
);

create index if not exists workspace_snapshots_lookup
  on workspace_snapshots (workspace_id, taken_at desc);

-- Locked down: nobody using the app can read or write snapshots. Only the
-- service role (dashboard / SQL editor) can, which is what you restore from.
alter table workspace_snapshots enable row level security;

-- Take a snapshot of every workspace, but skip any whose content is unchanged
-- since its last snapshot — so idle hours cost nothing.
create or replace function take_workspace_snapshots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  insert into workspace_snapshots (workspace_id, data)
  select w.id, w.data
  from workspaces w
  where not exists (
    select 1
    from workspace_snapshots s
    where s.workspace_id = w.id
      and s.data = w.data
      and s.taken_at = (
        select max(s2.taken_at) from workspace_snapshots s2 where s2.workspace_id = w.id
      )
  );
  get diagnostics inserted = row_count;

  -- Retention: keep everything from the last 30 days, plus the first snapshot
  -- of each day beyond that for 12 months.
  delete from workspace_snapshots s
  where s.taken_at < now() - interval '30 days'
    and s.id not in (
      select distinct on (workspace_id, date_trunc('day', taken_at)) id
      from workspace_snapshots
      order by workspace_id, date_trunc('day', taken_at), taken_at
    );
  delete from workspace_snapshots
  where taken_at < now() - interval '12 months';

  return inserted;
end $$;

-- ============================================================
--  Schedule it (run once, after the above)
--  Requires the pg_cron extension: Database → Extensions → enable "pg_cron".
-- ============================================================
-- select cron.schedule('workspace-snapshots', '0 * * * *',
--                      $$select take_workspace_snapshots()$$);

-- ============================================================
--  RESTORE — how to undo a bad save
-- ============================================================
-- 1. See what you can restore to:
--      select id, taken_at, pg_size_pretty(length(data::text)::bigint) as size
--      from workspace_snapshots
--      where workspace_id = 'default'
--      order by taken_at desc limit 20;
--
-- 2. Restore the most recent snapshot (or swap the subquery for a specific id):
--      update workspaces w
--      set data = s.data
--      from (select data from workspace_snapshots
--            where workspace_id = 'default'
--            order by taken_at desc limit 1) s
--      where w.id = 'default';
--
-- 3. Everyone must reload the app to pick up the restored data.
