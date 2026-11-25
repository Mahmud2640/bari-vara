import React from 'react';
import { Share, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { color, space } from '../../../../design/tokens';
import { Screen } from '../../../../components/Screen';
import { Text } from '../../../../components/Text';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { Money } from '../../../../components/Money';
import { StatusLabel } from '../../../../components/Bills';
import { Async } from '../../../../components/Async';
import { useLang, useT } from '../../../../lib/lang';
import { BillDetail, data } from '../../../../data';
import { methodLabel, statusLabel } from '../../../../lib/bill';
import { formatDate, formatRange } from '../../../../lib/dates';
import { formatMoney } from '../../../../lib/money';

// S13. A receipt for one bill. Share sends a plain-text summary; the PDF download comes with the must-haves.
export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const detail = useQuery({ queryKey: ['bill', id], queryFn: () => data.getBill(id) });
  return (
    <Screen title={t('receipt.title')}>
      <Async query={detail}>{(d) => <Body detail={d} />}</Async>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 30 }}>
      <Text variant="sm" tone="textMuted" style={{ flexShrink: 1 }}>{label}</Text>
      {typeof value === 'string' ? <Text variant="sm" weight="600" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text> : value}
    </View>
  );
}

function Body({ detail }: { detail: BillDetail }) {
  const t = useT();
  const lang = useLang();
  const { bill, payments, propertyName } = detail;

  const share = () =>
    Share.share({
      message: t('receipt.shareText', {
        property: propertyName,
        flat: bill.unitName,
        tenant: bill.tenantName,
        period: formatRange(bill.periodStart, bill.periodEnd, lang),
        total: formatMoney(bill.totalDue, lang),
        paid: formatMoney(bill.paidAmount, lang),
        balance: formatMoney(bill.balance, lang),
      }),
    }).catch(() => {});

  return (
    <View style={{ gap: space[4], paddingTop: space[2] }}>
      <Card style={{ gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="lg" accessibilityRole="header">{bill.unitName}</Text>
          <StatusLabel status={bill.status} label={statusLabel(bill.status, t)} />
        </View>
        <View style={{ height: 1, backgroundColor: color.border, marginVertical: space[2] }} />
        <Row label={t('receipt.property')} value={propertyName} />
        <Row label={t('receipt.to')} value={bill.tenantName} />
        <Row label={t('bill.period')} value={formatRange(bill.periodStart, bill.periodEnd, lang)} />
        <View style={{ height: 1, backgroundColor: color.border, marginVertical: space[2] }} />
        <Row label={t('bill.baseRent')} value={<Money poisha={bill.baseRent} variant="sm" />} />
        <Row label={t('bill.utilities')} value={<Money poisha={bill.utilitiesTotal} variant="sm" />} />
        <Row label={t('bill.totalDue')} value={<Money poisha={bill.totalDue} variant="lg" />} />
        <Row label={t('bill.paid')} value={<Money poisha={bill.paidAmount} variant="sm" tone="success" />} />
        <Row label={t('bill.balance')} value={<Money poisha={bill.balance} variant="sm" tone={bill.balance === 0 ? 'success' : 'warning'} />} />
      </Card>

      <View style={{ gap: space[2] }}>
        <Text variant="base" weight="600" accessibilityRole="header">{t('receipt.history')}</Text>
        {payments.length === 0 ? (
          <Text variant="sm" tone="textMuted">{t('receipt.unpaid')}</Text>
        ) : (
          payments.map((p) => (
            <Card key={p.id} style={{ paddingVertical: space[3], gap: 2 }}>
              <Row label={t('bill.paid')} value={<Money poisha={p.amount} variant="sm" tone="success" />} />
              <Row label={methodLabel(p.method, t)} value={formatDate(p.paidOn, lang)} />
              {p.note ? <Text variant="xs" tone="textMuted">{p.note}</Text> : null}
            </Card>
          ))
        )}
      </View>

      <Button label={t('receipt.share')} onPress={share} />
    </View>
  );
}
