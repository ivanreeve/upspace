import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

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
  params: Promise<{
    space_id: string;
    price_rule_id: string;
  }>;
};

export async function PUT(req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const resolvedParams = await params;
    const spaceIdParam = resolvedParams.space_id;
    const priceRuleIdParam = resolvedParams.price_rule_id;

    if (!isUuid(spaceIdParam) || !isUuid(priceRuleIdParam)) {
      return NextResponse.json({ error: 'space_id and price_rule_id must be valid UUIDs.', }, { status: 400, });
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

    const existingRule = await prisma.price_rule.findFirst({
      where: {
        id: priceRuleIdParam,
        space_id: spaceIdParam,
      },
      select: { id: true, },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Pricing rule not found.', }, { status: 404, });
    }

    const updatedRule = await prisma.price_rule.update({
      where: { id: priceRuleIdParam, },
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() ?? undefined,
        definition: parsed.data.definition,
        updated_at: new Date(),
      },
      include: { _count: { select: { area: true, }, }, },
    });

    return NextResponse.json({ data: serializePriceRule(updatedRule), });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to update pricing rule', error);
    return NextResponse.json({ error: 'Unable to update pricing rule.', }, { status: 500, });
  }
}

export async function DELETE(_req: NextRequest, { params, }: RouteParams) {
  try {
    const { userId, } = await requirePartnerSession();
    const resolvedParams = await params;
    const spaceIdParam = resolvedParams.space_id;
    const priceRuleIdParam = resolvedParams.price_rule_id;

    if (!isUuid(spaceIdParam) || !isUuid(priceRuleIdParam)) {
      return NextResponse.json({ error: 'space_id and price_rule_id must be valid UUIDs.', }, { status: 400, });
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

    const existingRule = await prisma.price_rule.findFirst({
      where: {
        id: priceRuleIdParam,
        space_id: spaceIdParam,
      },
      include: { _count: { select: { area: true, }, }, },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Pricing rule not found.', }, { status: 404, });
    }

    if (existingRule._count.area > 0) {
      return NextResponse.json({ error: 'This pricing rule is assigned to one or more areas. Remove it from all areas in this space before deleting it.', }, { status: 409, });
    }

    await prisma.price_rule.delete({ where: { id: priceRuleIdParam, }, });

    return new NextResponse(null, { status: 204, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json({ error: 'This pricing rule is assigned to one or more areas. Remove it from all areas in this space before deleting it.', }, { status: 409, });
    }
    console.error('Failed to delete pricing rule', error);
    return NextResponse.json({ error: 'Unable to delete pricing rule.', }, { status: 500, });
  }
}
