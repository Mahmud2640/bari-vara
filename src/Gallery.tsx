import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Building2, Calendar, FileText, LifeBuoy, Plus, Receipt, Users, Wallet } from 'lucide-react-native';
import { color, layout, radius, space } from './design/tokens';
import { useLang, useSetLang } from './lib/lang';
import { toBanglaDigits } from './lib/money';
import { Text } from './components/Text';
import { Button } from './components/Button';
import { TextField, ToggleRow, SearchField } from './components/Form';
import { Chip, ChipRow, MonthGrid } from './components/Chips';
import { Card, StatCard, QuickTile, SummaryTile } from './components/Card';
import { BillCard, PropertyRow, StatusLabel } from './components/Bills';
import { AppBar, BellButton, BottomNav, EmptyState, SheetPanel, Toast, Tab } from './components/Chrome';
import { Money } from './components/Money';

const S = {
  bn: {
    title: 'ডিজাইন সিস্টেম', pick: 'ভাষা', buttons: 'বাটন', fields: 'ফর্ম ফিল্ড', chips: 'চিপ ও মাস নির্বাচন', home: 'হোম স্ক্রিন',
    properties: 'সম্পত্তি', bills: 'বিল কার্ড', sheet: 'পেমেন্ট শিট', states: 'খালি অবস্থা ও বার্তা', nav: 'নিচের নেভিগেশন',
    save: 'সংরক্ষণ করুন', cancel: 'বাতিল', download: 'রশিদ ডাউনলোড', remove: 'মুছে ফেলুন', loading: 'লোড হচ্ছে', disabled: 'নিষ্ক্রিয়',
    amount: 'পরিশোধের পরিমাণ', amountHelp: 'টাকায় লিখুন, যেমন ১,৮০০', date: 'পরিশোধের তারিখ', note: 'নোট', method: 'মাধ্যম',
    badAmount: 'বিলের মোট প্রদেয়র চেয়ে বেশি লেখা যাবে না', partial: 'আংশিক পরিশোধ', partialDesc: 'পুরো ভাড়া না পেলে এটি চালু করুন',
    all: 'সব', paid: 'পরিশোধিত', due: 'বকেয়া', part: 'আংশিক', partLabel: 'আংশিক পরিশোধ', billsExist: 'এই মাসের বিল আছে',
    months: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
    collected: 'এই মাসে আদায়', dueCap: 'বকেয়া', paidNote: '২ জন ভাড়াটিয়া পরিশোধ করেছেন', noDues: 'কোনো বকেয়া নেই',
    tiles: ['ভাড়াটিয়া', 'ফ্ল্যাট ও রুম', 'বিল তৈরি', 'সব বিল', 'খরচ', 'মিটিং', 'সহায়তা'],
    primary: 'প্রধান', edit: 'সম্পাদনা', back: 'ফিরে যান', menu: 'আরও', select: 'নির্বাচন',
    lb: { status: 'অবস্থা', baseRent: 'মূল ভাড়া', utilities: 'ইউটিলিটি', totalDue: 'মোট প্রদেয়', paid: 'পরিশোধ', balance: 'বাকি' },
    emptyTitle: 'এই মাসে এখনও কোনো বিল নেই', emptyBody: 'বিল তৈরি করলে প্রতিটি ভাড়াটিয়ার জন্য একটি করে বিল এখানে দেখা যাবে।', create: 'বিল তৈরি করুন',
    toast: '১২টি বিল তৈরি হয়েছে, ৩টি আগে থেকেই ছিল', undo: 'পূর্বাবস্থায়', err: 'সংযোগ নেই। পেমেন্ট সংরক্ষণ হয়নি।',
    tabs: { home: 'হোম', reports: 'রিপোর্ট', profile: 'প্রোফাইল' }, search: 'ফ্ল্যাট বা রুমের নাম খুঁজুন', clear: 'মুছুন',
    upcoming: 'আসন্ন', total: 'মোট', completed: 'সম্পন্ন', year: (y: number) => toBanglaDigits(String(y)),
    flatA: 'ফ্ল্যাট ৪সি', tenantA: 'এমরান আজিজ', allBills: 'সব বিল', prop: ['গ্যালাক্সি ম্যানশন', 'বাড়ি ৪৫, রোড ১৩, ধানমন্ডি, ঢাকা'], prop2: ['ওয়ান্ডারলি', 'বসুন্ধরা, ঢাকা'],
  },
  en: {
    title: 'Design system', pick: 'Language', buttons: 'Buttons', fields: 'Form fields', chips: 'Chips and month picker', home: 'Home screen',
    properties: 'Properties', bills: 'Bill cards', sheet: 'Payment sheet', states: 'Empty states and messages', nav: 'Bottom navigation',
    save: 'Save', cancel: 'Cancel', download: 'Download receipt', remove: 'Delete', loading: 'Loading', disabled: 'Disabled',
    amount: 'Amount paid', amountHelp: 'In taka, for example 1,800', date: 'Payment date', note: 'Note', method: 'Method',
    badAmount: 'Cannot be more than the total due on the bill', partial: 'Partial payment', partialDesc: 'Turn on if the full rent was not received',
    all: 'All', paid: 'Paid', due: 'Due', part: 'Partial', partLabel: 'Partly paid', billsExist: 'bills already exist',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    collected: 'Collected this month', dueCap: 'Due', paidNote: '2 tenants paid', noDues: 'No dues',
    tiles: ['Tenants', 'Flats and rooms', 'Create bills', 'All bills', 'Expenses', 'Meetings', 'Support'],
    primary: 'Primary', edit: 'Edit', back: 'Go back', menu: 'More', select: 'Select',
    lb: { status: 'Status', baseRent: 'Base rent', utilities: 'Utilities', totalDue: 'Total due', paid: 'Paid', balance: 'Balance' },
    emptyTitle: 'No bills this month yet', emptyBody: 'Create bills and each tenant gets one, listed here.', create: 'Create bills',
    toast: '12 bills created, 3 already existed', undo: 'Undo', err: 'No connection. The payment was not saved.',
    tabs: { home: 'Home', reports: 'Reports', profile: 'Profile' }, search: 'Search flat or room name', clear: 'Clear',
    upcoming: 'Upcoming', total: 'Total', completed: 'Completed', year: (y: number) => String(y),
    flatA: 'Flat 4C', tenantA: 'Emran Aziz', allBills: 'All bills', prop: ['Galaxy Mansion', 'House 45, Road 13, Dhanmondi, Dhaka'], prop2: ['Wanderley', 'Bashundhara, Dhaka'],
  },
} as const;

