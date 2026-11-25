// In-memory data layer with the same function signatures as the real one (see types.ts: DataLayer).
// It enforces the same rules as replica/schema.sql, so screens cannot rely on the fake being more forgiving.
// Replace by swapping the export in index.ts. Nothing else changes.
import { newId } from '../lib/id';
import { isValidISO, parseMonthKey, monthBounds, rangesOverlap } from '../lib/dates';
import { seedSample } from './sample';
import {
  Bill, BillDetail, BillFilter, BillStatus, BillSummary, DataError, DataLayer, Id, MonthSummary, NewPayment, Payment,
  PAYMENT_METHODS, Profile, Property, Session, Tenant, TenantWithUnit, Unit, UnitWithTenant,
} from './types';

export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

interface DB {
  session: Session | null;
  pendingCode: { email: string; code: string } | null;
  profile: Profile;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  bills: Array<Omit<Bill, 'totalDue'>>;
  payments: Payment[];
}

const KEY = 'rentbook.fake.v1';
export const DEMO_CODE = '123456';

function emptyDB(): DB {
  return {
    session: null,
    pendingCode: null,
    profile: { id: 'user-1', displayName: null, language: 'bn', reminderDaysBefore: 2, primaryPropertyId: null },
    properties: [], units: [], tenants: [], bills: [], payments: [],
  };
}

export function statusOf(totalDue: number, paid: number): BillStatus {
  if (paid >= totalDue) return 'paid';
  if (paid === 0) return 'due';
  return 'partial';
}

const need = (cond: unknown, code: DataError['code'], msg?: string) => {
  if (!cond) throw new DataError(code, msg);
};
const trimmed = (s: string | null | undefined) => (s ?? '').trim();
const nullIfBlank = (s: string | null | undefined) => (trimmed(s) === '' ? null : trimmed(s));
const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

