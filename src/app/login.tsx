import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { space } from '../design/tokens';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { TextField } from '../components/Form';
import { useLang, useT } from '../lib/lang';
import { data, DataError, DEMO_CODE, IS_DEMO } from '../data';
import { errorMessage } from '../lib/errors';
import { toLatinDigits, toBanglaDigits } from '../lib/money';

const COOLDOWN = 30;

// S02. Email, then a 6-digit code. Resending clears the old code (the layer replaces it).
export default function Login() {
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function send() {
    setError(undefined);
    setBusy(true);
    try {
      await data.sendCode(email);
      setCode('');
      setStep('code');
      setCooldown(COOLDOWN);
    } catch (e) {
      // say what really went wrong: a bad address, too many tries, or the email could not be sent
      setError(e instanceof DataError && e.code === 'invalid' ? t('login.badEmail') : errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(undefined);
    setBusy(true);
    try {
      const session = await data.verifyCode(email, code);
      // the session guard in the root layout swaps the navigator; it lands on index, which redirects to /home
      qc.setQueryData(['session'], session);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  const n = (x: number) => (lang === 'bn' ? toBanglaDigits(String(x)) : String(x));

  return (
    <Screen title="" footer={null}>
      <View style={{ paddingTop: space[4], gap: space[4] }}>
        <Text variant="xl" accessibilityRole="header">{step === 'email' ? t('login.title') : t('login.codeTitle')}</Text>
        {step === 'email' ? (
          <>
            <TextField
              label={t('login.emailLabel')}
              helper={t('login.emailHelp')}
              error={error}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Button label={t('login.sendCode')} onPress={send} loading={busy} disabled={email.trim() === ''} />
          </>
        ) : (
          <>
            <Text variant="sm" tone="textMuted">{t('login.codeSent', { email })}</Text>
            <TextField
              label={t('login.codeLabel')}
              error={error}
              value={lang === 'bn' ? toBanglaDigits(code) : code}
              onChangeText={(v) => setCode(toLatinDigits(v).replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={12}
              autoComplete="one-time-code"
              onSubmitEditing={verify}
            />
            <Button label={t('login.verify')} onPress={verify} loading={busy} disabled={code.length !== 6} />
            <Button
              label={cooldown > 0 ? t('login.resendIn', { n: n(cooldown) }) : t('login.resend')}
              variant="ghost"
              onPress={send}
              disabled={cooldown > 0 || busy}
            />
            <Button label={t('login.changeEmail')} variant="ghost" onPress={() => { setStep('email'); setError(undefined); }} />
          </>
        )}
        {IS_DEMO ? (
          <Text variant="xs" tone="textMuted">{t('login.demoHint', { code: lang === 'bn' ? toBanglaDigits(DEMO_CODE) : DEMO_CODE })}</Text>
        ) : null}
      </View>
    </Screen>
  );
}
