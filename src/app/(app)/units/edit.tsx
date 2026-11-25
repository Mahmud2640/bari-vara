import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { MoneyField, TextField } from '../../../components/Form';
import { ConfirmDialog } from '../../../components/Dialogs';
import { Async } from '../../../components/Async';
import { useLang, useT } from '../../../lib/lang';
import { useGoBack } from '../../../lib/nav';
import { data, Unit } from '../../../data';
import { errorMessage } from '../../../lib/errors';
import { moneyToInput, parseMoneyInput } from '../../../lib/money';
import { useActiveProperty } from '../../../state/active-property';

// S07. Add or edit a flat or room. Opened with ?id= to edit.
export default function UnitEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useT();
  const existing = useQuery({ queryKey: ['unit', id], queryFn: () => data.getUnit(id!), enabled: !!id });
  if (!id) return <Screen title={t('units.newTitle')}><UnitForm /></Screen>;
  return (
    <Screen title={t('units.editTitle')}>
      <Async query={existing}>{(u) => <UnitForm unit={u} />}</Async>
    </Screen>
  );
}

function UnitForm({ unit }: { unit?: Unit }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const goBack = useGoBack();
  const qc = useQueryClient();
  const { property } = useActiveProperty();
  const [name, setName] = useState(unit?.name ?? '');
  const [floor, setFloor] = useState(unit?.floor ?? '');
  const [rent, setRent] = useState(unit ? moneyToInput(unit.defaultRent, lang) : '');
  const [errors, setErrors] = useState<{ name?: string; rent?: string }>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);

  const save = useMutation({
    mutationFn: async (defaultRent: number) => {
      if (unit) return data.updateUnit(unit.id, { name, floor, defaultRent });
      return data.createUnit({ propertyId: property!.id, name, floor, defaultRent });
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      goBack();
    },
    onError: (e) => setFormError(errorMessage(e, t)),
  });

  const archive = useMutation({
    mutationFn: () => data.updateUnit(unit!.id, { archived: true }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      goBack();
    },
    onError: (e) => { setConfirm(false); setFormError(errorMessage(e, t)); },
  });

  // an empty rent means 0: the usual rent is only a convenience for filling in new tenants
  function submit() {
    setFormError(undefined);
    const next: typeof errors = {};
    const defaultRent = rent.trim() === '' ? 0 : parseMoneyInput(rent);
    if (name.trim() === '') next.name = t('common.nameRequired');
    if (defaultRent === null) next.rent = t('common.moneyInvalid');
    setErrors(next);
    if (next.name || defaultRent === null) return;
    save.mutate(defaultRent);
  }

  return (
    <View style={{ gap: space[4], paddingTop: space[2] }}>
      <TextField label={t('units.name')} value={name} onChangeText={setName} error={errors.name} autoCapitalize="characters" />
      <TextField label={`${t('units.floor')} (${t('common.optional')})`} value={floor} onChangeText={setFloor} />
      <MoneyField label={t('units.rent')} helper={t('units.rentHelp')} value={rent} onChangeText={setRent} error={errors.rent} placeholder="0" />
      {formError ? <Text variant="sm" tone="danger" accessibilityLiveRegion="polite">{formError}</Text> : null}
      <Button label={t('common.save')} onPress={submit} loading={save.isPending} disabled={!property && !unit} />
      {unit ? <Button label={t('units.archive')} variant="danger" onPress={() => setConfirm(true)} /> : null}
      <ConfirmDialog
        visible={confirm}
        title={t('units.archiveTitle')}
        body={t('units.archiveBody')}
        confirmLabel={t('units.archive')}
        destructive
        busy={archive.isPending}
        onConfirm={() => archive.mutate()}
        onCancel={() => setConfirm(false)}
      />
    </View>
  );
}
