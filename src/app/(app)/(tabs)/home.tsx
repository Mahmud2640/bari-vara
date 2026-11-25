import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Building2, Calendar, CircleAlert, LifeBuoy, Plus, Receipt, Users, Wallet } from 'lucide-react-native';
import { color, space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { StatCard, QuickTile, PropertySwitcher } from '../../../components/Card';
import { BellButton, EmptyState } from '../../../components/Chrome';
import { SkeletonBlock } from '../../../components/Skeleton';
import { useLang, useT } from '../../../lib/lang';
import { useActiveProperty } from '../../../state/active-property';
import { data } from '../../../data';
import { currentMonthKey, localiseNumber } from '../../../lib/dates';

// S03. This month's collected and due for the active property, plus the seven shortcuts.
export default function Home() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { property, isLoading, isError, refetch } = useActiveProperty();
  const month = currentMonthKey();
  const summary = useQuery({
    queryKey: ['monthSummary', property?.id, month],
    queryFn: () => data.monthSummary(property!.id, month),
    enabled: !!property,
  });

  const tiles = [
    { key: 'tenants', label: t('home.tile.tenants'), Icon: Users, href: '/tenants' },
    { key: 'flats', label: t('home.tile.flats'), Icon: Building2, href: '/units' },
    { key: 'createBill', label: t('home.tile.createBill'), Icon: Plus, href: '/bills/create' },
    { key: 'allBills', label: t('home.tile.allBills'), Icon: Receipt, href: '/bills' },
    { key: 'expenses', label: t('home.tile.expenses'), Icon: Wallet, href: '/expenses' },
    { key: 'meetings', label: t('home.tile.meetings'), Icon: Calendar, href: '/meetings' },
    { key: 'support', label: t('home.tile.support'), Icon: LifeBuoy, href: '/support' },
  ] as const;

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={{ flex: 1 }}><SkeletonBlock height={96} /></View>
          <View style={{ flex: 1 }}><SkeletonBlock height={96} /></View>
        </View>
        <SkeletonBlock height={96} />
        <SkeletonBlock height={96} />
      </View>
    );
  } else if (isError) {
    body = (
      <EmptyState
        icon={<CircleAlert size={32} color={color.danger} />}
        title={t('common.error')}
        body={t('common.errorBody')}
        actionLabel={t('common.retry')}
        onAction={refetch}
      />
    );
  } else if (!property) {
    body = (
      <EmptyState
        icon={<Building2 size={32} color={color.textMuted} />}
        title={t('home.noPropertyTitle')}
        body={t('home.noPropertyBody')}
        actionLabel={t('home.addProperty')}
        onAction={() => router.push('/properties/edit')}
      />
    );
  } else {
    const s = summary.data;
    body = (
      <>
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <StatCard
            caption={t('home.collected')}
            poisha={s?.collectedAmount ?? 0}
            loading={summary.isPending}
            note={s ? t('home.paidNote', { n: localiseNumber(s.paidBills, lang) }) : ' '}
          />
          <StatCard
            caption={t('home.due')}
            poisha={s?.outstandingAmount ?? 0}
            loading={summary.isPending}
            note={s ? (s.outstandingAmount === 0 ? t('home.noDues') : t('home.dueNote', { n: localiseNumber(s.outstandingBills, lang) })) : ' '}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space[4], marginHorizontal: -space[1] }}>
          {tiles.map(({ key, label, Icon, href }) => (
            <View key={key} style={{ width: '33.333%', padding: space[1] }}>
              <QuickTile label={label} icon={<Icon size={20} color={color.accent} />} onPress={() => router.push(href)} />
            </View>
          ))}
        </View>
      </>
    );
  }

  return (
    <Screen bar={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: space[3], paddingBottom: space[4] }}>
        {property ? (
          <PropertySwitcher
            name={property.name}
            address={property.address}
            label={t('home.changeProperty', { name: property.name })}
            onPress={() => router.push('/properties')}
          />
        ) : (
          <Text variant="lg" accessibilityRole="header" style={{ flex: 1 }}>{t('app.name')}</Text>
        )}
        <BellButton label={t('home.notifications')} onPress={() => router.push('/notifications')} />
      </View>
      {body}
    </Screen>
  );
}
