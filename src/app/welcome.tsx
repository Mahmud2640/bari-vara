import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { color, radius, space } from '../design/tokens';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { Chip, ChipRow } from '../components/Chips';
import { useLang, useSetLang, useT } from '../lib/lang';

// S01. One button: signing in with an emailed code creates the account the first time, so there is no
// separate "create account" and "I already have one" (the original has both).
export default function Welcome() {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  return (
    <Screen bar={false} scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: space[6] }}>
        <View style={{ alignSelf: 'flex-end' }}>
          <ChipRow>
            <Chip label="বাংলা" selected={lang === 'bn'} onPress={() => setLang('bn')} />
            <Chip label="English" selected={lang === 'en'} onPress={() => setLang('en')} />
          </ChipRow>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 96, height: 96, borderRadius: radius.lg, backgroundColor: color.accentStrong, alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={48} color={color.onAccent} />
          </View>
          <Text variant="xl" accessibilityRole="header" style={{ marginTop: space[6], textAlign: 'center' }}>{t('app.name')}</Text>
          <Text variant="lg" weight="600" style={{ marginTop: space[3], textAlign: 'center' }}>{t('welcome.title')}</Text>
          <Text variant="base" tone="textMuted" style={{ marginTop: space[2], textAlign: 'center' }}>{t('welcome.body')}</Text>
        </View>
        <Button label={t('welcome.start')} onPress={() => router.push('/login')} />
      </View>
    </Screen>
  );
}
