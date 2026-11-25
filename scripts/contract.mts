// The behaviour every data layer must have, fake or Supabase. Needs a signed-in layer for an account with no data.
// Dates are fixed in 2025-2026, so the result does not depend on today's date.
import { DataError, DataLayer } from '../src/data/types';

export interface Report {
  ok(name: string, cond: boolean, extra?: string): void;
  throws(name: string, fn: () => Promise<unknown>, code: string): Promise<void>;
}

export function makeReport(): Report & { summary(): { pass: number; fail: number } } {
  let pass = 0;
  let fail = 0;
  const ok = (name: string, cond: boolean, extra = '') => {
    cond ? pass++ : fail++;
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + extra));
  };
  const throws = async (name: string, fn: () => Promise<unknown>, code: string) => {
    try {
      await fn();
      ok(name, false, 'did not throw');
    } catch (e) {
      ok(name, e instanceof DataError && e.code === code, e instanceof DataError ? `got ${e.code}` : String(e));
    }
  };
  return { ok, throws, summary: () => ({ pass, fail }) };
}

export async function runContract(L: DataLayer, r: Report): Promise<void> {
  const { ok, throws } = r;

  // ---- properties ----------------------------------------------------------------------------
  const p = await L.createProperty({ name: '  Galaxy  ', address: ' ' });
  ok('property name trimmed, blank address null, first property becomes primary',
    p.name === 'Galaxy' && p.address === null && (await L.getProfile()).primaryPropertyId === p.id);
  await throws('blank property name rejected', () => L.createProperty({ name: ' ' }), 'invalid');

  // ---- units ---------------------------------------------------------------------------------
  const u = await L.createUnit({ propertyId: p.id, name: '4C', defaultRent: 1800000 });
  await throws('duplicate unit name rejected', () => L.createUnit({ propertyId: p.id, name: '4C', defaultRent: 1 }), 'duplicate_unit');
  await throws('fractional rent rejected (money is whole poisha)', () => L.createUnit({ propertyId: p.id, name: '5A', defaultRent: 10.5 }), 'invalid');

  // ---- tenants -------------------------------------------------------------------------------
  const t = await L.createTenant({ unitId: u.id, name: 'Emran', phone: null, moveInOn: '2025-12-01', monthlyRent: 1800000, monthlyUtilities: 600000, note: null });
  await throws('a second current tenant in a flat is rejected',
    () => L.createTenant({ unitId: u.id, name: 'X', phone: null, moveInOn: '2026-01-01', monthlyRent: 1, monthlyUtilities: 0, note: null }), 'unit_occupied');
  const unitsNow = await L.listUnits(p.id);
  ok('listUnits shows the current tenant', unitsNow.length === 1 && unitsNow[0].currentTenant?.id === t.id);

  // ---- bills ---------------------------------------------------------------------------------
  let r1 = await L.createBills(p.id, '2026-01-01', '2026-01-31');
  ok('createBills creates 1', r1.created === 1 && r1.skipped === 0, JSON.stringify(r1));
  r1 = await L.createBills(p.id, '2026-01-01', '2026-01-31');
  ok('createBills twice creates 0 and skips 1', r1.created === 0 && r1.skipped === 1, JSON.stringify(r1));
  r1 = await L.createBills(p.id, '2026-01-15', '2026-02-15');
  ok('an overlapping range creates nothing', r1.created === 0 && r1.skipped === 1, JSON.stringify(r1));
  await throws('period end before start rejected', () => L.createBills(p.id, '2026-02-10', '2026-02-01'), 'bad_dates');
  r1 = await L.createBills(p.id, '2025-10-01', '2025-10-31');
  ok('a tenant who moved in later gets no earlier bill', r1.created === 0 && r1.skipped === 0, JSON.stringify(r1));
  await L.createBills(p.id, '2026-02-01', '2026-02-28');
  ok('monthsWithBills', JSON.stringify(await L.monthsWithBills(p.id, 2026)) === '[0,1]');

  let [bill] = await L.listBills({ propertyId: p.id, month: '2026-01' });
  ok('total = rent + utilities, status due, names joined',
    bill.totalDue === 2400000 && bill.status === 'due' && bill.unitName === '4C' && bill.tenantName === 'Emran');

  // ---- payments ------------------------------------------------------------------------------
  await L.recordPayment({ billId: bill.id, amount: 1000000, paidOn: '2026-01-05', method: 'card', clientRequestId: 'a'.padEnd(8, 'a') + '-0000-4000-8000-000000000001' });
  [bill] = await L.listBills({ propertyId: p.id, month: '2026-01' });
  ok('partial status and balance', bill.status === 'partial' && bill.balance === 1400000);
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await throws('over-payment rejected', () => L.recordPayment({ billId: bill.id, amount: 1400001, paidOn: '2026-01-06', method: 'cash', clientRequestId: id(2) }), 'over_payment');
  await throws('zero amount rejected', () => L.recordPayment({ billId: bill.id, amount: 0, paidOn: '2026-01-06', method: 'cash', clientRequestId: id(3) }), 'invalid');
  await throws('impossible date rejected', () => L.recordPayment({ billId: bill.id, amount: 1, paidOn: '2026-02-30', method: 'cash', clientRequestId: id(4) }), 'invalid');
  await throws('unknown method rejected', () => L.recordPayment({ billId: bill.id, amount: 1, paidOn: '2026-01-06', method: 'crypto' as never, clientRequestId: id(5) }), 'invalid');
  await throws('editing a bill below what was paid is rejected', () => L.updateBill(bill.id, { baseRent: 1000 }), 'below_paid');
  const last = await L.recordPayment({ billId: bill.id, amount: 1400000, paidOn: '2026-01-20', method: 'nagad', clientRequestId: id(6) });
  const again = await L.recordPayment({ billId: bill.id, amount: 1400000, paidOn: '2026-01-20', method: 'nagad', clientRequestId: id(6) });
  ok('a retry with the same clientRequestId returns the same payment, no error, no duplicate',
    again.id === last.id && (await L.getBill(bill.id)).payments.length === 2);
  [bill] = await L.listBills({ propertyId: p.id, month: '2026-01' });
  ok('paid status', bill.status === 'paid' && bill.balance === 0);
  await throws('a bill with payments cannot be deleted', () => L.deleteBill(bill.id), 'has_payments');

  // ---- reports -------------------------------------------------------------------------------
  const ms = await L.monthSummary(p.id, '2026-01');
  ok('monthSummary for a paid month',
    ms.collectedAmount === 2400000 && ms.billedAmount === 2400000 && ms.dueAmount === 0 && ms.paidBills === 1 && ms.unpaidBills === 0, JSON.stringify(ms));
  const feb = await L.monthSummary(p.id, '2026-02');
  ok('monthSummary for an unpaid month', feb.collectedAmount === 0 && feb.dueAmount === 2400000 && feb.unpaidBills === 1, JSON.stringify(feb));
  ok('outstanding counts unpaid bills of every month', feb.outstandingAmount === 2400000 && feb.outstandingBills === 1, JSON.stringify(feb));
  const jan = await L.monthSummary(p.id, '2026-01');
  ok('an old unpaid bill is not hidden when looking at a paid month', jan.dueAmount === 0 && jan.outstandingAmount === 2400000, JSON.stringify(jan));

  // ---- deletes and undo ----------------------------------------------------------------------
  const [febBill] = await L.listBills({ propertyId: p.id, month: '2026-02' });
  await L.deleteBill(febBill.id);
  ok('an unpaid bill can be deleted', (await L.listBills({ propertyId: p.id, month: '2026-02' })).length === 0);
  await L.deletePayment(last.id);
  [bill] = await L.listBills({ propertyId: p.id, month: '2026-01' });
  ok('undoing a payment returns the bill to partial', bill.status === 'partial');

  // ---- move out, history ---------------------------------------------------------------------
  await L.updateTenant(t.id, { movedOutOn: '2026-03-31' });
  ok('moved-out tenant leaves the current list but stays in history',
    (await L.listTenants(p.id)).length === 0 && (await L.listTenants(p.id, { includePast: true })).length === 1);
  await throws('move-out before move-in rejected', () => L.updateTenant(t.id, { movedOutOn: '2025-01-01' }), 'bad_dates');
  const t2 = await L.createTenant({ unitId: u.id, name: 'New', phone: null, moveInOn: '2026-04-01', monthlyRent: 1, monthlyUtilities: 0, note: null });
  ok('a flat takes a new tenant after move-out', !!t2.id);

  // ---- archive -------------------------------------------------------------------------------
  await L.updateProperty(p.id, { archived: true });
  ok('an archived property leaves the list and is no longer primary',
    (await L.listProperties()).length === 0 && (await L.getProfile()).primaryPropertyId === null);
}
