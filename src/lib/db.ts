import { PrismaClient } from '@prisma/client'
import { after } from 'next/server'

function scheduleWebPushFlush() {
  try {
    after(async () => {
      const { flushWebPushOutbox } = await import('@/lib/web-push')
      await flushWebPushOutbox()
    })
  } catch {
    // Les scripts hors requête laissent l'outbox persistante au prochain passage.
  }
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  }).$extends({
    query: {
      notification: {
        async $allOperations({ operation, args, query }) {
          const result = await query(args)
          if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn' || operation === 'upsert') {
            scheduleWebPushFlush()
          }
          return result
        },
      },
      teacherNotification: {
        async $allOperations({ operation, args, query }) {
          const result = await query(args)
          if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn' || operation === 'upsert') {
            scheduleWebPushFlush()
          }
          return result
        },
      },
    },
  })
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined
}

const extendedDb = globalForPrisma.prisma ?? createPrismaClient()

// L'extension ne change pas le contrat des modèles. Conserver le type public
// PrismaClient garantit la compatibilité avec les fonctions recevant un
// TransactionClient, tandis que les hooks d'outbox restent actifs à l'exécution.
export const db = extendedDb as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = extendedDb
