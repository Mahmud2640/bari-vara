import type { BillStatus, PaymentMethod } from '../data/types';
import type { TFunction } from './lang';

export function statusLabel(status: BillStatus, t: TFunction): string {
  return t(status === 'due' ? 'bill.statusDue' : status === 'partial' ? 'bill.statusPartial' : 'bill.statusPaid');
}

export function methodLabel(m: PaymentMethod, t: TFunction): string {
  return t(`method.${m}` as const);
}

export function billLabels(t: TFunction) {
  return {
    status: t('bill.status'),
    baseRent: t('bill.baseRent'),
    utilities: t('bill.utilities'),
    totalDue: t('bill.totalDue'),
    paid: t('bill.paid'),
    balance: t('bill.balance'),
    menu: t('common.menu'),
    select: t('bill.select'),
  };
}
