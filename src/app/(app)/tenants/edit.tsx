import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Phone } from 'lucide-react-native';
import { color, space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DateField, MoneyField, TextField } from '../../../components/Form';
import { ConfirmDialog, SelectField } from '../../../components/Dialogs';
import { EmptyState } from '../../../components/Chrome';
import { Async } from '../../../components/Async';
import { useLang, useT } from '../../../lib/lang';
import { useGoBack } from '../../../lib/nav';
import { data, TenantWithUnit, UnitWithTenant } from '../../../data';
import { errorMessage } from '../../../lib/errors';
import { moneyToInput, parseMoneyInput } from '../../../lib/money';
import { parseDateInput, todayISO } from '../../../lib/dates';
import { useActiveProperty } from '../../../state/active-property';

// S09. Add or edit a tenant. Opened with ?id= to edit. "Has moved out" ends the tenancy; history stays.
export default function TenantEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useT();
  const { property } = useActiveProperty();
  const existing = useQuery({ queryKey: ['tenant', id], queryFn: () => data.getTenant(id!), enabled: !!id });
  const units = useQuery({ queryKey: ['units', property?.id], queryFn: () => data.listUnits(property!.id), enabled: !!property });

  return (
    <Screen title={id ? t('tenants.editTitle') : t('tenants.newTitle')}>
      {id ? (
        <Async query={existing}>{(x) => <TenantForm tenant={x} units={[]} />}</Async>
      ) : (
        <Async query={units}>{(list) => <TenantForm units={list} />}</Async>
      )}
    </Screen>
  );
}

