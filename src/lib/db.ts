import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { after } from 'next/server'

function scheduleWebPushFlush() {
  try {
    after(async () => {
      const { publishWebPushFlushEvent } = await import('@/lib/web-push-queue')
      const queued = await publishWebPushFlushEvent('outbox_created')
      if (!queued.queued) {
        const { flushWebPushOutbox } = await import('@/lib/web-push')
        await flushWebPushOutbox(100)
      }
    })
  } catch {
    // Les scripts hors requête laissent l'outbox persistante au prochain passage.
  }
}

function createPrismaClient() {
  const log = process.env.NODE_ENV === 'production' ? ['error'] as const : ['error', 'warn'] as const
  const cloudflareRuntime = process.env.APP_DEPLOYMENT_PLATFORM === 'cloudflare'
    || Boolean(process.env.CLOUDFLARE_ENV)
  const connectionString = process.env.DATABASE_URL?.trim()

  const client = cloudflareRuntime
    ? new PrismaClient({
        adapter: new PrismaPg({
          connectionString: requireDatabaseUrl(connectionString),
          max: 1,
          maxUses: 1,
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 10_000,
        }),
        log: [...log],
      })
    : new PrismaClient({ log: [...log] })

  return client.$extends({
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

function requireDatabaseUrl(value?: string) {
  if (value) return value
  throw new Error('DATABASE_URL est obligatoire pour le runtime Cloudflare.')
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
