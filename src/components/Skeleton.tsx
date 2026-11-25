import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, DimensionValue, StyleSheet, View } from 'react-native';
import { color, radius, space } from '../design/tokens';
import { useT } from '../lib/lang';

// Pulses, unless the person asked for reduced motion.
function usePulse(): Animated.Value {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: true }),
          Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [v]);
  return v;
}

export function SkeletonBlock({ height = 16, width = '100%' }: { height?: number; width?: DimensionValue }) {
  const opacity = usePulse();
  return <Animated.View style={{ height, width, borderRadius: radius.sm, backgroundColor: color.border, opacity }} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const t = useT();
  return (
    <View style={styles.card} accessible accessibilityLabel={t('common.loading')}>
      <SkeletonBlock height={18} width="40%" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} height={14} width={i % 2 ? '70%' : '90%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.md, padding: space[4], gap: space[3] },
});
