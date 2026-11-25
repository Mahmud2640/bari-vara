import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { space } from '../../../design/tokens';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Chip, ChipRow } from '../../../components/Chips';
import { Toast } from '../../../components/Chrome';
import { Async } from '../../../components/Async';
import { ConfirmDialog } from '../../../components/Dialogs';
import { useLang, useSetLang, useT } from '../../../lib/lang';
import { data } from '../../../data';
import { errorMessage } from '../../../lib/errors';

// S18. Language, sign out, and (demo mode only) sample data. Account deletion comes with the must-haves.
export default function Profile() {
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const session = useQuery({ queryKey: ['session'], queryFn: () => data.getSession() });

  const sample = useMutation({
    mutationFn: () => data.loadSampleData!(),
    onSuccess: async () => {
      await qc.invalidateQueries();
      setMessage({ text: t('profile.sampleDone'), tone: 'success' });
    },
    onError: (e) => setMessage({ text: errorMessage(e, t), tone: 'error' }),
  });

  const deleteAccount = useMutation({
    mutationFn: () => data.deleteAccount(),
    onSuccess: () => {
      setConfirmDelete(false);
      qc.setQueryData(['session'], null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    },
    onError: (e) => {
      setConfirmDelete(false);
      setMessage({ text: errorMessage(e, t), tone: 'error' });
    },
  });

  async function signOut() {
    await data.signOut();
    qc.setQueryData(['session'], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
  }

  return (
    <Screen title={t('profile.title')} back={false}>
      <View style={{ gap: space[5], paddingTop: space[2] }}>
        <Async query={session}>
          {(s) => (s ? <Text variant="sm" tone="textMuted">{t('profile.signedInAs', { email: s.email })}</Text> : null)}
        </Async>

        <View style={{ gap: space[2] }}>
          <Text variant="sm" weight="600">{t('profile.language')}</Text>
          <ChipRow>
            <Chip label="বাংলা" selected={lang === 'bn'} onPress={() => { setLang('bn'); data.updateProfile({ language: 'bn' }).catch(() => {}); }} />
            <Chip label="English" selected={lang === 'en'} onPress={() => { setLang('en'); data.updateProfile({ language: 'en' }).catch(() => {}); }} />
          </ChipRow>
        </View>

        {data.loadSampleData ? (
          <Card style={{ gap: space[2] }}>
            <Text variant="base" weight="600">{t('profile.sampleTitle')}</Text>
            <Text variant="sm" tone="textMuted">{t('profile.sampleBody')}</Text>
            <View style={{ marginTop: space[2] }}>
              <Button label={t('profile.loadSample')} variant="secondary" loading={sample.isPending} onPress={() => sample.mutate()} />
            </View>
          </Card>
        ) : null}

        {message ? <Toast message={message.text} tone={message.tone} /> : null}

        <Button label={t('profile.signOut')} variant="secondary" onPress={signOut} />
        <Button label={t('profile.deleteAccount')} variant="danger" onPress={() => setConfirmDelete(true)} />
        <ConfirmDialog
          visible={confirmDelete}
          title={t('profile.deleteTitle')}
          body={t('profile.deleteBody')}
          confirmLabel={t('profile.deleteAccount')}
          destructive
          busy={deleteAccount.isPending}
          onConfirm={() => deleteAccount.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      </View>
    </Screen>
  );
}
