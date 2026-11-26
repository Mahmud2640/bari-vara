// The real data layer: Supabase (Postgres + Auth). Same interface as the fake one, same error codes, so no screen changes.
// Every rule is enforced by the database (supabase/migrations). This file only maps names and errors.
// Not yet run against a live project: scripts/live.test.mts does that once you add your keys (see replica/backend.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import { monthBounds, parseMonthKey } from '../lib/dates';
import {
  Bill, BillDetail, BillFilter, BillStatus, BillSummary, DataError, DataLayer, ErrorCode, Id, MonthSummary, NewPayment,
  Payment, PaymentMethod, Profile, Property, Session, Tenant, TenantWithUnit, Unit, UnitWithTenant,
} from './types';

// ---- errors ----------------------------------------------------------------------------------
interface PgError {
  code?: string;
  message?: string;
  details?: string | null;
  status?: number;
  name?: string;
}

const NETWORK = /failed to fetch|network request failed|networkerror|load failed|fetch failed/i;

export function mapError(e: PgError, ctx: { deleting?: boolean } = {}): DataError {
  const text = `${e.message ?? ''} ${e.details ?? ''}`;
  const code = e.code ?? '';
  let mapped: ErrorCode;
  if (NETWORK.test(text) || e.name === 'AuthRetryableFetchError') mapped = 'network';
  else if (e.status === 429 || /rate limit|too many/i.test(text)) mapped = 'rate_limited';
  else if (/error sending|smtp/i.test(text)) mapped = 'send_failed';
  else if (code === '23505') {
    if (text.includes('tenants_one_active_per_unit')) mapped = 'unit_occupied';
    else if (text.includes('units_name_per_property')) mapped = 'duplicate_unit';
    else mapped = 'invalid';
  } else if (code === '23514') {
    if (text.includes('exceeds the amount due')) mapped = 'over_payment';
    else if (text.includes('below the amount already paid')) mapped = 'below_paid';
    else if (text.includes('tenants_dates_ok') || text.includes('bills_period_ok')) mapped = 'bad_dates';
    else mapped = 'invalid';
  } else if (code === '23503') mapped = ctx.deleting ? 'has_payments' : 'invalid';
  else if (code === '23P01' || code === '22023') mapped = 'bad_dates';
  else if (code === 'PGRST116' || code === '42501') mapped = 'not_found';
  else if (['22P02', '22007', '22008', '22003', '23502'].includes(code)) mapped = 'invalid';
  else mapped = 'invalid';
  return new DataError(mapped, e.message);
}

function unwrap<T>(res: { data: T | null; error: PgError | null }, ctx?: { deleting?: boolean }): T {
  if (res.error) throw mapError(res.error, ctx);
  return res.data as T;
}

