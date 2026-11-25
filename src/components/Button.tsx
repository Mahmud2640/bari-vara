import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { color, layout, radius, space } from '../design/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const palette = {
  primary: { bg: color.accent, fg: 'onAccent', border: color.accent },
  secondary: { bg: color.surface, fg: 'text', border: color.surface },
  ghost: { bg: 'transparent', fg: 'accent', border: 'transparent' },
  danger: { bg: color.bg, fg: 'danger', border: color.danger },
} as const;

export function Button({
  label, onPress, variant = 'primary', size = 'md', disabled, loading, icon, fullWidth = true,
}: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed, focused }: any) => [
        styles.base,
        {
          minHeight: layout.control[size],
          backgroundColor: p.bg,
          borderColor: p.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : pressed ? 0.88 : 1,
          paddingHorizontal: size === 'sm' ? space[3] : space[5],
        },
        focused && styles.focus,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={color[p.fg]} /> : icon}
        <Text variant={size === 'sm' ? 'sm' : 'base'} weight="600" tone={p.fg} style={{ marginLeft: loading || icon ? space[2] : 0 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  focus: { outlineWidth: 2, outlineColor: color.accent, outlineOffset: 2, outlineStyle: 'solid' } as any,
});
