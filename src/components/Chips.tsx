import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, layout, radius, space } from '../design/tokens';
import { Text } from './Text';

const focusRing = { outlineWidth: 2, outlineColor: color.accent, outlineOffset: 2, outlineStyle: 'solid' } as any;

export function Chip({
  label, selected, onPress,
}: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected, checked: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
      style={({ pressed, focused }: any) => [
        styles.chip,
        selected && { backgroundColor: color.ink },
        pressed && { opacity: 0.85 },
        focused && focusRing,
      ]}
    >
      <Text variant="sm" weight="600" tone={selected ? 'onInk' : 'text'}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {children}
    </View>
  );
}

// 12 months in 3 columns. `hasBills` marks months that already have bills (the "bills exist" hint).
export function MonthGrid({
  months, selected, hasBills = [], onSelect, billsExistLabel,
}: {
  months: string[];
  selected: number;
  hasBills?: number[];
  onSelect: (i: number) => void;
  billsExistLabel: string;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.grid}>
      {months.map((m, i) => {
        const on = i === selected;
        const has = hasBills.includes(i);
        return (
          <View key={m} style={styles.cellWrap}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: on, checked: on }}
              accessibilityLabel={has ? `${m}, ${billsExistLabel}` : m}
              onPress={() => onSelect(i)}
              style={({ focused }: any) => [styles.cell, on && { backgroundColor: color.ink }, focused && focusRing]}
            >
              <Text variant="sm" weight="600" tone={on ? 'onInk' : 'text'}>{m}</Text>
              {has ? <View style={[styles.dot, { backgroundColor: on ? color.onInk : color.accent }]} /> : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: color.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space[1] },
  cellWrap: { width: '33.333%', padding: space[1] },
  cell: {
    minHeight: layout.control.md, borderRadius: radius.md, backgroundColor: color.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3 },
});