// ---- rows (snake_case, as the database sends them) -------------------------------------------------
interface ProfileRow { id: string; display_name: string | null; language: 'bn' | 'en'; reminder_days_before: number; primary_property_id: string | null }
interface PropertyRow { id: string; name: string; address: string | null; archived_at: string | null }
interface UnitRow { id: string; property_id: string; name: string; floor: string | null; default_rent: number; archived_at: string | null }
interface TenantRow {
  id: string; unit_id: string; name: string; phone: string | null; move_in_on: string; moved_out_on: string | null;
  monthly_rent: number; monthly_utilities: number; note: string | null;
}
interface BillRow {
  id: string; tenant_id: string; unit_id: string; period_start: string; period_end: string; base_rent: number;
  utilities_total: number; total_due: number; note: string | null;
}
interface BillSummaryRow extends BillRow { paid_amount: number; balance: number; status: BillStatus }
interface PaymentRow { id: string; bill_id: string; amount: number; paid_on: string; method: PaymentMethod; note: string | null; client_request_id: string | null }

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id, displayName: r.display_name, language: r.language, reminderDaysBefore: r.reminder_days_before, primaryPropertyId: r.primary_property_id,
});
const toProperty = (r: PropertyRow): Property => ({ id: r.id, name: r.name, address: r.address, archivedAt: r.archived_at });
const toUnit = (r: UnitRow): Unit => ({
  id: r.id, propertyId: r.property_id, name: r.name, floor: r.floor, defaultRent: Number(r.default_rent), archivedAt: r.archived_at,
});
const toTenant = (r: TenantRow): Tenant => ({
  id: r.id, unitId: r.unit_id, name: r.name, phone: r.phone, moveInOn: r.move_in_on, movedOutOn: r.moved_out_on,
  monthlyRent: Number(r.monthly_rent), monthlyUtilities: Number(r.monthly_utilities), note: r.note,
});
const toPayment = (r: PaymentRow): Payment => ({
  id: r.id, billId: r.bill_id, amount: Number(r.amount), paidOn: r.paid_on, method: r.method, note: r.note, clientRequestId: r.client_request_id,
});
const toBill = (r: BillRow): Bill => ({
  id: r.id, tenantId: r.tenant_id, unitId: r.unit_id, periodStart: r.period_start, periodEnd: r.period_end,
  baseRent: Number(r.base_rent), utilitiesTotal: Number(r.utilities_total), totalDue: Number(r.total_due), note: r.note,
});
const toBillSummary = (r: BillSummaryRow, unitName: string, tenantName: string): BillSummary => ({
  ...toBill(r), paidAmount: Number(r.paid_amount), balance: Number(r.balance), status: r.status, unitName, tenantName,
});

const trimmed = (s: string | null | undefined) => (s ?? '').trim();
const nullIfBlank = (s: string | null | undefined) => (trimmed(s) === '' ? null : trimmed(s));
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });

