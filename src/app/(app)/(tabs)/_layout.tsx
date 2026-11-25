import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout } from '../../../design/tokens';
import { BottomNav, Tab } from '../../../components/Chrome';
import { useT } from '../../../lib/lang';

type BarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabBar({ state, navigateToTab }: BarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index].name as Tab;
  return (
    <View style={{ backgroundColor: color.bg, paddingBottom: insets.bottom, borderTopWidth: 1, borderTopColor: color.border }}>
      <View style={{ width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
        <BottomNav
          active={active}
          labels={{ home: t('tabs.home'), reports: t('tabs.reports'), profile: t('tabs.profile') }}
          onChange={(tab) => {
            const route = state.routes.find((r) => r.name === tab);
            if (route) navigateToTab(route.key);
          }}
        />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
