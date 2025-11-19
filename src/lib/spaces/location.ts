import type { Prisma } from '@prisma/client';

const SRID = 4326;

type SpaceLocationParams = {
  spaceId: string;
  lat: number;
  long: number;
};

export async function updateSpaceLocationPoint(
  tx: Prisma.TransactionClient,
  params: SpaceLocationParams
) {
  const { spaceId, lat, long, } = params;
  const normalizedLat = Number(lat);
  const normalizedLong = Number(long);

  if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLong)) {
    throw new Error('Latitude and longitude must be finite numbers to build a PostGIS point.');
  }

  await tx.$executeRaw`
    UPDATE "space"
    SET location = ST_SetSRID(ST_MakePoint(${normalizedLong}, ${normalizedLat}), ${SRID})
    WHERE id = ${spaceId}
  `;
}
