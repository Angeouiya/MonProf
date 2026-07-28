import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required before the migration preflight.");
  process.exit(1);
}

const parsed = new URL(databaseUrl);
const schema = parsed.searchParams.get("schema") || "public";
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
  console.error("FAIL DATABASE_URL contains an unsafe PostgreSQL schema name.");
  process.exit(1);
}

const db = new PrismaClient();
const qualifiedTable = `"${schema}"."BookingRescheduleRequest"`;

try {
  const [{ tableName } = { tableName: null }] = await db.$queryRawUnsafe(
    `SELECT to_regclass('"${schema}"."BookingRescheduleRequest"')::text AS "tableName"`,
  );

  if (!tableName) {
    console.log("OK BookingRescheduleRequest does not exist yet; the empty database can be migrated.");
    process.exit(0);
  }

  const duplicates = await db.$queryRawUnsafe(`
    SELECT
      "bookingId",
      COUNT(*)::int AS "activeCount",
      ARRAY_AGG("id" ORDER BY "createdAt") AS "requestIds"
    FROM ${qualifiedTable}
    WHERE "status"::text IN ('PAYMENT_PENDING', 'PAYMENT_FAILED', 'AWAITING_TEACHER')
    GROUP BY "bookingId"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, "bookingId"
    LIMIT 25
  `);

  if (duplicates.length > 0) {
    console.error(
      "FAIL Active reschedule duplicates must be resolved before Prisma creates the one-active-request index.",
    );
    for (const duplicate of duplicates) {
      console.error(
        `FAIL bookingId=${duplicate.bookingId} activeCount=${duplicate.activeCount} requestIds=${duplicate.requestIds.join(",")}`,
      );
    }
    process.exit(1);
  }

  console.log("OK No booking has more than one active reschedule request.");
} catch (error) {
  console.error(
    `FAIL Migration preflight could not inspect active reschedules: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
} finally {
  await db.$disconnect();
}
