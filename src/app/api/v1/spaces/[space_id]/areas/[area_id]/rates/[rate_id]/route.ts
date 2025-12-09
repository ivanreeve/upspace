import { NextRequest, NextResponse } from 'next/server';

const gone = () => NextResponse.json(
  { error: 'Base rates have been removed. Use pricing rules instead.', },
  { status: 410, }
);

export async function PUT(_req: NextRequest) {
  return gone();
}

export async function DELETE(_req: NextRequest) {
  return gone();
}
