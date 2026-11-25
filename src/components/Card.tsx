import React from 'react';
import { Pressable, StyleSheet, View, ViewProps } from 'react-native';
import { Building2, ChevronDown } from 'lucide-react-native';
import { color, radius, space } from '../design/tokens';
import { Text } from './Text';
import { Money } from './Money';

const focusRing = { outlineWidth: 2, outlineColor: color.accent, outlineOffset: 2, outlineStyle: 'solid' } as any;

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

// Hero stat on the home screen: "Collected this month", "Due".
export function StatCard({
  caption, poisha, note, loading,
}: { caption: string; poisha: number; note: string; loading?: boolean }) {
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={loading ? caption : undefined}
    >
      <Text variant="xs" tone="onAccentMuted">{caption}</Text>
      {loading ? (
        <View style={styles.skeleton} />
      ) : (
        <Money poisha={poisha} variant="xl" weight="700" tone="onAccent" style={{ marginTop: space[1] }} />
      )}
      <Text variant="xs" tone="onAccentMuted" style={{ marginTop: space[1] }}>{note}</Text>
    </View>
  );
}

export function QuickTile({
  label, icon, onPress, badge,
}: { label: string; icon: React.ReactNode; onPress?: () => void; badge?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPress={onPress}
      style={({ pressed, focused }: any) => [styles.tile, pressed && { opacity: 0.85 }, focused && focusRing]}
    >
      <View style={styles.tileIcon}>{icon}</View>
      <Text variant="sm" weight="600" style={{ marginTop: space[2], textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text variant="xs" tone="onAccent">{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Header pill on the home screen: current property, tap to change.
export function PropertySwitcher({
  name, address, label, onPress,
}: { name: string; address?: string | null; label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, focused }: any) => [styles.switcher, pressed && { opacity: 0.9 }, focused && focusRing]}
    >
      <Building2 size={20} color={color.onAccent} />
      <View style={{ marginLeft: space[2], flex: 1 }}>
        <Text variant="sm" weight="700" tone="onAccent" numberOfLines={1}>{name}</Text>
        {address ? <Text variant="xs" tone="onAccentMuted" numberOfLines={1}>{address}</Text> : null}
      </View>
      <ChevronDown size={18} color={color.onAccentMuted} />
    </Pressable>
  );
}

export function SummaryTile({
  label, value, highlighted, onPress,
}: { label: string; value: number; highlighted?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={({ focused }: any) => [styles.summary, highlighted && { backgroundColor: color.accentStrong }, focused && focusRing]}
    >
      <Text variant="xs" tone={highlighted ? 'onAccentMuted' : 'textMuted'}>{label}</Text>
      <Text variant="lg" tone={highlighted ? 'onAccent' : 'text'}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switcher: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: color.accentStrong, borderRadius: radius.md,
    paddingHorizontal: space[3], paddingVertical: space[3], minHeight: 56,
  },
  card: { backgroundColor: color.surface, borderRadius: radius.md, padding: space[4] },
  stat: { flex: 1, backgroundColor: color.accentStrong, borderRadius: radius.md, padding: space[4] },
  skeleton: { height: 34, marginTop: space[1], borderRadius: radius.sm, backgroundColor: color.onAccentMuted, opacity: 0.35, width: '60%' },
  tile: {
    flexGrow: 1, flexBasis: 0, minWidth: 96, minHeight: 96, backgroundColor: color.surface, borderRadius: radius.md,
    paddingVertical: space[3], paddingHorizontal: space[2], alignItems: 'center', justifyContent: 'center',
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: color.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: space[2], right: space[2], minWidth: 20, height: 20, borderRadius: radius.pill,
    backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  summary: { flex: 1, backgroundColor: color.surface, borderRadius: radius.md, padding: space[3], minHeight: 64 },
});
