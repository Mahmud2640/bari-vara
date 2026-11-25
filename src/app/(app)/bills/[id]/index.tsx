import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react-native';
import { color, layout, radius, space } from '../../../../design/tokens';
import { Screen } from '../../../../components/Screen';
import { Text } from '../../../../components/Text';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { Money } from '../../../../components/Money';
import { StatusLabel } from '../../../../components/Bills';
import { BottomSheet, Toast } from '../../../../components/Chrome';
import { ConfirmDialog, SelectField } from '../../../../components/Dialogs';
import { DateField, MoneyField, TextField, ToggleRow } from '../../../../components/Form';
import { Async } from '../../../../components/Async';
import { useLang, useT } from '../../../../lib/lang';
import { BillDetail, data, PAYMENT_METHODS, Payment, PaymentMethod } from '../../../../data';
import { methodLabel, statusLabel } from '../../../../lib/bill';
import { formatDate, formatRange, parseDateInput, todayISO } from '../../../../lib/dates';
import { errorMessage } from '../../../../lib/errors';
import { formatMoney, parseMoneyInput } from '../../../../lib/money';
import { newId } from '../../../../lib/id';

// S12. One bill: what is owed, what was paid, and the payment sheet (full or partial).
export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const detail = useQuery({ queryKey: ['bill', id], queryFn: () => data.getBill(id) });
  return (
    <Screen title={t('billDetail.title')}>
      <Async query={detail}>{(d) => <Body detail={d} />}</Async>
    </Screen>
  );
}

