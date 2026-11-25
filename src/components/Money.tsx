import React from 'react';
import { Text, TextProps } from './Text';
import { formatMoney } from '../lib/money';
import { useLang } from '../lib/lang';

// The only component that turns poisha into text.
export function Money({ poisha, ...rest }: { poisha: number } & Omit<TextProps, 'children'>) {
  const lang = useLang();
  const text = formatMoney(poisha, lang);
  return (
    <Text weight="600" {...rest} accessibilityLabel={`${formatMoney(poisha, lang, { sign: false })} ${lang === 'bn' ? 'টাকা' : 'taka'}`}>
      {text}
    </Text>
  );
}
