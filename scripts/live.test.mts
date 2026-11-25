/// <reference types="node" />
// Run with: npm run test:live      (needs your own Supabase project: see replica/backend.md)
// Runs the same contract as the demo layer, but against your real project, as two separate test users:
//   user A runs every data check, user B must see and change nothing of A's.  Then both accounts are deleted.
// Uses the service role key ONLY here, to create and remove the two test users. Never put that key in the app.
import { createClient } from '@supabase/supabase-js';
import { createSupabaseLayer } from '../src/data/supabase';
import { makeReport, runContract } from './contract.mts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY. See replica/backend.md.');
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const admin = createClient(url, service, opts);
const stamp = Date.now();
const password = `Test-${stamp}-pw!`;
const r = makeReport();

async function makeUser(tag: string) {
  const email = `contract-${tag}-${stamp}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`could not create ${tag}: ${created.error?.message}`);
  const client = createClient(url!, anon!, opts);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`could not sign in ${tag}: ${signedIn.error.message}`);
  return { id: created.data.user.id, client, layer: createSupabaseLayer(client) };
}

const a = await makeUser('a');
const b = await makeUser('b');
let exit = 0;
try {
  // a new account starts with a profile (created by the trigger) and nothing else
  const profile = await a.layer.getProfile();
  r.ok('new account has a profile and no data', profile.id === a.id && (await a.layer.listProperties()).length === 0);

  await runContract(a.layer, r);

  // ---- isolation: B must get nothing of A's ------------------------------------------------------
  const pA = await a.layer.createProperty({ name: 'A only', address: null });
  const uA = await a.layer.createUnit({ propertyId: pA.id, name: 'A1', defaultRent: 100000 });
  const tA = await a.layer.createTenant({ unitId: uA.id, name: 'Tenant A', phone: null, moveInOn: '2025-01-01', monthlyRent: 100000, monthlyUtilities: 0, note: null });
  await a.layer.createBills(pA.id, '2026-05-01', '2026-05-31');
  const [billA] = await a.layer.listBills({ propertyId: pA.id, month: '2026-05' });

  r.ok('B sees no properties', (await b.layer.listProperties()).length === 0);
  r.ok('B sees no units of A', (await b.layer.listUnits(pA.id)).length === 0);
  r.ok('B sees no tenants of A', (await b.layer.listTenants(pA.id, { includePast: true })).length === 0);
  r.ok('B sees no bills of A', (await b.layer.listBills({ propertyId: pA.id, month: '2026-05' })).length === 0);
  r.ok('B profile has no primary property', (await b.layer.getProfile()).primaryPropertyId === null);
  await r.throws("B cannot read A's property", () => b.layer.getProperty(pA.id), 'not_found');
  await r.throws("B cannot read A's bill", () => b.layer.getBill(billA.id), 'not_found');
  await r.throws("B cannot attach a unit to A's property", () => b.layer.createUnit({ propertyId: pA.id, name: 'hack', defaultRent: 1 }), 'invalid');
  await r.throws("B cannot pay A's bill", () => b.layer.recordPayment({ billId: billA.id, amount: 1, paidOn: '2026-05-02', method: 'cash', clientRequestId: '00000000-0000-4000-8000-0000000000aa' }), 'invalid');
  const made = await b.layer.createBills(pA.id, '2026-06-01', '2026-06-30');
  r.ok("B's create_bills on A's property makes nothing", made.created === 0 && made.skipped === 0, JSON.stringify(made));
  await r.throws("B cannot delete A's bill", () => b.layer.deleteBill(billA.id), 'not_found');
  await r.throws("B cannot change A's tenant", () => b.layer.updateTenant(tA.id, { name: 'hijacked' }), 'not_found');
  r.ok("A's data is untouched after B's attempts", (await a.layer.getBill(billA.id)).bill.tenantName === 'Tenant A');

  // ---- account deletion ----------------------------------------------------------------------------
  if (process.env.TEST_DELETE_FUNCTION === '1') {
    await a.layer.deleteAccount();
    const gone = await admin.auth.admin.getUserById(a.id);
    r.ok('delete-account Edge Function removed the user', !!gone.error || !gone.data.user);
  } else {
    console.log('SKIP delete-account Edge Function (deploy it, then run with TEST_DELETE_FUNCTION=1)');
    await admin.auth.admin.deleteUser(a.id);
  }
  const left = await admin.from('properties').select('id', { count: 'exact', head: true }).eq('user_id', a.id);
  r.ok("deleting the account erased all of A's data (cascade)", left.count === 0, `count=${left.count}`);
} catch (e) {
  console.error('LIVE TEST ERROR', e);
  exit = 1;
} finally {
  await admin.auth.admin.deleteUser(a.id).catch(() => {});
  await admin.auth.admin.deleteUser(b.id).catch(() => {});
}
const { pass, fail } = r.summary();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(exit || (fail ? 1 : 0));
