import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { PartnerSessionError } from '@/lib/auth/require-partner-session';
import { FinancialProviderError } from '@/lib/providers/errors';

export function createFinancialErrorResponse(error: unknown) {
  if (error instanceof PartnerSessionError) {
    return NextResponse.json(
      { message: error.message, },
      { status: error.status, }
    );
  }

  if (error instanceof FinancialProviderError) {
    return NextResponse.json(
      { message: error.message, },
      { status: error.status, }
    );
  }

  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === 'P1001'
  ) {
    return NextResponse.json(
      { message: 'Database unavailable. Please try again shortly.', },
      { status: 503, }
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      { message: 'Database unavailable. Please try again shortly.', },
      { status: 503, }
    );
  }

  return null;
}
