import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react-native';
import { color, space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Button } from '../../../components/Button';
import { PropertyRow } from '../../../components/Bills';
import { EmptyState } from '../../../components/Chrome';
import { Async } from '../../../components/Async';
import { useT } from '../../../lib/lang';
import { useGoBack } from '../../../lib/nav';
import { data } from '../../../data';
import { useActiveProperty } from '../../../state/active-property';

// S04. Tap a property to switch to it. The pencil edits it.
export default function Properties() {
  const t = useT();
  const router = useRouter();
  const goBack = useGoBack();
  const { setActive } = useActiveProperty();
  const props = useQuery({ queryKey: ['properties'], queryFn: () => data.listProperties() });
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => data.getProfile() });

  return (
    <Screen
      title={t('properties.title')}
      footer={<Button label={t('properties.add')} onPress={() => router.push('/properties/edit')} />}
    >
      <View style={{ gap: space[2], paddingTop: space[2] }}>
        <Async query={props}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState icon={<Building2 size={32} color={color.textMuted} />} title={t('properties.emptyTitle')} body={t('properties.emptyBody')} />
            ) : (
              <>
                {list.map((p) => (
                  <PropertyRow
                    key={p.id}
                    name={p.name}
                    address={p.address ?? ''}
                    primary={profile.data?.primaryPropertyId === p.id}
                    primaryLabel={t('properties.primary')}
                    editLabel={t('common.edit')}
                    onPress={() => { setActive(p.id); goBack(); }}
                    onEdit={() => router.push({ pathname: '/properties/edit', params: { id: p.id } })}
                  />
                ))}
              </>
            )
          }
        </Async>
      </View>
    </Screen>
  );
}
