import { describe, expect, it } from 'vitest';

import { parseXenditBalancePayload } from '@/lib/providers/xendit/schemas';

describe('parseXenditBalancePayload', () => {
  it('parses direct array payload', () => {
    const parsed = parseXenditBalancePayload([
      {
 balance: '12345',
currency: 'PHP',
type: 'CASH', 
}
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.balance).toBe(12345n);
    expect(parsed[0]?.currency).toBe('PHP');
  });

  it('parses wrapped array payload', () => {
    const parsed = parseXenditBalancePayload({
 data: [{
 balance: 999,
currency: 'PHP',
account_type: 'CASH', 
}], 
});

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.balance).toBe(999n);
  });

  it('parses direct object payload', () => {
    const parsed = parseXenditBalancePayload({
      balance: '1200',
      account_type: 'CASH',
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.balance).toBe(1200n);
    expect(parsed[0]?.currency).toBeUndefined();
  });

  it('parses wrapped object payload', () => {
    const parsed = parseXenditBalancePayload({
 data: {
 balance: '4500',
currency: 'PHP', 
}, 
});

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.balance).toBe(4500n);
    expect(parsed[0]?.currency).toBe('PHP');
  });
});