function TenantForm({ tenant, units }: { tenant?: TenantWithUnit; units: UnitWithTenant[] }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const goBack = useGoBack();
  const qc = useQueryClient();
  const vacant = units.filter((u) => u.currentTenant === null);

  const [unitId, setUnitId] = useState<string | null>(tenant?.unitId ?? null);
  const [name, setName] = useState(tenant?.name ?? '');
  const [phone, setPhone] = useState(tenant?.phone ?? '');
  const [moveIn, setMoveIn] = useState(tenant?.moveInOn ?? todayISO());
  const [rent, setRent] = useState(tenant ? moneyToInput(tenant.monthlyRent, lang) : '');
  const [utilities, setUtilities] = useState(tenant ? moneyToInput(tenant.monthlyUtilities, lang) : '');
  const [note, setNote] = useState(tenant?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [moveOutDate, setMoveOutDate] = useState(todayISO());
  const [moveOutError, setMoveOutError] = useState<string | undefined>();

  // choosing a flat fills in its usual rent, once, if the rent is still empty
  function chooseUnit(id: string) {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u && rent.trim() === '' && u.defaultRent > 0) setRent(moneyToInput(u.defaultRent, lang));
  }

  const save = useMutation({
    mutationFn: async (v: { rent: number; utilities: number; moveInOn: string }) => {
      if (tenant) {
        return data.updateTenant(tenant.id, {
          name, phone, note, moveInOn: v.moveInOn, monthlyRent: v.rent, monthlyUtilities: v.utilities,
        });
      }
      return data.createTenant({
        unitId: unitId!, name, phone: phone || null, note: note || null,
        moveInOn: v.moveInOn, monthlyRent: v.rent, monthlyUtilities: v.utilities,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      goBack();
    },
    onError: (e) => setFormError(errorMessage(e, t)),
  });

  const moveOut = useMutation({
    mutationFn: (date: string) => data.updateTenant(tenant!.id, { movedOutOn: date }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      goBack();
    },
    onError: (e) => setMoveOutError(errorMessage(e, t)),
  });

  function submit() {
    setFormError(undefined);
    const next: Record<string, string | undefined> = {};
    const r = parseMoneyInput(rent);
    const u = utilities.trim() === '' ? 0 : parseMoneyInput(utilities);
    const d = parseDateInput(moveIn);
    if (!tenant && !unitId) next.unit = t('tenants.flat');
    if (name.trim() === '') next.name = t('common.nameRequired');
    if (r === null) next.rent = t('common.moneyInvalid');
    if (u === null) next.utilities = t('common.moneyInvalid');
    if (d === null) next.moveIn = t('common.dateInvalid');
    setErrors(next);
    if (Object.values(next).some(Boolean) || r === null || u === null || d === null) return;
    save.mutate({ rent: r, utilities: u, moveInOn: d });
  }

  function confirmMoveOut() {
    const d = parseDateInput(moveOutDate);
    if (!d) { setMoveOutError(t('common.dateInvalid')); return; }
    setMoveOutError(undefined);
    moveOut.mutate(d);
  }

  if (!tenant && units.length === 0) {
    return (
      <EmptyState
        icon={<Building2 size={32} color={color.textMuted} />}
        title={t('tenants.needFlat')}
        body={t('units.emptyBody')}
        actionLabel={t('tenants.addFlat')}
        onAction={() => router.replace('/units/edit')}
      />
    );
  }
  if (!tenant && vacant.length === 0) {
    return (
      <View style={{ gap: space[4], paddingTop: space[4] }}>
        <Text variant="base">{t('tenants.noVacant')}</Text>
        <Button label={t('tenants.addFlat')} onPress={() => router.replace('/units/edit')} />
      </View>
    );
  }

  const ended = tenant?.movedOutOn != null;

  return (
    <View style={{ gap: space[4], paddingTop: space[2] }}>
      <SelectField
        label={t('tenants.flat')}
        value={unitId}
        disabled={!!tenant}
        placeholder={t('common.select')}
        error={errors.unit}
        options={tenant ? [{ value: tenant.unitId, label: tenant.unitName }] : vacant.map((u) => ({ value: u.id, label: u.name }))}
        onChange={chooseUnit}
      />
      <TextField label={t('tenants.name')} value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
      <TextField label={`${t('tenants.phone')} (${t('common.optional')})`} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <DateField
        label={t('tenants.moveIn')}
        helper={t('common.dateHelp')}
        todayLabel={t('common.today')}
        value={moveIn}
        onChangeText={setMoveIn}
        error={errors.moveIn}
      />
      <MoneyField label={t('tenants.rent')} value={rent} onChangeText={setRent} error={errors.rent} />
      <MoneyField label={`${t('tenants.utilities')} (${t('common.optional')})`} value={utilities} onChangeText={setUtilities} error={errors.utilities} />
      <TextField label={`${t('tenants.note')} (${t('common.optional')})`} value={note} onChangeText={setNote} multiline />
      {formError ? <Text variant="sm" tone="danger" accessibilityLiveRegion="polite">{formError}</Text> : null}
      <Button label={t('common.save')} onPress={submit} loading={save.isPending} />
      {tenant?.phone ? (
        <Button
          label={t('tenants.call')}
          variant="secondary"
          icon={<Phone size={18} color={color.text} />}
          onPress={() => Linking.openURL(`tel:${tenant.phone}`).catch(() => {})}
        />
      ) : null}
      {tenant && !ended ? (
        <Card style={{ gap: space[2] }}>
          <Button label={t('tenants.moveOut')} variant="danger" onPress={() => setMoveOutOpen(true)} />
        </Card>
      ) : null}
      <ConfirmDialog
        visible={moveOutOpen}
        title={t('tenants.moveOutTitle')}
        body={t('tenants.moveOutBody')}
        confirmLabel={t('tenants.moveOut')}
        destructive
        busy={moveOut.isPending}
        onConfirm={confirmMoveOut}
        onCancel={() => { setMoveOutOpen(false); setMoveOutError(undefined); }}
      >
        <DateField label={t('tenants.moveOutDate')} todayLabel={t('common.today')} value={moveOutDate} onChangeText={setMoveOutDate} error={moveOutError} />
      </ConfirmDialog>
    </View>
  );
}
