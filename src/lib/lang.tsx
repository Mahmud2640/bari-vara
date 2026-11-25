import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from './money';
import { strings, StringKey } from '../i18n/strings';

const KEY = 'rentbook.lang';

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangState>({ lang: 'bn', setLang: () => {} });

// Bangla is the default. The choice is remembered on the device.
export function LangProvider({ children, initial }: { children: React.ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial ?? 'bn');

  useEffect(() => {
    if (initial) return;
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'bn' || v === 'en') setLangState(v);
    }).catch(() => {});
  }, [initial]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext).lang;
}

export function useSetLang(): (l: Lang) => void {
  return useContext(LangContext).setLang;
}

export type TFunction = (key: StringKey, params?: Record<string, string | number>) => string;

export function makeT(lang: Lang): TFunction {
  const table = strings[lang];
  return (key, params) => {
    let s: string = table[key];
    if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

export function useT(): TFunction {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}
