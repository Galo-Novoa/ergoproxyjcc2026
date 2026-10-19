import 'server-only'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/lib/generated/prisma/client'

const globalForDb = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  })
  return new PrismaClient({ adapter })
}

// Una única instancia compartida entre Better Auth y la app (se reutiliza en HMR).
export const db = globalForDb.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForDb.prisma = db
