import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react-native';
import { color, space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Money } from '../../../components/Money';
import { EmptyState } from '../../../components/Chrome';
import { Async } from '../../../components/Async';
import { useT } from '../../../lib/lang';
import { data } from '../../../data';
import { useActiveProperty } from '../../../state/active-property';

// S06. Flats and rooms of the active property, with who lives in each.
export default function Units() {
  const t = useT();
  const router = useRouter();
  const { property } = useActiveProperty();
  const units = useQuery({
    queryKey: ['units', property?.id],
    queryFn: () => data.listUnits(property!.id),
    enabled: !!property,
  });

  return (
    <Screen
      title={t('units.title')}
      footer={property ? <Button label={t('units.add')} onPress={() => router.push('/units/edit')} /> : undefined}
    >
      <View style={{ gap: space[2], paddingTop: space[2] }}>
        {!property ? (
          <EmptyState icon={<Building2 size={32} color={color.textMuted} />} title={t('home.noPropertyTitle')} body={t('home.noPropertyBody')} actionLabel={t('home.addProperty')} onAction={() => router.push('/properties/edit')} />
        ) : (
          <Async query={units}>
            {(list) =>
              list.length === 0 ? (
                <EmptyState icon={<Building2 size={32} color={color.textMuted} />} title={t('units.emptyTitle')} body={t('units.emptyBody')} />
              ) : (
                <>
                  {list.map((u) => (
                    <Pressable
                      key={u.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${u.name}, ${u.currentTenant ? t('units.occupiedBy', { name: u.currentTenant.name }) : t('units.vacant')}`}
                      onPress={() => router.push({ pathname: '/units/edit', params: { id: u.id } })}
                    >
                      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text variant="base" weight="700">{u.name}</Text>
                          <Text variant="xs" tone="textMuted" numberOfLines={1}>
                            {u.currentTenant ? t('units.occupiedBy', { name: u.currentTenant.name }) : t('units.vacant')}
                          </Text>
                        </View>
                        <Money poisha={u.currentTenant?.monthlyRent ?? u.defaultRent} variant="sm" />
                      </Card>
                    </Pressable>
                  ))}
                </>
              )
            }
          </Async>
        )}
      </View>
    </Screen>
  );
}
