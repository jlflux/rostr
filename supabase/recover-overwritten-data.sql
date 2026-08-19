-- ============================================================
--  A device pushed stale data over the live rows — get it back
--
--  Symptom: you return after some time away and the app shows an older state;
--  work done since then is gone.
--
--  Cause: if the app's startup load failed or came back empty (an expired
--  sign-in does both), it still armed auto-save, and that device then uploaded
--  whatever it had cached — overwriting the good rows.
--
--  Sections 1-3 are READ ONLY. Section 4 restores and is clearly marked.
--  Do not open the app on the device that showed old data until you've restored;
--  it can push again.
-- ============================================================


-- ---------- 1. The last two weeks, hour by hour ----------
-- One line per snapshot per row. Read down the counts: the point where they drop
-- sharply is the overwrite. The snapshot on the line ABOVE the drop is the one
-- to restore.

select s.id                                                                   as snapshot_id,
       s.workspace_id,
       s.taken_at,
       jsonb_array_length(coalesce(s.data -> 'events',   '[]'::jsonb))        as events,
       jsonb_array_length(coalesce(s.data -> 'teams',    '[]'::jsonb))        as teams,
       jsonb_array_length(coalesce(s.data -> 'sponsors', '[]'::jsonb))        as sponsors,
       jsonb_array_length(coalesce(s.data -> 'assets',   '[]'::jsonb))        as assets,
       jsonb_array_length(coalesce(s.data -> 'opponents','[]'::jsonb))        as opponents,
       pg_size_pretty(length(s.data::text)::bigint)                           as size
from workspace_snapshots s
where s.taken_at > now() - interval '14 days'
order by s.workspace_id, s.taken_at;


-- ---------- 2. What's live right now, for comparison ----------

select w.id,
       w.updated_at,
       jsonb_array_length(coalesce(w.data -> 'events',   '[]'::jsonb)) as events,
       jsonb_array_length(coalesce(w.data -> 'teams',    '[]'::jsonb)) as teams,
       jsonb_array_length(coalesce(w.data -> 'sponsors', '[]'::jsonb)) as sponsors,
       jsonb_array_length(coalesce(w.data -> 'assets',   '[]'::jsonb)) as assets,
       pg_size_pretty(length(w.data::text)::bigint)                    as size
from workspaces w
order by w.id;


-- ---------- 3. The best snapshot per row ----------
-- The fullest snapshot on record for each row. If these numbers beat section 2,
-- the work still exists and section 4 will bring it back.

select distinct on (workspace_id)
       workspace_id,
       id          as snapshot_id,
       taken_at,
       jsonb_array_length(coalesce(data -> 'events', '[]'::jsonb))
         + jsonb_array_length(coalesce(data -> 'teams',    '[]'::jsonb))
         + jsonb_array_length(coalesce(data -> 'sponsors', '[]'::jsonb))
         + jsonb_array_length(coalesce(data -> 'assets',   '[]'::jsonb)) as total_records,
       pg_size_pretty(length(data::text)::bigint)                        as size
from workspace_snapshots
order by workspace_id,
         jsonb_array_length(coalesce(data -> 'events', '[]'::jsonb))
           + jsonb_array_length(coalesce(data -> 'teams',    '[]'::jsonb))
           + jsonb_array_length(coalesce(data -> 'sponsors', '[]'::jsonb))
           + jsonb_array_length(coalesce(data -> 'assets',   '[]'::jsonb)) desc,
         taken_at desc;


-- ============================================================
--  4. RESTORE — only after reading the results above
-- ============================================================
-- Take the snapshot_id from section 1 (the line just before the drop) or from
-- section 3, and run this once per row you need back.
--
-- Preserve the current state first, so restoring is itself reversible:
--     select take_workspace_snapshots();
--
-- Then:
--     update workspaces w
--     set data = s.data, updated_at = now()
--     from (select data from workspace_snapshots where id = <SNAPSHOT_ID>) s
--     where w.id = '<ROW_ID>';
--
-- Confirm by re-running section 2, then hard-reload the app on every device
-- (Ctrl+Shift+R on desktop; fully close and reopen the phone app).
