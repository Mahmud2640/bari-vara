import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { TextField, ToggleRow } from '../../../components/Form';
import { ConfirmDialog } from '../../../components/Dialogs';
import { Async } from '../../../components/Async';
import { SkeletonCard } from '../../../components/Skeleton';
import { useT } from '../../../lib/lang';
import { useGoBack } from '../../../lib/nav';
import { data, Property } from '../../../data';
import { errorMessage } from '../../../lib/errors';
import { useActiveProperty } from '../../../state/active-property';

// S05. Add or edit a property. Opened with ?id= to edit.
export default function PropertyEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useQuery({ queryKey: ['property', id], queryFn: () => data.getProperty(id!), enabled: !!id });
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => data.getProfile() });
  const t = useT();

  if (!id) return <PropertyForm title={t('properties.newTitle')} isPrimary={false} />;
  return (
    <Screen title={t('properties.editTitle')}>
      <Async query={existing}>
        {(p) => (profile.isPending ? <SkeletonCard /> : <PropertyFormBody property={p} isPrimary={profile.data?.primaryPropertyId === p.id} />)}
      </Async>
    </Screen>
  );
}

function PropertyFormBody(props: { property: Property; isPrimary: boolean }) {
  return <PropertyForm title="" {...props} embedded />;
}

function PropertyForm({
  title, property, isPrimary, embedded,
}: { title: string; property?: Property; isPrimary: boolean; embedded?: boolean }) {
  const t = useT();
  const router = useRouter();
  const goBack = useGoBack();
  const qc = useQueryClient();
  const { setActive } = useActiveProperty();
  const [name, setName] = useState(property?.name ?? '');
  const [address, setAddress] = useState(property?.address ?? '');
  const [primary, setPrimary] = useState(isPrimary);
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (property) return data.updateProperty(property.id, { name, address, makePrimary: primary || undefined });
      return data.createProperty({ name, address, makePrimary: primary });
    },
    onSuccess: async (p) => {
      await qc.invalidateQueries();
      if (!property) setActive(p.id);
      goBack();
    },
    onError: (e) => setFormError(errorMessage(e, t)),
  });

  const archive = useMutation({
    mutationFn: () => data.updateProperty(property!.id, { archived: true }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      goBack();
    },
    onError: (e) => { setConfirmArchive(false); setFormError(errorMessage(e, t)); },
  });

  function submit() {
    setFormError(undefined);
    if (name.trim() === '') { setNameError(t('common.nameRequired')); return; }
    setNameError(undefined);
    save.mutate();
  }

  const form = (
    <View style={{ gap: space[4], paddingTop: space[2] }}>
      <TextField label={t('properties.name')} value={name} onChangeText={setName} error={nameError} autoCapitalize="words" />
      <TextField label={`${t('properties.address')} (${t('common.optional')})`} value={address} onChangeText={setAddress} multiline />
      <ToggleRow label={t('properties.makePrimary')} description={t('properties.makePrimaryDesc')} value={primary} onValueChange={setPrimary} />
      {formError ? <Text variant="sm" tone="danger" accessibilityLiveRegion="polite">{formError}</Text> : null}
      <Button label={t('common.save')} onPress={submit} loading={save.isPending} />
      {property ? <Button label={t('properties.archive')} variant="danger" onPress={() => setConfirmArchive(true)} /> : null}
      <ConfirmDialog
        visible={confirmArchive}
        title={t('properties.archiveTitle')}
        body={t('properties.archiveBody')}
        confirmLabel={t('properties.archive')}
        destructive
        busy={archive.isPending}
        onConfirm={() => archive.mutate()}
        onCancel={() => setConfirmArchive(false)}
      />
    </View>
  );

  return embedded ? form : <Screen title={title}>{form}</Screen>;
}
