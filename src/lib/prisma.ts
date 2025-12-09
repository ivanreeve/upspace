import type { Prisma as PrismaNamespace, PrismaClient as PrismaClientType } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
  schemaHash?: string;
};

async function getSchemaHash(Prisma: typeof PrismaNamespace) {
  const dmmfString = JSON.stringify(Prisma.dmmf.datamodel);
  return hashString(dmmfString);
}

async function hashString(value: string) {
  const subtle = globalThis.crypto?.subtle;

  if (typeof subtle?.digest === 'function' && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(value);
    const digest = await subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  const { createHash, } = await import('crypto');
  return createHash('sha256').update(value).digest('hex');
}

async function getPrisma() {
  const {
    PrismaClient,
    Prisma,
  } = await import('@prisma/client');
  const schemaHash = await getSchemaHash(Prisma);

  if (!globalForPrisma.prisma || globalForPrisma.schemaHash !== schemaHash) {
    globalForPrisma.prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'], });
    globalForPrisma.schemaHash = schemaHash;
  }

  return globalForPrisma.prisma;
}

export const prisma = await getPrisma();
