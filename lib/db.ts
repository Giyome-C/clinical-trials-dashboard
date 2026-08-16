import { PrismaClient } from "@prisma/client";

// Standard Next.js/Prisma singleton so hot-reload in dev (and repeated
// serverless invocations sharing a warm container) don't spawn a new
// connection pool every time this module is imported.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
