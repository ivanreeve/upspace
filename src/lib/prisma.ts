import type { PrismaClient as PrismaClientType } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

async function getPrisma() {
  if (!globalForPrisma.prisma) {
    const { PrismaClient, } = await import('@prisma/client');
    globalForPrisma.prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'], });
  }
  return globalForPrisma.prisma;
}

export const prisma = await getPrisma();
