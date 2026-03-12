import { describe, expect, it } from 'vitest';

import { parseDisplayAmountToMinor } from '@/lib/wallet';

describe('parseDisplayAmountToMinor', () => {
  it.each([
    ['1.005', null],
    ['100', 10000],
    ['0.1', 10],
    ['99.9', 9990],
    ['', null],
    ['abc', null],
    ['1.234', null]
  ])('parses %s as %s', (input, expected) => {
    expect(parseDisplayAmountToMinor(input)).toBe(expected);
  });
});