function Line({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 30 }}>
      <Text variant="sm" weight={strong ? '700' : '400'} tone={strong ? 'text' : 'textMuted'} style={{ flexShrink: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

function Body({ detail }: { detail: BillDetail }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { bill, payments } = detail;
  const [sheet, setSheet] = useState(false);
  const [removeFor, setRemoveFor] = useState<Payment | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' | 'info'; undoId?: string } | null>(null);

  const remove = useMutation({
    mutationFn: (pid: string) => data.deletePayment(pid),
    onSuccess: async () => { setRemoveFor(null); await qc.invalidateQueries(); },
    onError: (e) => { setRemoveFor(null); setToast({ text: errorMessage(e, t), tone: 'error' }); },
  });
  const undo = useMutation({
    mutationFn: (pid: string) => data.deletePayment(pid),
    onSuccess: async () => { setToast({ text: t('billDetail.undone'), tone: 'info' }); await qc.invalidateQueries(); },
    onError: (e) => setToast({ text: errorMessage(e, t), tone: 'error' }),
  });

  const fullyPaid = bill.balance === 0;

  return (
    <View style={{ gap: space[4], paddingTop: space[2] }}>
      <Card style={{ gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: space[2] }}>
            <Text variant="lg" accessibilityRole="header">{bill.unitName}</Text>
            <Text variant="sm" tone="textMuted">{bill.tenantName}</Text>
            <Text variant="xs" tone="textMuted" style={{ marginTop: space[1] }}>{formatRange(bill.periodStart, bill.periodEnd, lang)}</Text>
          </View>
          <StatusLabel status={bill.status} label={statusLabel(bill.status, t)} />
        </View>
        <View style={{ height: 1, backgroundColor: color.border, marginVertical: space[2] }} />
        <Line label={t('bill.baseRent')}><Money poisha={bill.baseRent} variant="sm" /></Line>
        <Line label={t('bill.utilities')}><Money poisha={bill.utilitiesTotal} variant="sm" /></Line>
        <Line label={t('bill.totalDue')} strong><Money poisha={bill.totalDue} variant="base" weight="700" /></Line>
        <Line label={t('bill.paid')}><Money poisha={bill.paidAmount} variant="sm" tone="success" /></Line>
        <Line label={t('bill.balance')} strong><Money poisha={bill.balance} variant="base" weight="700" tone={fullyPaid ? 'success' : 'warning'} /></Line>
      </Card>

      {toast ? (
        <Toast
          message={toast.text}
          tone={toast.tone}
          actionLabel={toast.undoId ? t('billDetail.undo') : undefined}
          onAction={toast.undoId ? () => undo.mutate(toast.undoId!) : undefined}
        />
      ) : null}

      <View style={{ gap: space[2] }}>
        {fullyPaid ? (
          <Text variant="sm" tone="success" weight="600" accessibilityLiveRegion="polite">{t('billDetail.fullyPaid')}</Text>
        ) : (
          <Button label={t('billDetail.record')} onPress={() => setSheet(true)} />
        )}
        <Button label={t('billDetail.receipt')} variant="secondary" onPress={() => router.push({ pathname: '/bills/[id]/receipt', params: { id: bill.id } })} />
      </View>

      <View style={{ gap: space[2] }}>
        <Text variant="base" weight="600" accessibilityRole="header">{t('billDetail.history')}</Text>
        {payments.length === 0 ? (
          <Text variant="sm" tone="textMuted">{t('billDetail.noPayments')}</Text>
        ) : (
          payments.map((p) => (
            <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space[2] }}>
              <View style={{ flex: 1 }}>
                <Money poisha={p.amount} variant="base" tone="success" />
                <Text variant="xs" tone="textMuted">{methodLabel(p.method, t)} · {formatDate(p.paidOn, lang)}</Text>
                {p.note ? <Text variant="xs" tone="textMuted">{p.note}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('billDetail.deletePayment')}, ${formatMoney(p.amount, lang, { sign: false })}`}
                onPress={() => setRemoveFor(p)}
                style={{ width: layout.minTarget, height: layout.minTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill }}
              >
                <Trash2 size={20} color={color.danger} />
              </Pressable>
            </Card>
          ))
        )}
      </View>

      <PaymentSheet
        visible={sheet}
        bill={bill}
        onClose={() => setSheet(false)}
        onSaved={(p) => {
          setSheet(false);
          setToast({ text: t('billDetail.saved'), tone: 'success', undoId: p.id });
          qc.invalidateQueries();
        }}
      />

      <ConfirmDialog
        visible={!!removeFor}
        title={t('billDetail.deletePaymentTitle')}
        body={removeFor ? t('billDetail.deletePaymentBody', { amount: formatMoney(removeFor.amount, lang) }) : ''}
        confirmLabel={t('billDetail.deletePayment')}
        destructive
        busy={remove.isPending}
        onConfirm={() => removeFor && remove.mutate(removeFor.id)}
        onCancel={() => setRemoveFor(null)}
      />
    </View>
  );
}

function PaymentSheet({
  visible, bill, onClose, onSaved,
}: { visible: boolean; bill: BillDetail['bill']; onClose: () => void; onSaved: (p: Payment) => void }) {
  const t = useT();
  const lang = useLang();
  const [partial, setPartial] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [dateText, setDateText] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod | null>('cash');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | undefined>();
  // one id per attempt: pressing Save twice, or retrying after a dropped connection, can never record two payments
  const requestId = useRef(newId());

  const record = useMutation({
    mutationFn: (v: { amount: number; paidOn: string; method: PaymentMethod }) =>
      data.recordPayment({ billId: bill.id, amount: v.amount, paidOn: v.paidOn, method: v.method, note: note || null, clientRequestId: requestId.current }),
    onSuccess: (p) => {
      requestId.current = newId();
      setPartial(false); setAmountText(''); setNote(''); setErrors({}); setFormError(undefined);
      onSaved(p);
    },
    onError: (e) => setFormError(errorMessage(e, t)),
  });

  function submit() {
    setFormError(undefined);
    const next: Record<string, string | undefined> = {};
    const amount = partial ? parseMoneyInput(amountText) : bill.balance;
    const paidOn = parseDateInput(dateText);
    if (partial) {
      if (amount === null || amount <= 0) next.amount = t('common.moneyInvalid');
      else if (amount > bill.balance) next.amount = t('billDetail.amountTooMuch');
    }
    if (paidOn === null) next.date = t('common.dateInvalid');
    if (!method) next.method = t('common.select');
    setErrors(next);
    if (Object.values(next).some(Boolean) || amount === null || paidOn === null || !method) return;
    record.mutate({ amount, paidOn, method });
  }

  return (
    <BottomSheet visible={visible} title={t('billDetail.sheetTitle')} onClose={onClose}>
      <View style={{ gap: space[4], paddingBottom: space[2] }}>
        <ToggleRow label={t('billDetail.partial')} description={t('billDetail.partialDesc')} value={partial} onValueChange={setPartial} />
        {partial ? (
          <MoneyField
            label={t('billDetail.amount')}
            helper={t('billDetail.amountHelp', { max: formatMoney(bill.balance, lang) })}
            value={amountText}
            onChangeText={setAmountText}
            error={errors.amount}
          />
        ) : (
          <Text variant="sm" tone="textMuted">{t('billDetail.fullAmount', { amount: formatMoney(bill.balance, lang) })}</Text>
        )}
        <DateField label={t('billDetail.date')} helper={t('common.dateHelp')} todayLabel={t('common.today')} value={dateText} onChangeText={setDateText} error={errors.date} />
        <SelectField
          label={t('billDetail.method')}
          value={method}
          onChange={setMethod}
          error={errors.method}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: methodLabel(m, t) }))}
        />
        <TextField label={`${t('billDetail.note')} (${t('common.optional')})`} value={note} onChangeText={setNote} />
        {formError ? <Text variant="sm" tone="danger" accessibilityLiveRegion="polite">{formError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <View style={{ flex: 1 }}><Button label={t('common.cancel')} variant="secondary" onPress={onClose} /></View>
          <View style={{ flex: 1 }}><Button label={t('billDetail.submit')} onPress={submit} loading={record.isPending} /></View>
        </View>
      </View>
    </BottomSheet>
  );
}
