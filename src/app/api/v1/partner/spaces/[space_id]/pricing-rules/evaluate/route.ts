import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { priceRuleDefinitionSchema } from '@/lib/pricing-rules';
import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const evaluateRequestSchema = z.object({
  definition: priceRuleDefinitionSchema,
  bookingHours: z.number().min(0.5).max(8760),
  guestCount: z.number().int().min(1).max(999).optional(),
  startAt: z.string().datetime().optional(),
});

type RouteParams = {
  params: Promise<{
    space_id: string;
  }>;
};

export async function POST(req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const resolvedParams = await params;
    const spaceIdParam = resolvedParams.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be a valid UUID.', }, { status: 400, });
    }

    const body = await req.json().catch(() => null);
    const parsed = evaluateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), }, { status: 400, });
    }

    const space = await prisma.space.findFirst({
      where: {
        id: spaceIdParam,
        user_id: userId,
      },
      select: { id: true, },
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found.', }, { status: 404, });
    }

    const guestCount = parsed.data.guestCount ?? 1;
    const now = parsed.data.startAt ? new Date(parsed.data.startAt) : new Date();

    const result = evaluatePriceRule(parsed.data.definition, {
      bookingHours: parsed.data.bookingHours,
      now,
      variableOverrides: { guest_count: guestCount, },
    });

    const formulaAlreadyHandlesGuests = result.usedVariables.includes('guest_count');
    const guestMultiplier = formulaAlreadyHandlesGuests ? 1 : guestCount;
    const totalPrice = result.price !== null
      ? result.price * guestMultiplier
      : null;

    return NextResponse.json({
      data: {
        price: totalPrice,
        unitPrice: result.price,
        branch: result.branch,
        appliedExpression: result.appliedExpression,
        conditionsSatisfied: result.conditionsSatisfied,
        usedVariables: result.usedVariables,
        guestMultiplierApplied: !formulaAlreadyHandlesGuests,
      },
    });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    if (error instanceof Error) {
      return NextResponse.json({
        error: error.message,
        data: {
          price: null,
          unitPrice: null,
          branch: null,
          appliedExpression: null,
          conditionsSatisfied: false,
          usedVariables: [],
          guestMultiplierApplied: false,
        },
      }, { status: 400, });
    }
    console.error('Failed to evaluate pricing rule', error);
    return NextResponse.json({ error: 'Unable to evaluate pricing rule.', }, { status: 500, });
  }
}
