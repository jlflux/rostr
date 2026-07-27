-- ============================================================
--  "My changes aren't here" — find out where the data went
--
--  READ ONLY. Nothing in this file modifies any data. Run the whole thing and
--  read the four results in order.
-- ============================================================


-- ---------- A. What each row holds right now ----------
-- `default` is the pre-split row, frozen at migration time. The per-school rows
-- are what the app reads today. If work is missing from a per-school row but
-- present in `default`, the edits were made by a client still on the old build.

select w.id,
       w.updated_at,
       jsonb_array_length(coalesce(w.data -> 'sponsors', '[]'::jsonb)) as sponsors,
       jsonb_array_length(coalesce(w.data -> 'teams',    '[]'::jsonb)) as teams,
       jsonb_array_length(coalesce(w.data -> 'events',   '[]'::jsonb)) as events,
       jsonb_array_length(coalesce(w.data -> 'users',    '[]'::jsonb)) as users,
       pg_size_pretty(length(w.data::text)::bigint)                    as size
from workspaces w
order by (w.id = 'default'), w.id;


-- ---------- B. The weekend, hour by hour ----------
-- One line per snapshot that differed from the one before it. Watch the
-- sponsors/teams columns: if they climb over the weekend and then drop, a save
-- overwrote the work and we restore from the snapshot just before the drop. If
-- they never climb at all, the edits never reached the database.

select s.workspace_id,
       s.taken_at,
       jsonb_array_length(coalesce(s.data -> 'sponsors', '[]'::jsonb)) as sponsors,
       jsonb_array_length(coalesce(s.data -> 'teams',    '[]'::jsonb)) as teams,
       jsonb_array_length(coalesce(s.data -> 'events',   '[]'::jsonb)) as events,
       pg_size_pretty(length(s.data::text)::bigint)                    as size
from workspace_snapshots s
where s.taken_at > now() - interval '5 days'
order by s.workspace_id, s.taken_at;


-- ---------- C. Is the missing work sitting in a snapshot? ----------
-- The high-water mark for each row: the snapshot that held the most sponsors,
-- and the one that held the most teams. If either is higher than what section A
-- shows for that row, the data still exists and is restorable.

select workspace_id,
       max(jsonb_array_length(coalesce(data -> 'sponsors', '[]'::jsonb))) as most_sponsors_ever,
       max(jsonb_array_length(coalesce(data -> 'teams',    '[]'::jsonb))) as most_teams_ever,
       max(jsonb_array_length(coalesce(data -> 'events',   '[]'::jsonb))) as most_events_ever,
       count(*)                                                          as snapshots_kept
from workspace_snapshots
group by workspace_id
order by workspace_id;


-- ---------- D. Is the snapshot job actually running? ----------
-- If the newest snapshot is many hours old, the hourly job stopped and section
-- B/C can't be trusted to be complete.

select workspace_id,
       max(taken_at)                          as newest_snapshot,
       now() - max(taken_at)                  as age
from workspace_snapshots
group by workspace_id
order by workspace_id;


-- ============================================================
--  DO NOT RUN ANYTHING BELOW until we've read the results above.
--  Restoring the wrong snapshot loses whatever is in the row now.
-- ============================================================
--
-- Restore one row from a specific snapshot (get the id from section B):
--   update workspaces w
--   set data = s.data, updated_at = now()
--   from (select data from workspace_snapshots where id = <SNAPSHOT_ID>) s
--   where w.id = '<ROW_ID>';
--
-- Everyone must reload the app afterwards to pick up the restored data.
