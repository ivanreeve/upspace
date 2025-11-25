import { common_comment } from '@prisma/client';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type EnumRow = {
  value: string | null;
};

const normalizeEnumValue = (value: string) => value.replace(/[\s-]+/g, '_');
const formatEnumLabel = (value: string) => value.replace(/_/g, ' ');

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<EnumRow[]>`
      SELECT unnest(enum_range(NULL::common_comment)) AS value;
    `;

    const validValues = new Set(Object.values(common_comment));

    const tags = rows
      .map((row) => {
        if (!row.value) return null;

        const normalizedValue = normalizeEnumValue(row.value);
        if (!validValues.has(normalizedValue)) return null;

        return {
          value: normalizedValue,
          label: formatEnumLabel(row.value),
        };
      })
      .filter((tag): tag is { value: string; label: string } => Boolean(tag));

    return NextResponse.json({ data: tags, });
  } catch (error) {
    console.error('Failed to fetch common review tags', error);
    return NextResponse.json(
      { error: 'Failed to fetch review tags.', },
      { status: 500, }
    );
  }
}
