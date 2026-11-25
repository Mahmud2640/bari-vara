import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, MoreVertical, Pencil } from 'lucide-react-native';
import { color, radius, space } from '../design/tokens';
import { Text } from './Text';
import { Money } from './Money';
import { Card } from './Card';

export type BillStatus = 'due' | 'partial' | 'paid';

const statusStyle = {
  due: { fg: 'danger', bg: 'dangerSoft' },
  partial: { fg: 'warning', bg: 'warningSoft' },
  paid: { fg: 'success', bg: 'successSoft' },
} as const;

// Colour, a dot and a word: never colour alone.
export function StatusLabel({ status, label }: { status: BillStatus; label: string }) {
  const s = statusStyle[status];
  return (
    <View style={[styles.status, { backgroundColor: color[s.bg] }]} accessible accessibilityLabel={label}>
      <View style={[styles.statusDot, { backgroundColor: color[s.fg] }]} />
      <Text variant="xs" weight="600" tone={s.fg}>{label}</Text>
    </View>
  );
}

export interface BillCardProps {
  flat: string;
  tenant: string;
  status: BillStatus;
  statusLabel: string;
  baseRent: number;
  utilities: number;
  paid?: number;
  labels: { status: string; baseRent: string; utilities: string; totalDue: string; paid: string; balance: string; menu: string; select: string };
  selected?: boolean;
  onToggleSelect?: () => void;
  onPress?: () => void;
  onMenu?: () => void;
}

export function BillCard({
  flat, tenant, status, statusLabel, baseRent, utilities, paid = 0, labels, selected, onToggleSelect, onPress, onMenu,
}: BillCardProps) {
  const total = baseRent + utilities;
  const a11y = `${flat}, ${tenant}, ${statusLabel}`;
  return (
    <Card style={selected ? { backgroundColor: color.accentSoft } : undefined}>
      <View style={styles.head}>
        {onToggleSelect ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected }}
            accessibilityLabel={`${labels.select} ${flat}`}
            onPress={onToggleSelect}
            hitSlop={12}
            style={[styles.checkbox, selected && { backgroundColor: color.accent, borderColor: color.accent }]}
          >
            {selected ? <Check size={14} color={color.onAccent} /> : null}
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={{ flex: 1, marginLeft: onToggleSelect ? space[3] : 0 }}>
          <Text variant="sm" weight="700">{flat}</Text>
          <Text variant="xs" tone="textMuted">{tenant}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.menu}
          onPress={onMenu}
          style={styles.menu}
        >
          <MoreVertical size={20} color={color.textMuted} />
        </Pressable>
      </View>
      <Row label={labels.status}><StatusLabel status={status} label={statusLabel} /></Row>
      <Row label={labels.baseRent}><Money poisha={baseRent} variant="sm" /></Row>
      <Row label={labels.utilities}><Money poisha={utilities} variant="sm" /></Row>
      {status === 'partial' ? (
        <>
          <Row label={labels.paid}><Money poisha={paid} variant="sm" tone="success" /></Row>
          <Row label={labels.balance}><Money poisha={total - paid} variant="sm" tone="warning" /></Row>
        </>
      ) : null}
      <View style={styles.divider} />
      <Row label={labels.totalDue} strong><Money poisha={total} variant="base" weight="700" /></Row>
    </Card>
  );
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="sm" weight={strong ? '700' : '400'} tone={strong ? 'text' : 'textMuted'} style={{ flexShrink: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

export function PropertyRow({
  name, address, primary, primaryLabel, editLabel, onPress, onEdit,
}: {
  name: string; address: string; primary?: boolean; primaryLabel: string; editLabel: string;
  onPress?: () => void; onEdit?: () => void;
}) {
  const fg = primary ? 'onAccent' : 'text';
  const fgMuted = primary ? 'onAccentMuted' : 'textMuted';
  // the row and the pencil are siblings: a button must never contain another button
  return (
    <View style={[styles.property, { backgroundColor: primary ? color.accentStrong : color.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${address}${primary ? ', ' + primaryLabel : ''}`}
        onPress={onPress}
        style={{ flex: 1, paddingVertical: space[2] }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Text variant="sm" weight="700" tone={fg}>{name}</Text>
          {primary ? (
            <View style={styles.primaryBadge}>
              <Text variant="xs" weight="600" tone="onAccent">{primaryLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text variant="xs" tone={fgMuted}>{address}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${editLabel} ${name}`} onPress={onEdit} style={styles.menu}>
        <Pencil size={18} color={color[fgMuted]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space[2] },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: color.borderInput, backgroundColor: color.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  menu: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -space[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 30 },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space[2] },
  property: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingLeft: space[4], minHeight: 64,
  },
  primaryBadge: {
    marginLeft: space[2], paddingHorizontal: space[2], borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
