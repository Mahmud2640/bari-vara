import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { color, layout, space } from '../design/tokens';
import { AppBar } from './Chrome';
import { useT } from '../lib/lang';

export interface ScreenProps {
  title?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  bar?: boolean;
}

// Every screen: safe area, app bar, a content column no wider than layout.maxContentWidth, optional sticky footer.
export function Screen({ title = '', back = true, onBack, right, children, footer, scroll = true, bar = true }: ScreenProps) {
  const router = useRouter();
  const t = useT();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {bar ? (
        <View style={styles.centerWrap}>
          <AppBar title={title} backLabel={t('common.back')} onBack={back ? goBack : undefined} right={right} />
        </View>
      ) : null}
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.column, { flex: 1 }]}>{children}</View>
      )}
      {footer ? (
        <View style={styles.footerOuter}>
          <View style={[styles.column, { paddingVertical: space[3] }]}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  centerWrap: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  scrollContent: { flexGrow: 1, paddingBottom: space[6] },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.gutter },
  footerOuter: { borderTopWidth: 1, borderTopColor: color.border, backgroundColor: color.bg },
});
