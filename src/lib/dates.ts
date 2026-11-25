// Dates are 'YYYY-MM-DD' strings in the user's own calendar (Dhaka). No time zone maths, so a payment made on the
// 31st can never slip into the next month.
import type { Lang } from './money';
import { toBanglaDigits, toLatinDigits } from './money';

const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${pad(monthIndex + 1)}`;
}

export function parseMonthKey(key: string): { year: number; monthIndex: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, monthIndex: m - 1 };
}

export function shiftMonth(key: string, delta: number): string {
  const { year, monthIndex } = parseMonthKey(key);
  const d = new Date(year, monthIndex + delta, 1);
  return monthKey(d.getFullYear(), d.getMonth());
}

export function monthBounds(year: number, monthIndex: number): { start: string; end: string } {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return { start: `${year}-${pad(monthIndex + 1)}-01`, end: `${year}-${pad(monthIndex + 1)}-${pad(last)}` };
}

export function isValidISO(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

// Accepts Bangla digits and "/" or "." separators from a text field; returns ISO or null.
export function parseDateInput(text: string): string | null {
  const s = toLatinDigits(text.trim()).replace(/[/.]/g, '-');
  return isValidISO(s) ? s : null;
}

export const MONTHS: Record<Lang, string[]> = {
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const num = (n: number | string, lang: Lang) => (lang === 'bn' ? toBanglaDigits(String(n)) : String(n));

export function monthLabel(key: string, lang: Lang): string {
  const { year, monthIndex } = parseMonthKey(key);
  return `${MONTHS[lang][monthIndex]} ${num(year, lang)}`;
}

export function formatDate(iso: string, lang: Lang): string {
  if (!isValidISO(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return `${num(d, lang)} ${MONTHS[lang][m - 1]} ${num(y, lang)}`;
}

export function formatRange(start: string, end: string, lang: Lang): string {
  return `${formatDate(start, lang)} – ${formatDate(end, lang)}`;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd; // ISO strings compare correctly
}

export function localiseNumber(n: number | string, lang: Lang): string {
  return num(n, lang);
}
