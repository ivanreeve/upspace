import { NextRequest, NextResponse } from 'next/server';

const gone = () => NextResponse.json(
  { error: 'Base rates have been removed. Use pricing rules instead.', },
  { status: 410, }
);

export async function GET(_req: NextRequest) {
  return gone();
}

export async function POST(_req: NextRequest) {
  return gone();
}
