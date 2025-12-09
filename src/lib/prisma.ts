import { createHash } from 'node:crypto';

import type { Prisma as PrismaNamespace, PrismaClient as PrismaClientType } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
  schemaHash?: string;
};

function getSchemaHash(Prisma: typeof PrismaNamespace) {
  const dmmfString = JSON.stringify(Prisma.dmmf.datamodel);
  return createHash('sha256').update(dmmfString).digest('hex');
}

async function getPrisma() {
  const {
    PrismaClient,
    Prisma,
  } = await import('@prisma/client');
  const schemaHash = getSchemaHash(Prisma);

  if (!globalForPrisma.prisma || globalForPrisma.schemaHash !== schemaHash) {
    globalForPrisma.prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'], });
    globalForPrisma.schemaHash = schemaHash;
  }

  return globalForPrisma.prisma;
}

export const prisma = await getPrisma();
