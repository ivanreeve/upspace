import type { NextRequest } from 'next/server';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

vi.mock('@/lib/paymongo', () => ({
  parsePaymongoSignatureHeader: vi.fn(),
  verifyPaymongoSignature: vi.fn(),
  isPaymongoSignatureFresh: vi.fn(),
}));

const paymongoModule = await import('@/lib/paymongo');
const { POST: webhookHandler, } = await import('@/app/api/paymongo/webhook/route');

const makeRequest = (payload: Record<string, unknown>) => {
  const text = JSON.stringify(payload);
  return {
    headers: new Headers({ 'Paymongo-Signature': 't=123,te=abc', }),
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  } as unknown as NextRequest;
};

describe('PayMongo webhook signature enforcement', () => {
  it('returns 401 when async signature verification fails', async () => {
    vi.mocked(paymongoModule.parsePaymongoSignatureHeader).mockReturnValue({
      timestamp: 123,
      te: 'abc',
    });
    vi.mocked(paymongoModule.verifyPaymongoSignature).mockResolvedValue(false);
    vi.mocked(paymongoModule.isPaymongoSignatureFresh).mockResolvedValue(true);

    const response = await webhookHandler(
      makeRequest({
        data: {
          attributes: {
            livemode: false,
            type: 'checkout.session.paid',
            data: {
              object: {
                id: 'co_1',
                amount: 1000,
                currency: 'PHP',
                metadata: { booking_id: '11111111-1111-4111-8111-111111111111', },
                status: 'paid',
              },
            },
          },
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.message).toBe('Invalid PayMongo signature.');
  });
});
