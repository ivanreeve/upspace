import { XenditFinancialProvider } from './xendit';

import type { FinancialProvider } from '@/lib/providers/types';


let xenditProvider: FinancialProvider | null = null;

export function getFinancialProvider(): FinancialProvider {
  if (!xenditProvider) {
    xenditProvider = new XenditFinancialProvider();
  }

  return xenditProvider;
}