export function createSupabaseLayer(client: SupabaseClient): DataLayer {
  async function uid(): Promise<string> {
    const { data, error } = await client.auth.getSession();
    if (error) throw mapError(error);
    if (!data.session) throw new DataError('not_found', 'not signed in');
    return data.session.user.id;
  }

  async function getProfileRow(): Promise<ProfileRow> {
    const id = await uid();
    return unwrap<ProfileRow>(await client.from('profiles').select('*').eq('id', id).single());
  }

  async function setPrimary(propertyId: Id | null): Promise<void> {
    const id = await uid();
    unwrap(await client.from('profiles').update({ primary_property_id: propertyId }).eq('id', id));
  }

  async function unitIdsOf(propertyId: Id): Promise<Array<{ id: string; name: string }>> {
    return unwrap<Array<{ id: string; name: string }>>(await client.from('units').select('id, name').eq('property_id', propertyId)) ?? [];
  }

  const layer: DataLayer = {
    // ---- auth (routes 1-3) ----------------------------------------------------------------------
    async sendCode(email) {
      const { error } = await client.auth.signInWithOtp({ email: trimmed(email), options: { shouldCreateUser: true } });
      if (error) {
        if (error.status === 429 || /rate limit/i.test(error.message)) throw new DataError('rate_limited', error.message);
        if ((error.status ?? 0) >= 500 || /error sending|smtp/i.test(error.message)) throw new DataError('send_failed', error.message);
        if (error.status === 400 || /invalid/i.test(error.message)) throw new DataError('invalid', 'email');
        throw mapError(error);
      }
    },
    async verifyCode(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email: trimmed(email), token: trimmed(code), type: 'email' });
      if (error || !data.session) {
        if (error && NETWORK.test(error.message)) throw mapError(error);
        throw new DataError('bad_code', error?.message);
      }
      return { userId: data.session.user.id, email: data.session.user.email ?? trimmed(email) } satisfies Session;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error && !/session/i.test(error.message)) throw mapError(error);
    },
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw mapError(error);
      return data.session ? { userId: data.session.user.id, email: data.session.user.email ?? '' } : null;
    },

    // ---- profile (4-5) -------------------------------------------------------------------------
    async getProfile() {
      return toProfile(await getProfileRow());
    },
    async updateProfile(patch) {
      const id = await uid();
      const row: Record<string, unknown> = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.language !== undefined) row.language = patch.language;
      if (patch.reminderDaysBefore !== undefined) row.reminder_days_before = patch.reminderDaysBefore;
      if (patch.primaryPropertyId !== undefined) row.primary_property_id = patch.primaryPropertyId;
      return toProfile(unwrap<ProfileRow>(await client.from('profiles').update(row).eq('id', id).select().single()));
    },

    // ---- properties (6-8) ----------------------------------------------------------------------
    async listProperties() {
      const rows = unwrap<PropertyRow[]>(await client.from('properties').select('*').is('archived_at', null).order('created_at'));
      return (rows ?? []).map(toProperty);
    },
    async getProperty(id) {
      return toProperty(unwrap<PropertyRow>(await client.from('properties').select('*').eq('id', id).single()));
    },
    async createProperty({ name, address, makePrimary }) {
      const row = unwrap<PropertyRow>(await client.from('properties').insert({ name: trimmed(name), address: nullIfBlank(address) }).select().single());
      const profile = await getProfileRow();
      if (makePrimary || profile.primary_property_id === null) await setPrimary(row.id);
      return toProperty(row);
    },
    async updateProperty(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = trimmed(patch.name);
      if (patch.address !== undefined) row.address = nullIfBlank(patch.address);
      if (patch.archived !== undefined) row.archived_at = patch.archived ? new Date().toISOString() : null;
      const updated = Object.keys(row).length
        ? unwrap<PropertyRow>(await client.from('properties').update(row).eq('id', id).select().single())
        : unwrap<PropertyRow>(await client.from('properties').select('*').eq('id', id).single());
      if (patch.makePrimary) await setPrimary(id);
      if (updated.archived_at) {
        const profile = await getProfileRow();
        if (profile.primary_property_id === id) {
          const others = unwrap<PropertyRow[]>(await client.from('properties').select('*').is('archived_at', null).neq('id', id).order('created_at').limit(1));
          await setPrimary(others?.[0]?.id ?? null);
        }
      }
      return toProperty(updated);
    },

    // ---- units (9-11) --------------------------------------------------------------------------
    async listUnits(propertyId) {
      const rows = unwrap<Array<UnitRow & { tenants: TenantRow[] }>>(
        await client.from('units').select('*, tenants(*)').eq('property_id', propertyId).is('archived_at', null),
      );
      return (rows ?? [])
        .map((r): UnitWithTenant => {
          const current = (r.tenants ?? []).find((t) => t.moved_out_on === null);
          return { ...toUnit(r), currentTenant: current ? toTenant(current) : null };
        })
        .sort(byName);
    },
    async getUnit(id) {
      return toUnit(unwrap<UnitRow>(await client.from('units').select('*').eq('id', id).single()));
    },
    async createUnit({ propertyId, name, floor, defaultRent }) {
      return toUnit(
        unwrap<UnitRow>(
          await client.from('units').insert({ property_id: propertyId, name: trimmed(name), floor: nullIfBlank(floor), default_rent: defaultRent }).select().single(),
        ),
      );
    },
    async updateUnit(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = trimmed(patch.name);
      if (patch.floor !== undefined) row.floor = nullIfBlank(patch.floor);
      if (patch.defaultRent !== undefined) row.default_rent = patch.defaultRent;
      if (patch.archived !== undefined) row.archived_at = patch.archived ? new Date().toISOString() : null;
      return toUnit(unwrap<UnitRow>(await client.from('units').update(row).eq('id', id).select().single()));
    },

    // ---- tenants (12-14) -----------------------------------------------------------------------
    async listTenants(propertyId, opts) {
      let q = client.from('tenants').select('*, units!inner(name, property_id)').eq('units.property_id', propertyId);
      if (!opts?.includePast) q = q.is('moved_out_on', null);
      const rows = unwrap<Array<TenantRow & { units: { name: string } }>>(await q);
      return (rows ?? [])
        .map((r): TenantWithUnit => ({ ...toTenant(r), unitName: r.units.name }))
        .sort((a, b) => a.unitName.localeCompare(b.unitName, undefined, { numeric: true }));
    },
    async getTenant(id) {
      const r = unwrap<TenantRow & { units: { name: string } }>(await client.from('tenants').select('*, units(name)').eq('id', id).single());
      return { ...toTenant(r), unitName: r.units?.name ?? '' };
    },
    async createTenant(input) {
      return toTenant(
        unwrap<TenantRow>(
          await client
            .from('tenants')
            .insert({
              unit_id: input.unitId, name: trimmed(input.name), phone: nullIfBlank(input.phone), move_in_on: input.moveInOn,
              monthly_rent: input.monthlyRent, monthly_utilities: input.monthlyUtilities, note: nullIfBlank(input.note),
            })
            .select()
            .single(),
        ),
      );
    },
    async updateTenant(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = trimmed(patch.name);
      if (patch.phone !== undefined) row.phone = nullIfBlank(patch.phone);
      if (patch.note !== undefined) row.note = nullIfBlank(patch.note);
      if (patch.moveInOn !== undefined) row.move_in_on = patch.moveInOn;
      if (patch.movedOutOn !== undefined) row.moved_out_on = patch.movedOutOn;
      if (patch.monthlyRent !== undefined) row.monthly_rent = patch.monthlyRent;
      if (patch.monthlyUtilities !== undefined) row.monthly_utilities = patch.monthlyUtilities;
      return toTenant(unwrap<TenantRow>(await client.from('tenants').update(row).eq('id', id).select().single()));
    },

    // ---- bills (15-19) -------------------------------------------------------------------------
    async createBills(propertyId, periodStart, periodEnd) {
      const rows = unwrap<Array<{ created_count: number; skipped_count: number }>>(
        await client.rpc('create_bills', { p_property_id: propertyId, p_period_start: periodStart, p_period_end: periodEnd }),
      );
      const r = rows?.[0];
      return { created: Number(r?.created_count ?? 0), skipped: Number(r?.skipped_count ?? 0) };
    },
    async monthsWithBills(propertyId, year) {
      const rows = unwrap<Array<{ period_start: string }>>(
        await client
          .from('bills')
          .select('period_start, units!inner(property_id)')
          .eq('units.property_id', propertyId)
          .gte('period_start', `${year}-01-01`)
          .lte('period_start', `${year}-12-31`),
      );
      return [...new Set((rows ?? []).map((r) => parseMonthKey(r.period_start.slice(0, 7)).monthIndex))].sort((a, b) => a - b);
    },
    async listBills(f: BillFilter) {
      const units = await unitIdsOf(f.propertyId);
      if (units.length === 0) return [];
      const ids = units.map((u) => u.id);
      const { year, monthIndex } = parseMonthKey(f.month);
      const { start, end } = monthBounds(year, monthIndex);
      let q = client.from('bill_summary').select('*').in('unit_id', ids).gte('period_start', start).lte('period_start', end);
      if (f.status) q = q.eq('status', f.status);
      if (f.tenantId) q = q.eq('tenant_id', f.tenantId);
      const rows = unwrap<BillSummaryRow[]>(await q) ?? [];
      const tenants = unwrap<Array<{ id: string; name: string }>>(await client.from('tenants').select('id, name').in('unit_id', ids)) ?? [];
      const unitName = new Map(units.map((u) => [u.id, u.name]));
      const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
      return rows
        .map((r) => toBillSummary(r, unitName.get(r.unit_id) ?? '', tenantName.get(r.tenant_id) ?? ''))
        .sort((a, b) => a.unitName.localeCompare(b.unitName, undefined, { numeric: true }));
    },
    async getBill(id): Promise<BillDetail> {
      const row = unwrap<BillSummaryRow>(await client.from('bill_summary').select('*').eq('id', id).single());
      const unit = unwrap<{ name: string; properties: { name: string } | null }>(await client.from('units').select('name, properties(name)').eq('id', row.unit_id).single());
      const tenant = unwrap<{ name: string }>(await client.from('tenants').select('name').eq('id', row.tenant_id).single());
      const payments = unwrap<PaymentRow[]>(await client.from('payments').select('*').eq('bill_id', id).order('paid_on').order('created_at')) ?? [];
      return { bill: toBillSummary(row, unit.name, tenant.name), payments: payments.map(toPayment), propertyName: unit.properties?.name ?? '' };
    },
    async updateBill(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.baseRent !== undefined) row.base_rent = patch.baseRent;
      if (patch.utilitiesTotal !== undefined) row.utilities_total = patch.utilitiesTotal;
      if (patch.note !== undefined) row.note = nullIfBlank(patch.note);
      unwrap(await client.from('bills').update(row).eq('id', id));
      return (await layer.getBill(id)).bill;
    },
    async deleteBill(id) {
      const rows = unwrap<Array<{ id: string }>>(await client.from('bills').delete().eq('id', id).select('id'), { deleting: true });
      if (!rows || rows.length === 0) throw new DataError('not_found');
    },

    // ---- payments (20-22) ----------------------------------------------------------------------
    async recordPayment(input: NewPayment) {
      const payload = {
        bill_id: input.billId, amount: input.amount, paid_on: input.paidOn, method: input.method,
        note: nullIfBlank(input.note), client_request_id: input.clientRequestId,
      };
      // ON CONFLICT DO NOTHING on (user_id, client_request_id): a retry of a request that already succeeded inserts nothing,
      // and we then read back the payment it created. No error, no duplicate.
      const inserted = unwrap<PaymentRow[]>(
        await client.from('payments').upsert(payload, { onConflict: 'user_id,client_request_id', ignoreDuplicates: true }).select(),
      );
      if (inserted && inserted.length > 0) return toPayment(inserted[0]);
      return toPayment(unwrap<PaymentRow>(await client.from('payments').select('*').eq('client_request_id', input.clientRequestId).single()));
    },
    async deletePayment(id) {
      const rows = unwrap<Array<{ id: string }>>(await client.from('payments').delete().eq('id', id).select('id'));
      if (!rows || rows.length === 0) throw new DataError('not_found');
    },

    // ---- reports (33) --------------------------------------------------------------------------
    async monthSummary(propertyId, month): Promise<MonthSummary> {
      const rows = unwrap<
        Array<{
          collected_amount: number; billed_amount: number; due_amount: number; expense_amount: number;
          paid_bills: number; unpaid_bills: number; outstanding_amount: number; outstanding_bills: number;
        }>
      >(await client.rpc('month_summary', { p_property_id: propertyId, p_month: `${month}-01` }));
      const r = rows?.[0];
      return {
        collectedAmount: Number(r?.collected_amount ?? 0), billedAmount: Number(r?.billed_amount ?? 0),
        dueAmount: Number(r?.due_amount ?? 0), expenseAmount: Number(r?.expense_amount ?? 0),
        paidBills: Number(r?.paid_bills ?? 0), unpaidBills: Number(r?.unpaid_bills ?? 0),
        outstandingAmount: Number(r?.outstanding_amount ?? 0), outstandingBills: Number(r?.outstanding_bills ?? 0),
      };
    },

    // ---- account (35) --------------------------------------------------------------------------
    async deleteAccount() {
      const { error } = await client.functions.invoke('delete-account');
      if (error) throw new DataError('network', error.message);
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
    },
  };
  return layer;
}
