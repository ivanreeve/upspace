import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import type { PriceRuleDefinition, PriceRuleRecord } from '@/lib/pricing-rules';
import { priceRuleSchema } from '@/lib/pricing-rules';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const serializePriceRule = (rule: PrismaPriceRuleRow): PriceRuleRecord => ({
  id: rule.id,
  name: rule.name,
  description: rule.description ?? null,
  definition: rule.definition as PriceRuleDefinition,
  linked_area_count: rule._count?.area ?? 0,
  created_at: rule.created_at instanceof Date ? rule.created_at.toISOString() : String(rule.created_at),
  updated_at: rule.updated_at instanceof Date ? rule.updated_at.toISOString() : null,
});

type PrismaPriceRuleRow = Prisma.price_ruleGetPayload<{
  include: { _count: { select: { area: true } } };
}>;

type RouteParams = {
  params: {
    space_id?: string;
  };
};

export async function GET(_req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be a valid UUID.', }, { status: 400, });
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

    const rules = await prisma.price_rule.findMany({
      where: { space_id: spaceIdParam, },
      orderBy: { created_at: 'asc', },
      include: { _count: { select: { area: true, }, }, },
    });

    return NextResponse.json({ data: rules.map((rule) => serializePriceRule(rule)), });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to list pricing rules', error);
    return NextResponse.json({ error: 'Unable to load pricing rules.', }, { status: 500, });
  }
}

export async function POST(req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const spaceIdParam = params?.space_id;

    if (!isUuid(spaceIdParam)) {
      return NextResponse.json({ error: 'space_id must be a valid UUID.', }, { status: 400, });
    }

    const body = await req.json().catch(() => null);
    const parsed = priceRuleSchema.safeParse(body);

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

    const createdRule = await prisma.price_rule.create({
      data: {
        space_id: spaceIdParam,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() ?? null,
        definition: parsed.data.definition,
      },
      include: { _count: { select: { area: true, }, }, },
    });

    return NextResponse.json({ data: serializePriceRule(createdRule), }, { status: 201, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to create pricing rule', error);
    return NextResponse.json({ error: 'Unable to save pricing rule.', }, { status: 500, });
  }
}