export function Gallery() {
  const lang = useLang();
  const setLang = useSetLang();
  const t = S[lang];
  const [partial, setPartial] = useState(true);
  const [month, setMonth] = useState(8);
  const [year, setYear] = useState(2026);
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(true);
  const [tab, setTab] = useState<Tab>('home');
  const [q, setQ] = useState('');
  const lb = t.lb;

  return (
    <>
      <ScrollView style={{ backgroundColor: color.bg }} contentContainerStyle={styles.page}>
        <View style={styles.col}>
          <Text variant="display" accessibilityRole="header">{t.title}</Text>
          <View style={{ marginTop: space[3] }}>
            <ChipRow>
              <Chip label="বাংলা" selected={lang === 'bn'} onPress={() => setLang('bn')} />
              <Chip label="English" selected={lang === 'en'} onPress={() => setLang('en')} />
            </ChipRow>
          </View>

          <H>{t.buttons}</H>
          <View style={{ gap: space[2] }}>
            <Button label={t.save} />
            <Button label={t.cancel} variant="secondary" />
            <Button label={t.download} variant="ghost" />
            <Button label={t.remove} variant="danger" />
            <Button label={t.loading} loading />
            <Button label={t.disabled} disabled />
            <Button label={t.save} size="sm" fullWidth={false} />
          </View>

          <H>{t.fields}</H>
          <View style={{ gap: space[4] }}>
            <TextField label={t.amount} helper={t.amountHelp} placeholder="৳" keyboardType="decimal-pad" />
            <TextField label={t.amount} error={t.badAmount} defaultValue={lang === 'bn' ? '৩,০০০' : '3,000'} />
            <TextField label={t.note} multiline defaultValue="" />
            <TextField label={t.disabled} disabled defaultValue="—" />
            <ToggleRow label={t.partial} description={t.partialDesc} value={partial} onValueChange={setPartial} />
            <SearchField value={q} onChangeText={setQ} placeholder={t.search} clearLabel={t.clear} />
          </View>

          <H>{t.chips}</H>
          <ChipRow>
            {[2026, 2025, 2024, 2023].map((y) => (
              <Chip key={y} label={t.year(y)} selected={y === year} onPress={() => setYear(y)} />
            ))}
          </ChipRow>
          <View style={{ height: space[3]  }} />
          <MonthGrid months={[...t.months]} selected={month} hasBills={[0, 1, 7]} onSelect={setMonth} billsExistLabel={t.billsExist} />
          <View style={{ height: space[3] }} />
          <ChipRow>
            {([['all', t.all], ['paid', t.paid], ['due', t.due], ['partial', t.part]] as const).map(([k, l]) => (
              <Chip key={k} label={l} selected={filter === k} onPress={() => setFilter(k)} />
            ))}
          </ChipRow>

          <H>{t.home}</H>
          <View style={styles.phone}>
            <View style={styles.homeHead}>
              <View style={styles.switcher}>
                <Building2 size={20} color={color.onAccent} />
                <View style={{ marginLeft: space[2], flex: 1 }}>
                  <Text variant="sm" weight="700" tone="onAccent">{t.prop[0]}</Text>
                  <Text variant="xs" tone="onAccentMuted" numberOfLines={1}>{t.prop[1]}</Text>
                </View>
              </View>
              <BellButton label={lang === 'bn' ? 'বিজ্ঞপ্তি' : 'Notifications'} count={2} />
            </View>
            <View style={styles.statRow}>
              <StatCard caption={t.collected} poisha={1700000} note={t.paidNote} />
              <View style={{ width: space[3] }} />
              <StatCard caption={t.dueCap} poisha={0} note={t.noDues} />
            </View>
            <View style={styles.tileGrid}>
              {[Users, Building2, Plus, Receipt, Wallet, Calendar, LifeBuoy].map((Icon, i) => (
                <View key={i} style={styles.tileWrap}>
                  <QuickTile label={t.tiles[i]} icon={<Icon size={20} color={color.accent} />} badge={i === 3 ? 3 : undefined} />
                </View>
              ))}
            </View>
          </View>

          <H>{t.properties}</H>
          <View style={{ gap: space[2] }}>
            <PropertyRow name={t.prop[0]} address={t.prop[1]} primary primaryLabel={t.primary} editLabel={t.edit} />
            <PropertyRow name={t.prop2[0]} address={t.prop2[1]} primaryLabel={t.primary} editLabel={t.edit} />
          </View>

          <H>{t.bills}</H>
          <View style={{ gap: space[3] }}>
            <BillCard flat={t.flatA} tenant={t.tenantA} status="due" statusLabel={t.due} baseRent={180000} utilities={60000} labels={{ ...lb, menu: t.menu, select: t.select }} />
            <BillCard flat={t.flatA} tenant={t.tenantA} status="partial" statusLabel={t.partLabel} baseRent={180000} utilities={60000} paid={100000} labels={{ ...lb, menu: t.menu, select: t.select }} selected={sel} onToggleSelect={() => setSel(!sel)} />
            <BillCard flat={t.flatA} tenant={t.tenantA} status="paid" statusLabel={t.paid} baseRent={180000} utilities={60000} paid={240000} labels={{ ...lb, menu: t.menu, select: t.select }} />
          </View>
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
            <StatusLabel status="due" label={t.due} />
            <StatusLabel status="partial" label={t.partLabel} />
            <StatusLabel status="paid" label={t.paid} />
          </View>

          <H>{t.sheet}</H>
          <View style={styles.sheetBack}>
            <SheetPanel title={t.partial}>
              <View style={{ gap: space[3] }}>
                <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="sm" tone="textMuted">{lb.totalDue}</Text>
                  <Money poisha={240000} variant="base" weight="700" />
                </Card>
                <TextField label={t.amount} helper={t.amountHelp} keyboardType="decimal-pad" />
                <TextField label={t.date} placeholder="YYYY-MM-DD" />
                <TextField label={t.method} defaultValue={lang === 'bn' ? 'নগদ' : 'Nagad'} />
                <TextField label={t.note} />
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <View style={{ flex: 1 }}><Button label={t.cancel} variant="secondary" /></View>
                  <View style={{ flex: 1 }}><Button label={t.save} /></View>
                </View>
              </View>
            </SheetPanel>
          </View>

          <H>{t.states}</H>
          <Card><EmptyState icon={<FileText size={32} color={color.textMuted} />} title={t.emptyTitle} body={t.emptyBody} actionLabel={t.create} /></Card>
          <View style={{ gap: space[2], marginTop: space[3] }}>
            <Toast message={t.toast} tone="success" actionLabel={t.undo} />
            <Toast message={t.err} tone="error" />
          </View>
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
            <SummaryTile label={t.upcoming} value={2} highlighted />
            <SummaryTile label={t.total} value={5} />
            <SummaryTile label={t.completed} value={2} />
          </View>

          <H>{t.nav}</H>
          <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: color.border }}>
            <AppBar title={t.allBills} backLabel={t.back} onBack={() => {}} right={<BellButton label={lang === 'bn' ? 'বিজ্ঞপ্তি' : 'Notifications'} />} />
            <BottomNav active={tab} labels={t.tabs} onChange={setTab} />
          </View>
          <View style={{ height: space[8] }} />
        </View>
      </ScrollView>
    </>
  );
}

function H({ children }: { children: string }) {
  return (
    <Text variant="lg" accessibilityRole="header" style={{ marginTop: space[8], marginBottom: space[3] }}>
      {children}
    </Text>
  );
}

// space[8] is the largest step in the scale (48)
const styles = StyleSheet.create({
  page: { alignItems: 'center', paddingHorizontal: layout.gutter },
  col: { width: '100%', maxWidth: layout.maxContentWidth, paddingTop: space[6] },
  phone: { backgroundColor: color.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, padding: space[3] },
  homeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space[3] },
  switcher: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: color.accentStrong, borderRadius: radius.md, padding: space[3], marginRight: space[2] },
  statRow: { flexDirection: 'row' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space[3], marginHorizontal: -space[1] },
  tileWrap: { width: '33.333%', padding: space[1] },
  // dark scrim behind the sheet, as it appears over a screen
  sheetBack: { backgroundColor: color.ink, borderRadius: radius.lg, paddingTop: space[6] },
});
