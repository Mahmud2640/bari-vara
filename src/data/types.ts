// Types shared by the fake data layer now and the Supabase layer later. Money is integer poisha.
// Dates are plain 'YYYY-MM-DD' strings (no time zone); only timestamps are ISO strings.

import type { Lang } from '../lib/money';

export type Id = string;
export type { Lang };

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'bkash' | 'nagad' | 'rocket' | 'cheque' | 'other';
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'bank', 'card', 'bkash', 'nagad', 'rocket', 'cheque', 'other'];

export type BillStatus = 'due' | 'partial' | 'paid';

export interface Session {
  userId: Id;
  email: string;
}

export interface Profile {
  id: Id;
  displayName: string | null;
  language: Lang;
  reminderDaysBefore: number;
  primaryPropertyId: Id | null;
}

export interface Property {
  id: Id;
  name: string;
  address: string | null;
  archivedAt: string | null;
}

export interface Unit {
  id: Id;
  propertyId: Id;
  name: string;
  floor: string | null;
  defaultRent: number;
  archivedAt: string | null;
}

export interface UnitWithTenant extends Unit {
  currentTenant: Tenant | null;
}

export interface Tenant {
  id: Id;
  unitId: Id;
  name: string;
  phone: string | null;
  moveInOn: string;
  movedOutOn: string | null;
  monthlyRent: number;
  monthlyUtilities: number;
  note: string | null;
}

export interface TenantWithUnit extends Tenant {
  unitName: string;
}

export interface Bill {
  id: Id;
  tenantId: Id;
  unitId: Id;
  periodStart: string;
  periodEnd: string;
  baseRent: number;
  utilitiesTotal: number;
  totalDue: number;
  note: string | null;
}

export interface BillSummary extends Bill {
  paidAmount: number;
  balance: number;
  status: BillStatus;
  tenantName: string;
  unitName: string;
}

export interface Payment {
  id: Id;
  billId: Id;
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  note: string | null;
  clientRequestId: string | null;
}

export interface BillDetail {
  bill: BillSummary;
  payments: Payment[];
  propertyName: string;
}

export interface MonthSummary {
  collectedAmount: number;
  billedAmount: number;
  dueAmount: number;
  expenseAmount: number;
  paidBills: number;
  unpaidBills: number;
  // everything still unpaid on the property, whatever month it was billed (the home "Due" card)
  outstandingAmount: number;
  outstandingBills: number;
}

// Codes mirror the database errors in replica/schema.sql so the real layer can raise the same ones.
export type ErrorCode =
  | 'invalid'            // a field is empty or malformed
  | 'bad_code'           // wrong or expired login code
  | 'over_payment'       // payment exceeds the amount due (schema: payments_not_over)
  | 'below_paid'         // bill total edited below what was paid (schema: bills_not_below_paid)
  | 'has_payments'       // a bill with payments cannot be deleted (schema: no action)
  | 'unit_occupied'      // a flat has one current tenant (schema: tenants_one_active_per_unit)
  | 'duplicate_unit'     // unit name unique within a property
  | 'bad_dates'          // move-out before move-in, period end before start
  | 'not_found'
  | 'rate_limited'       // too many login codes asked for
  | 'network';

export class DataError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'DataError';
  }
}

export interface BillFilter {
  propertyId: Id;
  month: string; // 'YYYY-MM'
  status?: BillStatus;
  tenantId?: Id;
}

export interface NewPayment {
  billId: Id;
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  note?: string | null;
  clientRequestId: string;
}

// One function per route in replica/architecture.md. The fake and the Supabase layers both implement it.
export interface DataLayer {
  // auth (routes 1-3)
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  // profile (4-5)
  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile>;
  // properties (6-8)
  listProperties(): Promise<Property[]>;
  getProperty(id: Id): Promise<Property>;
  createProperty(input: { name: string; address?: string | null; makePrimary?: boolean }): Promise<Property>;
  updateProperty(id: Id, patch: { name?: string; address?: string | null; archived?: boolean; makePrimary?: boolean }): Promise<Property>;
  // units (9-11)
  listUnits(propertyId: Id): Promise<UnitWithTenant[]>;
  getUnit(id: Id): Promise<Unit>;
  createUnit(input: { propertyId: Id; name: string; floor?: string | null; defaultRent: number }): Promise<Unit>;
  updateUnit(id: Id, patch: { name?: string; floor?: string | null; defaultRent?: number; archived?: boolean }): Promise<Unit>;
  // tenants (12-14)
  listTenants(propertyId: Id, opts?: { includePast?: boolean }): Promise<TenantWithUnit[]>;
  getTenant(id: Id): Promise<TenantWithUnit>;
  createTenant(input: Omit<Tenant, 'id' | 'movedOutOn'>): Promise<Tenant>;
  updateTenant(id: Id, patch: Partial<Omit<Tenant, 'id' | 'unitId'>>): Promise<Tenant>;
  // bills (15-19)
  createBills(propertyId: Id, periodStart: string, periodEnd: string): Promise<{ created: number; skipped: number }>;
  monthsWithBills(propertyId: Id, year: number): Promise<number[]>;
  listBills(filter: BillFilter): Promise<BillSummary[]>;
  getBill(id: Id): Promise<BillDetail>;
  updateBill(id: Id, patch: { baseRent?: number; utilitiesTotal?: number; note?: string | null }): Promise<BillSummary>;
  deleteBill(id: Id): Promise<void>;
  // payments (20-22)
  recordPayment(input: NewPayment): Promise<Payment>;
  deletePayment(id: Id): Promise<void>;
  // reports (33)
  monthSummary(propertyId: Id, month: string): Promise<MonthSummary>;
  // account (route 35): deletes the signed-in account and everything it owns
  deleteAccount(): Promise<void>;
  // only the fake layer has this
  loadSampleData?(): Promise<void>;
}
