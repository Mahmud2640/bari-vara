// Money is always an integer number of poisha (1 taka = 100 poisha). Never a float.
// One place formats it and one place parses it. No component formats a number by itself.

export type Lang = 'bn' | 'en';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function toBanglaDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export function toLatinDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

// Bangladeshi grouping: 2,45,000 (last three digits, then pairs)
function group(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return rest + ',' + last3;
}

export function formatMoney(poisha: number, lang: Lang = 'bn', opts: { sign?: boolean } = {}): string {
  const negative = poisha < 0;
  const abs = Math.abs(Math.round(poisha));
  const taka = Math.floor(abs / 100);
  const fraction = abs % 100;
  let out = group(String(taka));
  if (fraction !== 0) out += '.' + String(fraction).padStart(2, '0');
  if (lang === 'bn') out = toBanglaDigits(out);
  return (negative ? '-' : '') + (opts.sign === false ? '' : '৳') + out;
}

// Reads what a person typed ("১,৮০০.৫০", "1800", " 1 800 ") into poisha, or null if it is not a valid amount.
export function parseMoneyInput(text: string): number | null {
  const s = toLatinDigits(text).replace(/[,\s৳]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [t, f = ''] = s.split('.');
  return Number(t) * 100 + Number(f.padEnd(2, '0'));
}

// An amount as it should appear inside an edit field: plain digits, no ৳, no grouping commas.
export function moneyToInput(poisha: number, lang: Lang = 'bn'): string {
  const taka = Math.floor(Math.abs(poisha) / 100);
  const fraction = Math.abs(poisha) % 100;
  let s = String(taka);
  if (fraction !== 0) s += '.' + String(fraction).padStart(2, '0');
  return lang === 'bn' ? toBanglaDigits(s) : s;
}
