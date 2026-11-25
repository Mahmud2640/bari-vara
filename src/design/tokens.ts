// Generated from tokens.json by build-tokens.py. Do not edit by hand.
export const color = {
  bg: '#ffffff',
  surface: '#f4f5f7',
  border: '#e3e6ea',
  borderInput: '#868e98',
  text: '#14171c',
  textMuted: '#5b6470',
  accent: '#2f5bea',
  accentStrong: '#1b2f7a',
  accentSoft: '#e8edff',
  onAccent: '#ffffff',
  onAccentMuted: '#c9d3ff',
  ink: '#14171c',
  onInk: '#ffffff',
  danger: '#c62f2f',
  dangerSoft: '#fdecec',
  success: '#1f7a4d',
  successSoft: '#e6f4ec',
  warning: '#9a5b00',
  warningSoft: '#fff1db',
} as const;

export const type = {
  xs: { size: 12, line: 18, weight: '500' as const },
  sm: { size: 14, line: 22, weight: '400' as const },
  base: { size: 16, line: 24, weight: '400' as const },
  lg: { size: 20, line: 30, weight: '600' as const },
  xl: { size: 24, line: 34, weight: '700' as const },
  display: { size: 32, line: 44, weight: '700' as const },
} as const;

export const space = [0, 4, 8, 12, 16, 20, 24, 32, 48] as const;

export const radius = {"sm": 8, "md": 12, "lg": 20, "pill": 999} as const;

export const layout = {"gutter": 16, "appBarHeight": 56, "bottomNavHeight": 64, "minTarget": 48, "control": {"sm": 36, "md": 48}, "maxContentWidth": 480} as const;

export const motion = { fast: 120, base: 200 } as const;

export type ColorRole = keyof typeof color;
export type TextStyleName = keyof typeof type;
