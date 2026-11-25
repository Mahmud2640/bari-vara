import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react-native';
import { color, space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { Chip, ChipRow, MonthGrid } from '../../../components/Chips';
import { EmptyState } from '../../../components/Chrome';
import { useLang, useT } from '../../../lib/lang';
import { data } from '../../../data';
import { errorMessage } from '../../../lib/errors';
import { MONTHS, localiseNumber, monthBounds, monthKey } from '../../../lib/dates';
import { useActiveProperty } from '../../../state/active-property';

// S10. Pick a year and a month, create that month's bills for every current tenant in one step.
export default function CreateBills() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { property } = useActiveProperty();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [info, setInfo] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const years = [0, 1, 2, 3].map((d) => now.getFullYear() - d);
  const existing = useQuery({
    queryKey: ['monthsWithBills', property?.id, year],
    queryFn: () => data.monthsWithBills(property!.id, year),
    enabled: !!property,
  });

  const create = useMutation({
    mutationFn: () => {
      const { start, end } = monthBounds(year, monthIndex);
      return data.createBills(property!.id, start, end);
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries();
      if (r.created + r.skipped === 0) {
        setInfo(t('billCreate.noTenants'));
        return;
      }
      router.replace({
        pathname: '/bills',
        params: { month: monthKey(year, monthIndex), created: String(r.created), skipped: String(r.skipped) },
      });
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  if (!property) {
    return (
      <Screen title={t('billCreate.title')}>
        <EmptyState
          icon={<Building2 size={32} color={color.textMuted} />}
          title={t('billCreate.noProperty')}
          body={t('home.noPropertyBody')}
          actionLabel={t('home.addProperty')}
          onAction={() => router.replace('/properties/edit')}
        />
      </Screen>
    );
  }

  const monthName = MONTHS[lang][monthIndex];
  return (
    <Screen
      title={t('billCreate.title')}
      footer={
        <Button
          label={t('billCreate.button', { month: monthName, year: localiseNumber(year, lang) })}
          onPress={() => { setInfo(undefined); setError(undefined); create.mutate(); }}
          loading={create.isPending}
        />
      }
    >
      <View style={{ gap: space[3], paddingTop: space[2] }}>
        <Text variant="sm" weight="600">{t('billCreate.year')}</Text>
        <ChipRow>
          {years.map((y) => (
            <Chip key={y} label={localiseNumber(y, lang)} selected={y === year} onPress={() => { setYear(y); setInfo(undefined); }} />
          ))}
        </ChipRow>
        <Text variant="sm" weight="600" style={{ marginTop: space[2] }}>{t('billCreate.month')}</Text>
        <MonthGrid
          months={MONTHS[lang]}
          selected={monthIndex}
          hasBills={existing.data ?? []}
          billsExistLabel={t('billCreate.exists')}
          onSelect={(i) => { setMonthIndex(i); setInfo(undefined); }}
        />
        <Text variant="xs" tone="textMuted">{t('billCreate.hint')}</Text>
        {(existing.data ?? []).includes(monthIndex) ? (
          <Text variant="sm" tone="accent" weight="600">{t('billCreate.exists')}</Text>
        ) : null}
        {info ? <Text variant="sm" tone="warning" accessibilityLiveRegion="polite">{info}</Text> : null}
        {error ? <Text variant="sm" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
      </View>
    </Screen>
  );
}
