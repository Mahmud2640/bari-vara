import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, Receipt, Trash2 } from 'lucide-react-native';
import { color, layout, radius, space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { BillCard } from '../../../components/Bills';
import { Chip, ChipRow } from '../../../components/Chips';
import { BottomSheet, EmptyState, Toast } from '../../../components/Chrome';
import { ConfirmDialog, SelectField } from '../../../components/Dialogs';
import { Async } from '../../../components/Async';
import { SkeletonCard } from '../../../components/Skeleton';
import { useLang, useT } from '../../../lib/lang';
import { BillStatus, BillSummary, data } from '../../../data';
import { billLabels, statusLabel } from '../../../lib/bill';
import { currentMonthKey, localiseNumber, monthLabel, shiftMonth } from '../../../lib/dates';
import { errorMessage } from '../../../lib/errors';
import { useActiveProperty } from '../../../state/active-property';

type Filter = 'all' | BillStatus;

// S11. One month of bills, filter by status and tenant, open a bill, see the receipt, delete an unpaid one.
export default function Bills() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ month?: string; created?: string; skipped?: string }>();
  const { property } = useActiveProperty();
  const [month, setMonth] = useState(params.month ?? currentMonthKey());
  const [status, setStatus] = useState<Filter>('all');
  const [tenantId, setTenantId] = useState('all');
  const [menuFor, setMenuFor] = useState<BillSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BillSummary | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  // result of "create bills", shown once
  useEffect(() => {
    if (params.created === undefined) return;
    const created = Number(params.created);
    const skipped = Number(params.skipped ?? 0);
    const c = localiseNumber(created, lang);
    const text = skipped > 0 ? t('bills.created', { created: c, skipped: localiseNumber(skipped, lang) }) : t('bills.createdOnly', { created: c });
    setToast({ text, tone: 'success' });
    router.setParams({ created: undefined, skipped: undefined });
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.created]);

  const bills = useQuery({
    queryKey: ['bills', property?.id, month],
    queryFn: () => data.listBills({ propertyId: property!.id, month }),
    enabled: !!property,
  });
  const tenants = useQuery({
    queryKey: ['tenants', property?.id, 'all'],
    queryFn: () => data.listTenants(property!.id, { includePast: true }),
    enabled: !!property,
  });

  const remove = useMutation({
    mutationFn: (id: string) => data.deleteBill(id),
    onSuccess: async () => {
      setConfirmDelete(null);
      await qc.invalidateQueries();
    },
    onError: (e) => {
      setConfirmDelete(null);
      setToast({ text: errorMessage(e, t), tone: 'error' });
    },
  });

  const labels = billLabels(t);

  return (
    <Screen title={t('bills.title')}>
      <View style={{ gap: space[3], paddingTop: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('bills.prevMonth')}
            onPress={() => setMonth(shiftMonth(month, -1))}
            style={{ width: layout.minTarget, height: layout.minTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface }}
          >
            <ChevronLeft size={22} color={color.text} />
          </Pressable>
          <Text variant="lg" accessibilityLiveRegion="polite">{monthLabel(month, lang)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('bills.nextMonth')}
            onPress={() => setMonth(shiftMonth(month, 1))}
            style={{ width: layout.minTarget, height: layout.minTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface }}
          >
            <ChevronRight size={22} color={color.text} />
          </Pressable>
        </View>

        <SelectField
          label={t('bills.tenantFilter')}
          value={tenantId}
          onChange={setTenantId}
          options={[{ value: 'all', label: t('bills.allTenants') }, ...(tenants.data ?? []).map((x) => ({ value: x.id, label: `${x.unitName} · ${x.name}` }))]}
        />

        <ChipRow>
          {(
            [['all', t('bills.filterAll')], ['paid', t('bills.filterPaid')], ['due', t('bills.filterDue')], ['partial', t('bills.filterPartial')]] as const
          ).map(([k, label]) => (
            <Chip key={k} label={label} selected={status === k} onPress={() => setStatus(k)} />
          ))}
        </ChipRow>

        {toast ? <Toast message={toast.text} tone={toast.tone} /> : null}

        {!property ? (
          <EmptyState icon={<Receipt size={32} color={color.textMuted} />} title={t('home.noPropertyTitle')} body={t('home.noPropertyBody')} actionLabel={t('home.addProperty')} onAction={() => router.push('/properties/edit')} />
        ) : (
          <Async query={bills} skeleton={<><SkeletonCard lines={4} /><SkeletonCard lines={4} /></>}>
            {(all) => {
              const list = all.filter((b) => (status === 'all' || b.status === status) && (tenantId === 'all' || b.tenantId === tenantId));
              if (all.length === 0) {
                return (
                  <EmptyState
                    icon={<FileText size={32} color={color.textMuted} />}
                    title={t('bills.emptyTitle')}
                    body={t('bills.emptyBody')}
                    actionLabel={t('bills.create')}
                    onAction={() => router.push('/bills/create')}
                  />
                );
              }
              if (list.length === 0) {
                return <EmptyState icon={<FileText size={32} color={color.textMuted} />} title={t('bills.emptyFilterTitle')} body={t('bills.emptyFilterBody')} />;
              }
              return (
                <View style={{ gap: space[3] }}>
                  <Text variant="xs" tone="textMuted">{t('bills.count', { n: localiseNumber(list.length, lang) })}</Text>
                  {list.map((b) => (
                    <BillCard
                      key={b.id}
                      flat={b.unitName}
                      tenant={b.tenantName}
                      status={b.status}
                      statusLabel={statusLabel(b.status, t)}
                      baseRent={b.baseRent}
                      utilities={b.utilitiesTotal}
                      paid={b.paidAmount}
                      labels={labels}
                      onPress={() => router.push({ pathname: '/bills/[id]', params: { id: b.id } })}
                      onMenu={() => setMenuFor(b)}
                    />
                  ))}
                </View>
              );
            }}
          </Async>
        )}
      </View>

      <BottomSheet visible={!!menuFor} title={menuFor ? `${menuFor.unitName} · ${menuFor.tenantName}` : t('bills.menuTitle')} onClose={() => setMenuFor(null)}>
        <View style={{ gap: space[1] }}>
          <MenuRow
            icon={<Receipt size={20} color={color.text} />}
            label={t('bills.viewReceipt')}
            onPress={() => { const id = menuFor!.id; setMenuFor(null); router.push({ pathname: '/bills/[id]/receipt', params: { id } }); }}
          />
          <MenuRow
            icon={<Trash2 size={20} color={color.danger} />}
            label={t('bills.deleteBill')}
            danger
            onPress={() => { const b = menuFor!; setMenuFor(null); if (b.paidAmount > 0) setToast({ text: t('bills.hasPayments'), tone: 'error' }); else setConfirmDelete(b); }}
          />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={!!confirmDelete}
        title={t('bills.deleteTitle')}
        body={t('bills.deleteBody')}
        confirmLabel={t('common.delete')}
        destructive
        busy={remove.isPending}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </Screen>
  );
}

function MenuRow({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: layout.minTarget, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[2], borderRadius: radius.md }}
    >
      {icon}
      <Text variant="base" tone={danger ? 'danger' : 'text'}>{label}</Text>
    </Pressable>
  );
}
