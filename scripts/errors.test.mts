/// <reference types="node" />
// Run with: npm run test:errors
// Triggers every database error the app cares about on a real Postgres (the migration, compiled to WASM) and checks that
// the Supabase layer's mapError turns each into the right DataError code. PostgREST passes the same code, message and
// details through, so this is the genuine error text, not a guess.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { mapError } from '../src/data/supabase';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const sql = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

const db = new PGlite({ extensions: { btree_gist } });
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
await db.exec(sql);
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;`);
const U = '11111111-1111-1111-1111-111111111111';
await db.exec(`insert into auth.users (id, email) values ('${U}', 'a@x.test')`);
await db.exec(`reset role; select set_config('request.jwt.claim.sub','${U}',false); set role authenticated;`);

let pass = 0, fail = 0;
async function expectCode(name: string, statement: string, want: string, ctx?: { deleting?: boolean }) {
  try {
    await db.exec(statement);
    console.log('FAIL ' + name + ' (statement did not fail)');
    fail++;
  } catch (e) {
    const err = e as { code?: string; message?: string; detail?: string };
    const got = mapError({ code: err.code, message: err.message, details: err.detail }, ctx).code;
    const ok = got === want;
    ok ? pass++ : fail++;
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ` got ${got} want ${want} (${err.code}: ${err.message})`));
  }
}

const [prop] = (await db.query<{ id: string }>(`insert into properties (name) values ('P') returning id`)).rows;
const [unit] = (await db.query<{ id: string }>(`insert into units (property_id, name) values ('${prop.id}','4C') returning id`)).rows;
const [ten] = (await db.query<{ id: string }>(`insert into tenants (unit_id, name, monthly_rent, move_in_on) values ('${unit.id}','T',100,'2025-01-01') returning id`)).rows;
await db.exec(`select * from create_bills('${prop.id}','2026-01-01','2026-01-31')`);
const [bill] = (await db.query<{ id: string }>(`select id from bills limit 1`)).rows;
await db.exec(`insert into payments (bill_id, amount, paid_on, method, client_request_id) values ('${bill.id}', 40, '2026-01-02', 'cash', gen_random_uuid())`);

await expectCode('duplicate unit name', `insert into units (property_id, name) values ('${prop.id}','4C')`, 'duplicate_unit');
await expectCode('second current tenant', `insert into tenants (unit_id, name, monthly_rent) values ('${unit.id}','X',1)`, 'unit_occupied');
await expectCode('over-payment', `insert into payments (bill_id, amount, paid_on, method) values ('${bill.id}', 61, '2026-01-03', 'cash')`, 'over_payment');
await expectCode('bill edited below what was paid', `update bills set base_rent = 10 where id = '${bill.id}'`, 'below_paid');
await expectCode('tenant move-out before move-in', `update tenants set moved_out_on = '2024-01-01' where id = '${ten.id}'`, 'bad_dates');
await expectCode('bill period end before start', `insert into bills (tenant_id, unit_id, period_start, period_end, base_rent) values ('${ten.id}','${unit.id}','2026-05-10','2026-05-01',1)`, 'bad_dates');
await expectCode('overlapping bill (exclusion constraint)', `insert into bills (tenant_id, unit_id, period_start, period_end, base_rent) values ('${ten.id}','${unit.id}','2026-01-10','2026-02-10',1)`, 'bad_dates');
await expectCode('create_bills with end before start', `select * from create_bills('${prop.id}','2026-02-10','2026-02-01')`, 'bad_dates');
await expectCode('blank property name', `insert into properties (name) values (' ')`, 'invalid');
await expectCode('fractional amount for a bigint column (PostgREST passes JSON numbers as text)', `insert into payments (bill_id, amount, paid_on, method) values ('${bill.id}', '10.5', '2026-01-03', 'cash')`, 'invalid');
await expectCode('impossible date', `insert into payments (bill_id, amount, paid_on, method) values ('${bill.id}', 1, '2026-02-30', 'cash')`, 'invalid');
await expectCode('unknown payment method', `insert into payments (bill_id, amount, paid_on, method) values ('${bill.id}', 1, '2026-01-03', 'crypto')`, 'invalid');
await expectCode('zero amount', `insert into payments (bill_id, amount, paid_on, method) values ('${bill.id}', 0, '2026-01-03', 'cash')`, 'invalid');
await expectCode('delete a bill that has payments', `delete from bills where id = '${bill.id}'`, 'has_payments', { deleting: true });
await expectCode('another user\'s parent id (composite foreign key)', `insert into units (property_id, user_id, name) values ('${prop.id}', '22222222-2222-2222-2222-222222222222', 'Z')`, 'not_found');

// errors that do not come from Postgres
const direct: Array<[string, Parameters<typeof mapError>[0], string]> = [
  ['network failure', { message: 'TypeError: Failed to fetch' }, 'network'],
  ['rate limited by auth (HTTP 429)', { status: 429, message: 'email rate limit exceeded' }, 'rate_limited'],
  ['row not found (PostgREST)', { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 'not_found'],
];
for (const [name, e, want] of direct) {
  const got = mapError(e).code;
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ` got ${got} want ${want}`));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
