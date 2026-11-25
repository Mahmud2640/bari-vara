import React from 'react';
import { Hammer } from 'lucide-react-native';
import { color } from '../design/tokens';
import { Screen } from './Screen';
import { EmptyState } from './Chrome';
import { useT } from '../lib/lang';
import type { StringKey } from '../i18n/strings';

// Honest placeholder for screens in the recon map that are not built yet.
export function ComingSoon({ titleKey, back = true }: { titleKey: StringKey; back?: boolean }) {
  const t = useT();
  return (
    <Screen title={t(titleKey)} back={back}>
      <EmptyState icon={<Hammer size={32} color={color.textMuted} />} title={t('common.notBuilt')} body={t('common.notBuiltBody')} />
    </Screen>
  );
}
