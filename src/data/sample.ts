// Realistic fake data (no real people) for demos and for the seed script. Works on any DataLayer, fake or Supabase.
import { newId } from '../lib/id';
import { currentMonthKey, monthBounds, parseMonthKey, shiftMonth, todayISO } from '../lib/dates';
import type { DataLayer, Tenant } from './types';

export async function seedSample(layer: DataLayer, now: Date = new Date()): Promise<void> {
  const p = await layer.createProperty({ name: 'Galaxy Mansion', address: 'House 45, Road 13, Dhanmondi, Dhaka', makePrimary: true });
  await layer.createProperty({ name: 'Lake View', address: 'Bashundhara R/A, Dhaka' });
  const flats: Array<[string, string, number, number, string]> = [
    ['4C', 'Emran Aziz', 1800000, 60000, '01711000001'],
    ['5A', 'Nusrat Jahan', 2200000, 80000, '01811000002'],
    ['6B', 'Rakib Hasan', 1500000, 50000, '01911000003'],
  ];
  const thisMonth = currentMonthKey(now);
  const first = shiftMonth(thisMonth, -3);
  const tenants: Tenant[] = [];
  for (const [name, tenant, rent, util, phone] of flats) {
    const u = await layer.createUnit({ propertyId: p.id, name, floor: name.slice(0, 1), defaultRent: rent });
    tenants.push(await layer.createTenant({ unitId: u.id, name: tenant, phone, moveInOn: `${first}-01`, monthlyRent: rent, monthlyUtilities: util, note: null }));
  }
  for (const delta of [-2, -1, 0]) {
    const { year, monthIndex } = parseMonthKey(shiftMonth(thisMonth, delta));
    const { start, end } = monthBounds(year, monthIndex);
    await layer.createBills(p.id, start, end);
  }
  // older months fully paid; this month: one paid, one partial, one due
  for (const delta of [-2, -1]) {
    const key = shiftMonth(thisMonth, delta);
    for (const b of await layer.listBills({ propertyId: p.id, month: key })) {
      await layer.recordPayment({ billId: b.id, amount: b.totalDue, paidOn: `${key}-05`, method: 'cash', clientRequestId: newId() });
    }
  }
  const current = await layer.listBills({ propertyId: p.id, month: thisMonth });
  const day = todayISO(now);
  if (current[0]) await layer.recordPayment({ billId: current[0].id, amount: current[0].totalDue, paidOn: day, method: 'bkash', clientRequestId: newId() });
  if (current[1]) await layer.recordPayment({ billId: current[1].id, amount: Math.round(current[1].totalDue / 2), paidOn: day, method: 'nagad', clientRequestId: newId() });
}
