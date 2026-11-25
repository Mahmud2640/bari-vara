import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
// Per-weight imports on purpose: importing the package root bundles every weight (Thin to Black) into the app.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { NotoSansBengali_400Regular } from '@expo-google-fonts/noto-sans-bengali/400Regular';
import { NotoSansBengali_500Medium } from '@expo-google-fonts/noto-sans-bengali/500Medium';
import { NotoSansBengali_600SemiBold } from '@expo-google-fonts/noto-sans-bengali/600SemiBold';
import { NotoSansBengali_700Bold } from '@expo-google-fonts/noto-sans-bengali/700Bold';
import { color } from '../design/tokens';
import { LangProvider, useLang } from '../lib/lang';
import { data } from '../data';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false } },
});

// Web only: one keyboard focus ring for every control (from the design tokens) and the page language for screen readers.
function useWebChrome() {
  const lang = useLang();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!document.getElementById('focus-ring')) {
      const el = document.createElement('style');
      el.id = 'focus-ring';
      el.textContent = `:focus-visible{outline:2px solid ${color.accent};outline-offset:2px}`;
      document.head.appendChild(el);
    }
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);
}

function Gate() {
  useWebChrome();
  const session = useQuery({ queryKey: ['session'], queryFn: () => data.getSession() });
  if (session.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg }}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }
  const signedIn = !!session.data;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="design" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    NotoSansBengali_400Regular, NotoSansBengali_500Medium, NotoSansBengali_600SemiBold, NotoSansBengali_700Bold,
  });
  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg }}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LangProvider>
          <Gate />
          <StatusBar style="dark" />
        </LangProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
