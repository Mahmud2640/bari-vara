import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import fs from 'node:fs';

// Run with: npm run test:schema   (runs every migration, in order, on a real Postgres compiled to WASM)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const schema = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const db = new PGlite({ extensions: { btree_gist } });

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
await db.exec(schema);
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
               grant execute on all functions in schema public to authenticated;`);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + extra)); };
const fails = async (name, sql, code) => {
  try { await db.exec(sql); ok(name, false, 'did not fail'); }
  catch (e) { ok(name, !code || e.code === code, `got ${e.code}: ${e.message}`); }
};
const as = async (uid) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role authenticated;`); };
const q = async (sql) => (await db.query(sql)).rows;

const u1 = '11111111-1111-1111-1111-111111111111', u2 = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users (id, email) values ('${u1}','a@x.test'),('${u2}','b@x.test')`);
ok('profile auto-created', (await q('select count(*)::int c from profiles'))[0].c === 2);

await as(u1);
const [prop] = await q(`insert into properties (name, address) values ('Galaxy Mansion','Dhanmondi') returning id`);
const [unit] = await q(`insert into units (property_id, name, default_rent) values ('${prop.id}','4C',180000) returning id`);
const [ten] = await q(`insert into tenants (unit_id, name, monthly_rent, monthly_utilities, move_in_on) values ('${unit.id}','Emran',180000,60000,'2025-12-01') returning id`);
await fails('second active tenant in same unit rejected', `insert into tenants (unit_id,name,monthly_rent) values ('${unit.id}','X',1)`, '23505');

let r = (await q(`select * from create_bills('${prop.id}','2026-01-01','2026-01-31')`))[0];
ok('create_bills creates 1', r.created_count === 1 && r.skipped_count === 0, JSON.stringify(r));
r = (await q(`select * from create_bills('${prop.id}','2026-01-01','2026-01-31')`))[0];
ok('create_bills twice creates 0, skipped 1', r.created_count === 0 && r.skipped_count === 1, JSON.stringify(r));
await fails('overlapping custom range rejected', `insert into bills (tenant_id,unit_id,period_start,period_end,base_rent) values ('${ten.id}','${unit.id}','2026-01-15','2026-02-15',1)`, '23P01');
r = (await q(`select * from create_bills('${prop.id}','2026-02-01','2026-02-28')`))[0];
ok('next month creates 1', r.created_count === 1);

let [bill] = await q(`select * from bill_summary where period_start = '2026-01-01'`);
ok('total_due = rent + utilities', Number(bill.total_due) === 240000 && bill.status === 'due', JSON.stringify(bill));
await db.exec(`insert into payments (bill_id, amount, paid_on, method) values ('${bill.id}',100000,'2026-01-05','card')`);
[bill] = await q(`select * from bill_summary where id='${bill.id}'`);
ok('partial status + balance', bill.status === 'partial' && Number(bill.balance) === 140000, JSON.stringify(bill));
await fails('overpayment rejected', `insert into payments (bill_id, amount, paid_on, method) values ('${bill.id}',140001,'2026-01-06','cash')`, '23514');
await fails('bad method rejected', `insert into payments (bill_id, amount, paid_on, method) values ('${bill.id}',1,'2026-01-06','crypto')`, '23514');
await fails('bill edit below paid rejected', `update bills set base_rent = 1000 where id='${bill.id}'`, '23514');
const rid = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into payments (bill_id, amount, paid_on, method, client_request_id) values ('${bill.id}',140000,'2026-01-20','nagad','${rid}')`);
await fails('same client_request_id rejected (idempotency)', `insert into payments (bill_id, amount, paid_on, method, client_request_id) values ('${bill.id}',1,'2026-01-21','cash','${rid}')`, '23505');
await db.exec(`insert into payments (bill_id, amount, paid_on, method, client_request_id) values ('${bill.id}',140000,'2026-01-20','nagad','${rid}') on conflict (user_id, client_request_id) do nothing`);
ok('retry with ON CONFLICT DO NOTHING adds no row', (await q(`select count(*)::int c from payments where bill_id='${bill.id}'`))[0].c === 2);
[bill] = await q(`select * from bill_summary where id='${bill.id}'`);
ok('paid status', bill.status === 'paid' && Number(bill.balance) === 0);

await db.exec(`insert into bill_utilities (bill_id, name, amount) values ('${bill.id}','gas',30000)`).catch(e => ok('itemised utilities after paid bill is blocked when total would drop below paid', e.code === '23514', e.message));

const ms = (await q(`select * from month_summary('${prop.id}','2026-01-15')`))[0];
ok('month_summary', Number(ms.collected_amount) === 240000 && Number(ms.billed_amount) === 240000 && Number(ms.due_amount) === 0 && ms.paid_bills === 1 && ms.unpaid_bills === 0, JSON.stringify(ms));
ok('month_summary outstanding = unpaid bills of every month', Number(ms.outstanding_amount) === 240000 && ms.outstanding_bills === 1, JSON.stringify(ms));
await db.exec(`insert into expenses (property_id, title, amount, spent_on) values ('${prop.id}','Pipe repair',50000,'2026-01-10')`);
const ys = await q(`select * from year_summary('${prop.id}',2026)`);
ok('year_summary 12 rows, Jan collected', ys.length === 12 && Number(ys[0].collected_amount) === 240000 && Number(ys[0].expense_amount) === 50000 && Number(ys[1].billed_amount) === 240000, JSON.stringify(ys.slice(0, 2)));

await db.exec(`update profiles set primary_property_id = '${prop.id}' where id = '${u1}'`);

// cross-user isolation
await as(u2);
ok('u2 sees none of u1 rows', (await q('select (select count(*) from properties)+(select count(*) from bills)+(select count(*) from payments) c'))[0].c == 0);
await fails('u2 cannot attach a unit to u1 property', `insert into units (property_id, name) values ('${prop.id}','hack')`, '23503');
await fails('u2 cannot set primary to u1 property', `update profiles set primary_property_id = '${prop.id}' where id = '${u2}'`, '23503');
r = (await q(`select * from create_bills('${prop.id}','2026-03-01','2026-03-31')`))[0];
ok('u2 create_bills on u1 property creates 0', r.created_count === 0 && r.skipped_count === 0, JSON.stringify(r));
await fails('anon-style uid mismatch insert rejected', `insert into properties (user_id, name) values ('${u1}','steal')`, '42501');

// delete rules
await as(u1);
await fails('cannot delete tenant that has bills', `delete from tenants where id='${ten.id}'`, '23503');
await fails('cannot delete bill that has payments', `delete from bills where id='${bill.id}'`, '23503');

await db.exec('reset role');
await db.exec(`delete from auth.users where id = '${u1}'`);
const left = (await q(`select (select count(*) from properties) p,(select count(*) from tenants) t,(select count(*) from bills) b,(select count(*) from payments) pay,(select count(*) from expenses) e,(select count(*) from profiles) pr`))[0];
ok('account deletion cascades through the NO ACTION chain', left.p == 0 && left.t == 0 && left.b == 0 && left.pay == 0 && left.e == 0 && left.pr == 1, JSON.stringify(left));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
