import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, TextInputProps, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { color, layout, radius, space } from '../design/tokens';
import { Text } from './Text';
import { useLang } from '../lib/lang';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  trailing?: React.ReactNode;
}

export function TextField({ label, helper, error, disabled, trailing, multiline, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const lang = useLang();
  const fontFamily = lang === 'bn' ? 'NotoSansBengali_400Regular' : 'Inter_400Regular';
  return (
    <View style={{ opacity: disabled ? 0.5 : 1 }}>
      <Text variant="sm" weight="600" style={{ marginBottom: space[1] }}>{label}</Text>
      <View
        style={[
          styles.box,
          multiline && { minHeight: 96, alignItems: 'flex-start' },
          { borderColor: error ? color.danger : focused ? color.accent : color.borderInput },
          focused && styles.focused,
        ]}
      >
        <TextInput
          {...rest}
          multiline={multiline}
          editable={!disabled}
          accessibilityLabel={label}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          placeholderTextColor={color.textMuted}
          style={[styles.input, { fontFamily }, multiline && { textAlignVertical: 'top', paddingVertical: space[3] }]}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="xs" tone="danger" style={{ marginTop: space[1] }} accessibilityLiveRegion="polite">{error}</Text>
      ) : helper ? (
        <Text variant="xs" tone="textMuted" style={{ marginTop: space[1] }}>{helper}</Text>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label, description, value, onValueChange,
}: { label: string; description?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onValueChange(!value)}
      style={[styles.toggle, value && { backgroundColor: color.accentSoft }]}
    >
      <View style={{ flex: 1, paddingRight: space[3] }}>
        <Text variant="sm" weight="600">{label}</Text>
        {description ? <Text variant="xs" tone="textMuted">{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: color.border, true: color.accent }}
        thumbColor={color.bg}
        accessible={false}
      />
    </Pressable>
  );
}

export function SearchField({
  value, onChangeText, placeholder, clearLabel,
}: { value: string; onChangeText: (t: string) => void; placeholder: string; clearLabel: string }) {
  const lang = useLang();
  return (
    <View style={styles.search} accessibilityRole="search">
      <Search size={20} color={color.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textMuted}
        accessibilityLabel={placeholder}
        style={[styles.input, { fontFamily: lang === 'bn' ? 'NotoSansBengali_400Regular' : 'Inter_400Regular', marginLeft: space[2] }]}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={clearLabel} onPress={() => onChangeText('')} hitSlop={12}>
          <X size={18} color={color.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: layout.control.md, borderWidth: 1, borderRadius: radius.md, backgroundColor: color.bg,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3],
  },
  focused: { borderWidth: 2 },
  input: { flex: 1, fontSize: 16, lineHeight: 24, color: color.text, paddingVertical: 0, outlineStyle: 'none' } as any,
  toggle: {
    minHeight: layout.minTarget, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md,
    paddingHorizontal: space[3], paddingVertical: space[2], backgroundColor: color.surface,
  },
  search: {
    minHeight: layout.control.md, borderRadius: radius.md, backgroundColor: color.surface,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3],
  },
});
