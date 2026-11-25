import React, { createContext, useContext } from 'react';
import type { Lang } from './money';

const LangContext = createContext<Lang>('bn');

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}
