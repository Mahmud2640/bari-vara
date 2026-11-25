import React from 'react';
import { Stack } from 'expo-router';
import { color } from '../../design/tokens';
import { ActivePropertyProvider } from '../../state/active-property';

export default function AppLayout() {
  return (
    <ActivePropertyProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
    </ActivePropertyProvider>
  );
}
