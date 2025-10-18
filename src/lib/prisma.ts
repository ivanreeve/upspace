/* Use require at runtime to avoid a compile-time missing-export error in some setups */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis as unknown as { prisma: any };

export const prisma = 
    globalForPrisma.prisma || 
    new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;