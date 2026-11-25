import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, Bell, CircleAlert, CircleCheck, FileBarChart, Home, User } from 'lucide-react-native';
import { color, layout, radius, space } from '../design/tokens';
import { Text } from './Text';
import { Button } from './Button';

const focusRing = { outlineWidth: 2, outlineColor: color.accent, outlineOffset: 2, outlineStyle: 'solid' } as any;

export function AppBar({
  title, backLabel, onBack, right,
}: { title: string; backLabel: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.appBar}>
      {onBack ? (
        <Pressable
          accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack}
          style={({ focused }: any) => [styles.iconBtn, focused && focusRing]}
        >
          <ArrowLeft size={24} color={color.text} />
        </Pressable>
      ) : null}
      <Text variant="lg" accessibilityRole="header" style={{ flex: 1, marginLeft: onBack ? 0 : space[4] }} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function BellButton({ label, count, onPress }: { label: string; count?: number; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label} onPress={onPress} style={styles.iconBtn}>
      <Bell size={22} color={color.text} />
      {count ? <View style={styles.bellDot} /> : null}
    </Pressable>
  );
}

export type Tab = 'home' | 'reports' | 'profile';

export function BottomNav({
  active, labels, onChange,
}: { active: Tab; labels: Record<Tab, string>; onChange?: (t: Tab) => void }) {
  const icons = { home: Home, reports: FileBarChart, profile: User } as const;
  return (
    <View accessibilityRole="tablist" style={styles.nav}>
      {(Object.keys(icons) as Tab[]).map((k) => {
        const Icon = icons[k];
        const on = k === active;
        return (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={labels[k]}
            onPress={() => onChange?.(k)}
            style={({ focused }: any) => [styles.tab, focused && focusRing]}
          >
            <View style={[styles.tabPill, on && { backgroundColor: color.accentSoft }]}>
              <Icon size={22} color={on ? color.accent : color.textMuted} />
            </View>
            <Text variant="xs" weight={on ? '600' : '500'} tone={on ? 'accent' : 'textMuted'}>{labels[k]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Presentational panel. `BottomSheet` wraps it in a Modal for real use; the gallery shows the panel inline.
export function SheetPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.grabber} />
      <Text variant="lg" accessibilityRole="header" style={{ marginBottom: space[4] }}>{title}</Text>
      {children}
    </View>
  );
}

export function BottomSheet({
  visible, title, onClose, children,
}: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheetHost}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetColumn}>
          <SheetPanel title={title}>
            <ScrollView style={{ maxHeight: height * 0.7 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </SheetPanel>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function EmptyState({
  icon, title, body, actionLabel, onAction,
}: { icon: React.ReactNode; title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text variant="lg" accessibilityRole="header" style={{ marginTop: space[4], textAlign: 'center' }}>{title}</Text>
      <Text variant="sm" tone="textMuted" style={{ marginTop: space[1], marginBottom: space[5], textAlign: 'center' }}>{body}</Text>
      {actionLabel ? (
        <View style={{ alignSelf: 'center' }}>
          <Button label={actionLabel} onPress={onAction} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

export function Toast({
  message, tone = 'info', actionLabel, onAction,
}: { message: string; tone?: 'info' | 'success' | 'error'; actionLabel?: string; onAction?: () => void }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
      {/* the tone is an icon plus the words, never only a colour */}
      {tone === 'error' ? <CircleAlert size={20} color={color.dangerSoft} style={styles.toastIcon} /> : null}
      {tone === 'success' ? <CircleCheck size={20} color={color.successSoft} style={styles.toastIcon} /> : null}
      <Text variant="sm" tone="onInk" style={{ flex: 1 }}>{message}</Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.toastAction}>
          <Text variant="sm" weight="700" tone="onAccentMuted">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: {
    height: layout.appBarHeight, flexDirection: 'row', alignItems: 'center', backgroundColor: color.bg,
    paddingRight: space[2],
  },
  iconBtn: { width: layout.minTarget, height: layout.minTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  bellDot: { position: 'absolute', top: 12, right: 13, width: 9, height: 9, borderRadius: 5, backgroundColor: color.danger, borderWidth: 2, borderColor: color.bg },
  nav: {
    height: layout.bottomNavHeight, flexDirection: 'row', backgroundColor: color.bg, borderTopWidth: 1, borderTopColor: color.border,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: layout.minTarget },
  tabPill: { width: 56, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  sheet: {
    backgroundColor: color.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space[4], paddingBottom: space[6],
    boxShadow: '0 -8px 24px rgba(16,24,40,.14)',
  } as any,
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.border, marginBottom: space[3] },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,23,28,0.4)' },
  sheetHost: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'box-none' } as any,
  sheetColumn: { width: '100%', maxWidth: layout.maxContentWidth },
  empty: { alignItems: 'center', padding: space[6] },
  emptyIcon: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: color.ink, borderRadius: radius.md,
    paddingHorizontal: space[4], paddingVertical: space[2], minHeight: layout.minTarget,
  },
  toastIcon: { marginRight: space[3] },
  toastAction: { minHeight: layout.minTarget, justifyContent: 'center', paddingLeft: space[3] },
});
