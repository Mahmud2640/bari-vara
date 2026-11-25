import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { color, type, ColorRole, TextStyleName } from '../design/tokens';
import { useLang } from '../lib/lang';

// Bangla and Latin each get a family that has the real glyphs. A single family per Text, chosen by
// the app language, so conjuncts never fall back to whatever the phone happens to have.
const INTER = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
} as const;
const BANGLA = {
  '400': 'NotoSansBengali_400Regular',
  '500': 'NotoSansBengali_500Medium',
  '600': 'NotoSansBengali_600SemiBold',
  '700': 'NotoSansBengali_700Bold',
} as const;

export type Weight = keyof typeof INTER;

export interface TextProps extends RNTextProps {
  variant?: TextStyleName;
  weight?: Weight;
  tone?: ColorRole;
}

export function Text({ variant = 'sm', weight, tone = 'text', style, ...rest }: TextProps) {
  const lang = useLang();
  const t = type[variant];
  const w = weight ?? t.weight;
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: (lang === 'bn' ? BANGLA : INTER)[w],
          fontSize: t.size,
          lineHeight: t.line,
          color: color[tone],
        },
        style,
      ]}
    />
  );
}
