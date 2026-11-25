import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { color, layout, radius, space } from '../design/tokens';
import { Text } from './Text';
import { Button } from './Button';
import { BottomSheet } from './Chrome';
import { useT } from '../lib/lang';

export function ConfirmDialog({
  visible, title, body, confirmLabel, destructive, onConfirm, onCancel, busy, children,
}: {
  visible: boolean; title: string; body: string; confirmLabel: string; destructive?: boolean;
  onConfirm: () => void; onCancel: () => void; busy?: boolean; children?: React.ReactNode;
}) {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text variant="lg" accessibilityRole="header">{title}</Text>
          <Text variant="sm" tone="textMuted" style={{ marginTop: space[2], marginBottom: children ? space[4] : space[5] }}>{body}</Text>
          {children ? <View style={{ marginBottom: space[5] }}>{children}</View> : null}
          <View style={{ gap: space[2] }}>
            {/* the safe action comes first */}
            <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} />
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} loading={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export interface Option<V extends string> { value: V; label: string }

export function SelectField<V extends string>({
  label, value, options, onChange, placeholder, error, disabled,
}: {
  label: string; value: V | null; options: Option<V>[]; onChange: (v: V) => void;
  placeholder?: string; error?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ opacity: disabled ? 0.5 : 1 }}>
      <Text variant="sm" weight="600" style={{ marginBottom: space[1] }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${selected ? ', ' + selected.label : ''}`}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.box, { borderColor: error ? color.danger : color.borderInput }]}
      >
        <Text variant="base" tone={selected ? 'text' : 'textMuted'} style={{ flex: 1 }} numberOfLines={1}>
          {selected?.label ?? placeholder ?? ''}
        </Text>
        <ChevronDown size={20} color={color.textMuted} />
      </Pressable>
      {error ? <Text variant="xs" tone="danger" style={{ marginTop: space[1] }} accessibilityLiveRegion="polite">{error}</Text> : null}
      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View accessibilityRole="radiogroup">
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, selected: on }}
                accessibilityLabel={o.label}
                onPress={() => { onChange(o.value); setOpen(false); }}
                style={[styles.option, on && { backgroundColor: color.accentSoft }]}
              >
                <Text variant="base" weight={on ? '600' : '400'} style={{ flex: 1 }}>{o.label}</Text>
                {on ? <Check size={20} color={color.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20,23,28,0.4)', alignItems: 'center', justifyContent: 'center', padding: space[4] },
  dialog: { width: '100%', maxWidth: 360, backgroundColor: color.bg, borderRadius: radius.lg, padding: space[5] },
  box: {
    minHeight: layout.control.md, borderWidth: 1, borderRadius: radius.md, backgroundColor: color.bg,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3],
  },
  option: { minHeight: layout.minTarget, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], borderRadius: radius.md },
});