export function createFakeLayer(storage: Storage, now: () => Date = () => new Date()): DataLayer & { reset(): Promise<void> } {
  let db: DB | null = null;

  async function load(): Promise<DB> {
    if (db) return db;
    const raw = await storage.get(KEY);
    db = raw ? (JSON.parse(raw) as DB) : emptyDB();
    return db;
  }
  async function save(): Promise<void> {
    if (db) await storage.set(KEY, JSON.stringify(db));
  }
  const requireSession = (d: DB) => need(d.session, 'not_found', 'not signed in');

  // ---- derived values (the SQL view bill_summary) -------------------------------------------
  const withTotal = (b: Omit<Bill, 'totalDue'>): Bill => ({ ...b, totalDue: b.baseRent + b.utilitiesTotal });
  const paidOf = (d: DB, billId: Id) => d.payments.filter((p) => p.billId === billId).reduce((s, p) => s + p.amount, 0);
  function summarise(d: DB, b: Omit<Bill, 'totalDue'>): BillSummary {
    const full = withTotal(b);
    const paid = paidOf(d, b.id);
    return {
      ...full,
      paidAmount: paid,
      balance: full.totalDue - paid,
      status: statusOf(full.totalDue, paid),
      tenantName: d.tenants.find((t) => t.id === b.tenantId)?.name ?? '',
      unitName: d.units.find((u) => u.id === b.unitId)?.name ?? '',
    };
  }
  const unitsOfProperty = (d: DB, propertyId: Id) => d.units.filter((u) => u.propertyId === propertyId);
  const currentTenantOfUnit = (d: DB, unitId: Id) => d.tenants.find((t) => t.unitId === unitId && t.movedOutOn === null) ?? null;

  const layer: DataLayer & { reset(): Promise<void> } = {
    async reset() {
      db = emptyDB();
      await save();
    },

    // ---- auth -------------------------------------------------------------------------------
    async sendCode(email) {
      const d = await load();
      need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed(email)), 'invalid', 'email');
      d.pendingCode = { email: trimmed(email).toLowerCase(), code: DEMO_CODE };
      await save();
    },
    async verifyCode(email, code) {
      const d = await load();
      const ok = d.pendingCode && d.pendingCode.email === trimmed(email).toLowerCase() && d.pendingCode.code === trimmed(code);
      need(ok, 'bad_code');
      d.pendingCode = null;
      d.session = { userId: d.profile.id, email: trimmed(email).toLowerCase() };
      await save();
      return d.session;
    },
    async signOut() {
      const d = await load();
      d.session = null;
      await save();
    },
    async getSession() {
      return (await load()).session;
    },

    // ---- profile ----------------------------------------------------------------------------
    async getProfile() {
      const d = await load();
      requireSession(d);
      return { ...d.profile };
    },
    async updateProfile(patch) {
      const d = await load();
      requireSession(d);
      if (patch.reminderDaysBefore !== undefined) need(patch.reminderDaysBefore >= 0 && patch.reminderDaysBefore <= 28, 'invalid');
      d.profile = { ...d.profile, ...patch };
      await save();
      return { ...d.profile };
    },

    // ---- properties -------------------------------------------------------------------------
    async listProperties() {
      const d = await load();
      requireSession(d);
      return d.properties.filter((p) => p.archivedAt === null).map((p) => ({ ...p }));
    },
    async getProperty(id) {
      const d = await load();
      const p = d.properties.find((x) => x.id === id);
      need(p, 'not_found');
      return { ...p! };
    },
    async createProperty({ name, address, makePrimary }) {
      const d = await load();
      requireSession(d);
      need(trimmed(name) !== '', 'invalid', 'name');
      const p: Property = { id: newId(), name: trimmed(name), address: nullIfBlank(address), archivedAt: null };
      d.properties.push(p);
      if (makePrimary || d.profile.primaryPropertyId === null) d.profile.primaryPropertyId = p.id;
      await save();
      return { ...p };
    },
    async updateProperty(id, patch) {
      const d = await load();
      requireSession(d);
      const p = d.properties.find((x) => x.id === id);
      need(p, 'not_found');
      if (patch.name !== undefined) {
        need(trimmed(patch.name) !== '', 'invalid', 'name');
        p!.name = trimmed(patch.name);
      }
      if (patch.address !== undefined) p!.address = nullIfBlank(patch.address);
      if (patch.archived !== undefined) p!.archivedAt = patch.archived ? now().toISOString() : null;
      if (patch.makePrimary) d.profile.primaryPropertyId = id;
      if (p!.archivedAt && d.profile.primaryPropertyId === id) {
        d.profile.primaryPropertyId = d.properties.find((x) => x.archivedAt === null && x.id !== id)?.id ?? null;
      }
      await save();
      return { ...p! };
    },

    // ---- units ------------------------------------------------------------------------------
    async listUnits(propertyId) {
      const d = await load();
      requireSession(d);
      return unitsOfProperty(d, propertyId)
        .filter((u) => u.archivedAt === null)
        .map((u): UnitWithTenant => ({ ...u, currentTenant: currentTenantOfUnit(d, u.id) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    },
    async getUnit(id) {
      const d = await load();
      const u = d.units.find((x) => x.id === id);
      need(u, 'not_found');
      return { ...u! };
    },
    async createUnit({ propertyId, name, floor, defaultRent }) {
      const d = await load();
      requireSession(d);
      need(d.properties.some((p) => p.id === propertyId), 'not_found');
      need(trimmed(name) !== '', 'invalid', 'name');
      need(isMoney(defaultRent), 'invalid', 'rent');
      need(!unitsOfProperty(d, propertyId).some((u) => u.archivedAt === null && u.name === trimmed(name)), 'duplicate_unit');
      const u: Unit = { id: newId(), propertyId, name: trimmed(name), floor: nullIfBlank(floor), defaultRent, archivedAt: null };
      d.units.push(u);
      await save();
      return { ...u };
    },
    async updateUnit(id, patch) {
      const d = await load();
      requireSession(d);
      const u = d.units.find((x) => x.id === id);
      need(u, 'not_found');
      if (patch.name !== undefined) {
        need(trimmed(patch.name) !== '', 'invalid', 'name');
        need(!unitsOfProperty(d, u!.propertyId).some((o) => o.id !== id && o.archivedAt === null && o.name === trimmed(patch.name)), 'duplicate_unit');
        u!.name = trimmed(patch.name);
      }
      if (patch.floor !== undefined) u!.floor = nullIfBlank(patch.floor);
      if (patch.defaultRent !== undefined) {
        need(isMoney(patch.defaultRent), 'invalid', 'rent');
        u!.defaultRent = patch.defaultRent;
      }
      if (patch.archived !== undefined) u!.archivedAt = patch.archived ? now().toISOString() : null;
      await save();
      return { ...u! };
    },

    // ---- tenants ----------------------------------------------------------------------------
    async listTenants(propertyId, opts) {
      const d = await load();
      requireSession(d);
      const unitIds = new Map(unitsOfProperty(d, propertyId).map((u) => [u.id, u.name]));
      return d.tenants
        .filter((t) => unitIds.has(t.unitId) && (opts?.includePast || t.movedOutOn === null))
        .map((t): TenantWithUnit => ({ ...t, unitName: unitIds.get(t.unitId)! }))
        .sort((a, b) => a.unitName.localeCompare(b.unitName, undefined, { numeric: true }));
    },
    async getTenant(id) {
      const d = await load();
      const t = d.tenants.find((x) => x.id === id);
      need(t, 'not_found');
      return { ...t!, unitName: d.units.find((u) => u.id === t!.unitId)?.name ?? '' };
    },
    async createTenant(input) {
      const d = await load();
      requireSession(d);
      need(d.units.some((u) => u.id === input.unitId), 'not_found');
      need(trimmed(input.name) !== '', 'invalid', 'name');
      need(isMoney(input.monthlyRent) && isMoney(input.monthlyUtilities), 'invalid', 'rent');
      need(isValidISO(input.moveInOn), 'invalid', 'date');
      need(currentTenantOfUnit(d, input.unitId) === null, 'unit_occupied');
      const t: Tenant = {
        id: newId(), unitId: input.unitId, name: trimmed(input.name), phone: nullIfBlank(input.phone),
        moveInOn: input.moveInOn, movedOutOn: null, monthlyRent: input.monthlyRent,
        monthlyUtilities: input.monthlyUtilities, note: nullIfBlank(input.note),
      };
      d.tenants.push(t);
      await save();
      return { ...t };
    },
    async updateTenant(id, patch) {
      const d = await load();
      requireSession(d);
      const t = d.tenants.find((x) => x.id === id);
      need(t, 'not_found');
      if (patch.name !== undefined) {
        need(trimmed(patch.name) !== '', 'invalid', 'name');
        t!.name = trimmed(patch.name);
      }
      if (patch.phone !== undefined) t!.phone = nullIfBlank(patch.phone);
      if (patch.note !== undefined) t!.note = nullIfBlank(patch.note);
      if (patch.monthlyRent !== undefined) { need(isMoney(patch.monthlyRent), 'invalid', 'rent'); t!.monthlyRent = patch.monthlyRent; }
      if (patch.monthlyUtilities !== undefined) { need(isMoney(patch.monthlyUtilities), 'invalid', 'rent'); t!.monthlyUtilities = patch.monthlyUtilities; }
      if (patch.moveInOn !== undefined) { need(isValidISO(patch.moveInOn), 'invalid', 'date'); t!.moveInOn = patch.moveInOn; }
      if (patch.movedOutOn !== undefined) {
        if (patch.movedOutOn !== null) need(isValidISO(patch.movedOutOn), 'invalid', 'date');
        t!.movedOutOn = patch.movedOutOn;
      }
      need(t!.movedOutOn === null || t!.movedOutOn >= t!.moveInOn, 'bad_dates');
      need(t!.movedOutOn !== null || d.tenants.every((o) => o.id === t!.id || o.unitId !== t!.unitId || o.movedOutOn !== null), 'unit_occupied');
      await save();
      return { ...t! };
    },

    // ---- bills ------------------------------------------------------------------------------
    // One transaction. Running it twice creates nothing new (the SQL exclusion constraint does this).
    async createBills(propertyId, periodStart, periodEnd) {
      const d = await load();
      requireSession(d);
      need(isValidISO(periodStart) && isValidISO(periodEnd), 'invalid', 'date');
      need(periodEnd >= periodStart, 'bad_dates');
      const unitIds = new Set(unitsOfProperty(d, propertyId).map((u) => u.id));
      const eligible = d.tenants.filter(
        (t) => unitIds.has(t.unitId) && t.moveInOn <= periodEnd && (t.movedOutOn === null || t.movedOutOn >= periodStart),
      );
      let created = 0;
      for (const t of eligible) {
        const clash = d.bills.some((b) => b.tenantId === t.id && rangesOverlap(b.periodStart, b.periodEnd, periodStart, periodEnd));
        if (clash) continue;
        d.bills.push({
          id: newId(), tenantId: t.id, unitId: t.unitId, periodStart, periodEnd,
          baseRent: t.monthlyRent, utilitiesTotal: t.monthlyUtilities, note: null,
        });
        created++;
      }
      await save();
      return { created, skipped: eligible.length - created };
    },
    async monthsWithBills(propertyId, year) {
      const d = await load();
      requireSession(d);
      const unitIds = new Set(unitsOfProperty(d, propertyId).map((u) => u.id));
      const months = new Set<number>();
      for (const b of d.bills) {
        if (!unitIds.has(b.unitId)) continue;
        const { year: y, monthIndex } = parseMonthKey(b.periodStart.slice(0, 7));
        if (y === year) months.add(monthIndex);
      }
      return [...months].sort((a, b) => a - b);
    },
    async listBills(f: BillFilter) {
      const d = await load();
      requireSession(d);
      const unitIds = new Set(unitsOfProperty(d, f.propertyId).map((u) => u.id));
      return d.bills
        .filter((b) => unitIds.has(b.unitId) && b.periodStart.slice(0, 7) === f.month && (!f.tenantId || b.tenantId === f.tenantId))
        .map((b) => summarise(d, b))
        .filter((b) => !f.status || b.status === f.status)
        .sort((a, b) => a.unitName.localeCompare(b.unitName, undefined, { numeric: true }));
    },
    async getBill(id): Promise<BillDetail> {
      const d = await load();
      requireSession(d);
      const b = d.bills.find((x) => x.id === id);
      need(b, 'not_found');
      const unit = d.units.find((u) => u.id === b!.unitId);
      const property = d.properties.find((p) => p.id === unit?.propertyId);
      return {
        bill: summarise(d, b!),
        payments: d.payments.filter((p) => p.billId === id).sort((x, y) => x.paidOn.localeCompare(y.paidOn)).map((p) => ({ ...p })),
        propertyName: property?.name ?? '',
      };
    },
    async updateBill(id, patch) {
      const d = await load();
      requireSession(d);
      const b = d.bills.find((x) => x.id === id);
      need(b, 'not_found');
      const baseRent = patch.baseRent ?? b!.baseRent;
      const utilitiesTotal = patch.utilitiesTotal ?? b!.utilitiesTotal;
      need(isMoney(baseRent) && isMoney(utilitiesTotal), 'invalid', 'rent');
      need(baseRent + utilitiesTotal >= paidOf(d, id), 'below_paid');
      b!.baseRent = baseRent;
      b!.utilitiesTotal = utilitiesTotal;
      if (patch.note !== undefined) b!.note = nullIfBlank(patch.note);
      await save();
      return summarise(d, b!);
    },
    async deleteBill(id) {
      const d = await load();
      requireSession(d);
      need(d.bills.some((b) => b.id === id), 'not_found');
      need(!d.payments.some((p) => p.billId === id), 'has_payments');
      d.bills = d.bills.filter((b) => b.id !== id);
      await save();
    },

    // ---- payments ---------------------------------------------------------------------------
    async recordPayment(input: NewPayment) {
      const d = await load();
      requireSession(d);
      // a retry of a request that already succeeded returns the same payment, never an error and never a duplicate
      const existing = d.payments.find((p) => p.clientRequestId === input.clientRequestId);
      if (existing) return { ...existing };
      const b = d.bills.find((x) => x.id === input.billId);
      need(b, 'not_found');
      need(isMoney(input.amount) && input.amount > 0, 'invalid', 'amount');
      need(isValidISO(input.paidOn), 'invalid', 'date');
      need(PAYMENT_METHODS.includes(input.method), 'invalid', 'method');
      need(paidOf(d, input.billId) + input.amount <= b!.baseRent + b!.utilitiesTotal, 'over_payment');
      const p: Payment = {
        id: newId(), billId: input.billId, amount: input.amount, paidOn: input.paidOn, method: input.method,
        note: nullIfBlank(input.note), clientRequestId: input.clientRequestId,
      };
      d.payments.push(p);
      await save();
      return { ...p };
    },
    async deletePayment(id) {
      const d = await load();
      requireSession(d);
      need(d.payments.some((p) => p.id === id), 'not_found');
      d.payments = d.payments.filter((p) => p.id !== id);
      await save();
    },

    // ---- reports ----------------------------------------------------------------------------
    // collected = payments received in the month (by paid_on); billed and due = bills whose period starts in it.
    async monthSummary(propertyId, month): Promise<MonthSummary> {
      const d = await load();
      requireSession(d);
      const { year, monthIndex } = parseMonthKey(month);
      const { start, end } = monthBounds(year, monthIndex);
      const unitIds = new Set(unitsOfProperty(d, propertyId).map((u) => u.id));
      const billIds = new Set(d.bills.filter((b) => unitIds.has(b.unitId)).map((b) => b.id));
      const collected = d.payments.filter((p) => billIds.has(p.billId) && p.paidOn >= start && p.paidOn <= end).reduce((s, p) => s + p.amount, 0);
      const monthBills = d.bills.filter((b) => unitIds.has(b.unitId) && b.periodStart.slice(0, 7) === month).map((b) => summarise(d, b));
      const open = d.bills.filter((b) => unitIds.has(b.unitId)).map((b) => summarise(d, b)).filter((b) => b.status !== 'paid');
      return {
        collectedAmount: collected,
        billedAmount: monthBills.reduce((s, b) => s + b.totalDue, 0),
        dueAmount: monthBills.reduce((s, b) => s + b.balance, 0),
        expenseAmount: 0,
        paidBills: monthBills.filter((b) => b.status === 'paid').length,
        unpaidBills: monthBills.filter((b) => b.status !== 'paid').length,
        outstandingAmount: open.reduce((sum, b) => sum + b.balance, 0),
        outstandingBills: open.length,
      };
    },

    // ---- sample data (fake layer only) ------------------------------------------------------
    async loadSampleData() {
      requireSession(await load());
      await seedSample(layer, now());
    },

    // ---- account ----------------------------------------------------------------------------
    // deletes everything of the signed-in account, like the real layer's Edge Function
    async deleteAccount() {
      const d = await load();
      requireSession(d);
      db = emptyDB();
      await save();
    },
  };
  return layer;
}
