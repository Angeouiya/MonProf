import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { after } from 'next/server'
import { AsyncLocalStorage } from 'node:async_hooks'

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
  const cloudflareDatabase = cloudflareRuntime
    ? normalizeCloudflareDatabaseUrl(connectionString)
    : null

  const client = cloudflareRuntime
    ? new PrismaClient({
        adapter: new PrismaPg({
          connectionString: cloudflareDatabase!.connectionString,
          // A single authenticated dashboard renders several independent
          // queries. Cloudflare recommends at most five connections per
          // Worker invocation; Hyperdrive pools the origin connections.
          max: 5,
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 8_000,
          query_timeout: 15_000,
          statement_timeout: 15_000,
          idle_in_transaction_session_timeout: 15_000,
        }, cloudflareDatabase!.schema ? { schema: cloudflareDatabase!.schema } : undefined),
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

function normalizeCloudflareDatabaseUrl(value?: string) {
  const fallbackDatabaseUrl = new URL(requireDatabaseUrl(value))
  const hyperdriveConnectionString = getHyperdriveConnectionString()
  const databaseUrl = new URL(hyperdriveConnectionString || fallbackDatabaseUrl.toString())
  const schema = process.env.DATABASE_SCHEMA?.trim()
    || fallbackDatabaseUrl.searchParams.get('schema')?.trim()
    || undefined

  // Ces options sont comprises par le moteur Prisma natif mais pas utiles au
  // pilote `pg` du runtime Workers. Le mode libpq conserve TLS avec le pooler
  // Supabase sans exiger sa chaîne de certificat auto-signée.
  databaseUrl.searchParams.delete('pgbouncer')
  databaseUrl.searchParams.delete('connection_limit')
  databaseUrl.searchParams.delete('schema')
  if (databaseUrl.searchParams.get('sslmode')?.toLowerCase() === 'require') {
    databaseUrl.searchParams.set('uselibpqcompat', 'true')
  }

  return {
    connectionString: databaseUrl.toString(),
    schema,
  }
}

function getHyperdriveConnectionString() {
  try {
    const context = getCloudflareContext()
    const binding = (context.env as unknown as {
      HYPERDRIVE?: { connectionString?: string }
    }).HYPERDRIVE
    return binding?.connectionString?.trim() || null
  } catch {
    // Le build et les scripts locaux n'ont pas de contexte Workers. Ils
    // continuent d'utiliser DATABASE_URL, tandis que le Worker utilise
    // obligatoirement Hyperdrive dès que le binding est présent.
    return null
  }
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>

const databaseRequestContextKey = Symbol.for('competence.prisma.request-context')
const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined
}
const databaseRuntimeGlobal = globalThis as typeof globalThis & Record<PropertyKey, unknown>

// OpenNext bundles the entrypoint and the Next.js server function separately.
// Symbol.for + globalThis makes both module copies share the same request
// context without sharing the Prisma client itself across requests.
const requestDatabase = (
  databaseRuntimeGlobal[databaseRequestContextKey] as AsyncLocalStorage<AppPrismaClient> | undefined
) ?? new AsyncLocalStorage<AppPrismaClient>()
databaseRuntimeGlobal[databaseRequestContextKey] = requestDatabase

function getFallbackDatabase() {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient()
  return globalForPrisma.prisma
}

/**
 * Cloudflare Workers must not reuse a pg/Prisma client across invocations.
 * The wrapper installs one client for the duration of the current request;
 * all existing `db.*` imports transparently resolve to that request client.
 */
export function runWithDatabaseRequestContext<T>(callback: () => T): T {
  const existing = requestDatabase.getStore()
  if (existing) return callback()
  return requestDatabase.run(createPrismaClient(), callback)
}

const databaseProxy = new Proxy({} as AppPrismaClient, {
  get(_target, property) {
    const client = requestDatabase.getStore() ?? getFallbackDatabase()
    const value = Reflect.get(client, property)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

// L'extension ne change pas le contrat des modèles. Conserver le type public
// PrismaClient garantit la compatibilité avec les fonctions recevant un
// TransactionClient, tandis que les hooks d'outbox restent actifs à l'exécution.
export const db = databaseProxy as unknown as PrismaClient
