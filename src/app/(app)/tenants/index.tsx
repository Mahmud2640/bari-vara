import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react-native';
import { color, space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Chip, ChipRow } from '../../../components/Chips';
import { Money } from '../../../components/Money';
import { EmptyState } from '../../../components/Chrome';
import { Async } from '../../../components/Async';
import { useLang, useT } from '../../../lib/lang';
import { data } from '../../../data';
import { formatDate } from '../../../lib/dates';
import { useActiveProperty } from '../../../state/active-property';

// S08. Current tenants, or past ones. Tap to edit.
export default function Tenants() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { property } = useActiveProperty();
  const [showPast, setShowPast] = useState(false);
  const tenants = useQuery({
    queryKey: ['tenants', property?.id, 'all'],
    queryFn: () => data.listTenants(property!.id, { includePast: true }),
    enabled: !!property,
  });

  return (
    <Screen
      title={t('tenants.title')}
      footer={property ? <Button label={t('tenants.add')} onPress={() => router.push('/tenants/edit')} /> : undefined}
    >
      <View style={{ gap: space[3], paddingTop: space[2] }}>
        <ChipRow>
          <Chip label={t('tenants.current')} selected={!showPast} onPress={() => setShowPast(false)} />
          <Chip label={t('tenants.past')} selected={showPast} onPress={() => setShowPast(true)} />
        </ChipRow>
        {!property ? (
          <EmptyState icon={<Users size={32} color={color.textMuted} />} title={t('home.noPropertyTitle')} body={t('home.noPropertyBody')} actionLabel={t('home.addProperty')} onAction={() => router.push('/properties/edit')} />
        ) : (
          <Async query={tenants}>
            {(all) => {
              const list = all.filter((x) => (showPast ? x.movedOutOn !== null : x.movedOutOn === null));
              if (list.length === 0) {
                return (
                  <EmptyState
                    icon={<Users size={32} color={color.textMuted} />}
                    title={showPast ? t('tenants.pastEmptyTitle') : t('tenants.emptyTitle')}
                    body={showPast ? '' : t('tenants.emptyBody')}
                  />
                );
              }
              return (
                <View style={{ gap: space[2] }}>
                  {list.map((x) => (
                    <Pressable
                      key={x.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${x.name}, ${x.unitName}`}
                      onPress={() => router.push({ pathname: '/tenants/edit', params: { id: x.id } })}
                    >
                      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1, paddingRight: space[2] }}>
                          <Text variant="base" weight="700" numberOfLines={1}>{x.name}</Text>
                          <Text variant="xs" tone="textMuted" numberOfLines={1}>
                            {x.unitName} · {x.movedOutOn ? t('tenants.movedOutOn', { date: formatDate(x.movedOutOn, lang) }) : t('tenants.since', { date: formatDate(x.moveInOn, lang) })}
                          </Text>
                        </View>
                        <Money poisha={x.monthlyRent + x.monthlyUtilities} variant="sm" />
                      </Card>
                    </Pressable>
                  ))}
                </View>
              );
            }}
          </Async>
        )}
      </View>
    </Screen>
  );
}
