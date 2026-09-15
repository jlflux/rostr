/**
 * Writes `supabase/riverbend-demo.sql` from the seed, so the demo school can be
 * loaded into a real Supabase project and screenshotted like any other school.
 *
 * Run with: node scripts/gen-riverbend-sql.mjs
 */
import { build } from 'esbuild'
import { writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const root = process.cwd()
const dir = mkdtempSync(join(tmpdir(), 'rbsql-'))
const entry = join(dir, 'entry.ts')

writeFileSync(entry, `
import { buildSeedState } from ${JSON.stringify(join(root, 'src/data/seed'))}
const s: any = buildSeedState()
const ORG = 'org-demo'
const doc: any = {
  version: s.version,
  showSampleResults: true,
  orgs: s.orgs.filter((o: any) => o.id === ORG),
}
for (const k of ['users','teams','events','opponents','sponsors','agreements',
                 'benefitTemplates','tierSettings','requests','assets','tasks','activity'])
  doc[k] = (s[k] ?? []).filter((r: any) => r.orgId === ORG)
export const out = doc
`)

const bundled = join(dir, 'out.mjs')
await build({ entryPoints: [entry], bundle: true, outfile: bundled, format: 'esm', platform: 'node' })
const { out: doc } = await import(bundled)

const json = JSON.stringify(doc)
const counts = Object.entries(doc)
  .filter(([, v]) => Array.isArray(v))
  .map(([k, v]) => `--   ${k.padEnd(18)} ${String(v.length).padStart(5)}`)
  .join('\n')

// Single quotes doubled for a SQL string literal.
const literal = json.replace(/'/g, "''")

const sql = `-- ============================================================
--  Riverbend Academy — the demo school
--
--  Invented data for demonstrations and screenshots, so the platform can be
--  shown without exposing a real school's information. Generated from the app's
--  seed by scripts/gen-riverbend-sql.mjs — edit src/data/riverbend.ts and
--  regenerate rather than editing this file by hand.
--
--  Contents:
${counts}
--
--  Safe to re-run: it replaces the org-demo row and touches nothing else.
-- ============================================================

do $$
begin
  if to_regclass('public.workspaces') is null then
    raise exception
      'public.workspaces was not found in database "%" — this looks like the wrong Supabase project.',
      current_database();
  end if;
end $$;

insert into public.workspaces (id, data, updated_at)
values ('org-demo', '${literal}'::jsonb, now())
on conflict (id) do update set data = excluded.data, updated_at = now();

-- What landed.
select id,
       jsonb_array_length(data -> 'teams')     as teams,
       jsonb_array_length(data -> 'events')    as events,
       jsonb_array_length(data -> 'sponsors')  as sponsors,
       jsonb_array_length(data -> 'opponents') as opponents,
       pg_size_pretty(length(data::text)::bigint) as size
from public.workspaces where id = 'org-demo';

-- Put yourself in the demo school's user list so you can switch into it.
update public.workspaces
set data = jsonb_set(data, '{users}',
      (data -> 'users') || jsonb_build_array(jsonb_build_object(
        'id', 'rb-u-owner', 'orgId', 'org-demo', 'name', 'Platform Owner',
        'email', 'jl@fluxmedia.org', 'role', 'platform_owner', 'title', 'Platform Owner',
        'initials', 'JL', 'color', '#ea1a45', 'status', 'active', 'canSwitchOrgs', true)))
where id = 'org-demo'
  and not (data -> 'users' @> '[{"email": "jl@fluxmedia.org"}]'::jsonb);

-- To show the public fan site for Riverbend as well:
--   update public.public_site set published = true where org_id = 'org-demo';
`

writeFileSync(join(root, 'supabase/riverbend-demo.sql'), sql)
console.log(`wrote supabase/riverbend-demo.sql (${(sql.length / 1024).toFixed(0)} KB)`)
