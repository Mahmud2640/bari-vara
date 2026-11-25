import { DataError } from '../data/types';
import type { TFunction } from './lang';

// One place that turns any failure into a sentence the person can act on.
export function errorMessage(e: unknown, t: TFunction): string {
  if (e instanceof DataError) {
    const key = `err.${e.code}` as const;
    try {
      return t(key as Parameters<TFunction>[0]);
    } catch {
      return t('err.unknown');
    }
  }
  return t('err.unknown');
}
