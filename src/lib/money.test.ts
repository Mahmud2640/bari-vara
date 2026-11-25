import { formatMoney, parseMoneyInput, moneyToInput } from './money.ts';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ` got ${String(got)} want ${String(want)}`));
};

eq('en small', formatMoney(180000, 'en'), '৳1,800');
eq('en lakh grouping', formatMoney(24500000, 'en'), '৳2,45,000');
eq('bn digits', formatMoney(180000, 'bn'), '৳১,৮০০');
eq('fraction', formatMoney(180050, 'en'), '৳1,800.50');
eq('zero', formatMoney(0, 'en'), '৳0');
eq('negative', formatMoney(-5000, 'en'), '-৳50');
eq('no sign', formatMoney(100, 'en', { sign: false }), '1');
eq('parse latin', parseMoneyInput('1800'), 180000);
eq('parse bangla with comma', parseMoneyInput('১,৮০০.৫০'), 180050);
eq('parse one decimal', parseMoneyInput('12.5'), 1250);
eq('parse rejects text', parseMoneyInput('abc'), null);
eq('parse rejects 3 decimals', parseMoneyInput('1.234'), null);
eq('parse rejects empty', parseMoneyInput(''), null);
eq('parse taka sign and spaces', parseMoneyInput(' ৳ 2 500 '), 250000);

eq('moneyToInput en', moneyToInput(180050, 'en'), '1800.50');
eq('moneyToInput bn', moneyToInput(1800000, 'bn'), '১৮০০০');
eq('moneyToInput round trip', parseMoneyInput(moneyToInput(1800000, 'bn')), 1800000);

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
