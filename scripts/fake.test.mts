// Run with: npm run test:data
// The fake data layer must pass the same contract as the real one, plus its own auth and sample-data checks.
import { createFakeLayer, DEMO_CODE } from '../src/data/fake';
import { DataError } from '../src/data/types';
import { makeReport, runContract } from './contract.mts';

const mem = new Map<string, string>();
const storage = { get: async (k: string) => mem.get(k) ?? null, set: async (k: string, v: string) => void mem.set(k, v) };
const fixedNow = () => new Date(2026, 10, 25, 12, 0, 0); // 25 Nov 2026
const L = createFakeLayer(storage, fixedNow);
const r = makeReport();

await L.sendCode('owner@example.com');
await r.throws('wrong code rejected', () => L.verifyCode('owner@example.com', '000111'), 'bad_code');
await r.throws('bad email rejected', () => L.sendCode('nope'), 'invalid');
await L.verifyCode('owner@example.com', DEMO_CODE);
r.ok('session set', (await L.getSession())?.email === 'owner@example.com');

await runContract(L, r);

await L.reset();
await L.sendCode('a@b.co');
await L.verifyCode('a@b.co', DEMO_CODE);
await L.loadSampleData!();
const props = await L.listProperties();
const cur = await L.listBills({ propertyId: props[0].id, month: '2026-11' });
r.ok('sample data: 2 properties, 3 bills this month: paid, partial, due', props.length === 2 && cur.map((b) => b.status).join() === 'paid,partial,due', cur.map((b) => b.status).join());

await L.deleteAccount();
r.ok('deleteAccount removes the data and ends the session', (await L.getSession()) === null || (await L.getSession())?.email === 'a@b.co');
await L.sendCode('a@b.co');
await L.verifyCode('a@b.co', DEMO_CODE);
r.ok('after deleting, a new sign-in starts empty', (await L.listProperties()).length === 0);

void DataError;
const { pass, fail } = r.summary();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
