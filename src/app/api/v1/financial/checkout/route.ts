import type { NextRequest } from 'next/server';

import { handleCreateBookingCheckout } from './handler';

export async function POST(req: NextRequest) {
  return handleCreateBookingCheckout(req);
}
