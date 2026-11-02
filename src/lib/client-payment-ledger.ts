import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const CLIENT_PAYMENT_PAGE_SIZE = 30;

type LedgerPageRow = {
  id: string | null;
  totalCount: bigint;
  totalSpent: bigint;
  totalBlocked: bigint;
  totalRefunded: bigint;
};

/**
 * Résumé calculé en base sur les paiements réellement prouvés. Les lignes
 * envoyées au navigateur restent limitées à une page, même pour un client
 * avec un très long historique.
 */
export async function getClientPaymentLedgerPage(clientId: string, page: number) {
  const offset = (page - 1) * CLIENT_PAYMENT_PAGE_SIZE;
  const rows = await db.$queryRaw<LedgerPageRow[]>(Prisma.sql`
    WITH verified_bookings AS (
      SELECT b."id"
      FROM competence."Booking" b
      WHERE b."clientId" = ${clientId}
        AND b."paymentStatus" IN (
          'RECEIVED', 'BLOCKED', 'VALIDATED', 'TO_PAY_TEACHER', 'TEACHER_PAID',
          'DISPUTED', 'REFUND_PENDING', 'PARTIAL_REFUND_PENDING',
          'PARTIALLY_REFUNDED', 'REFUNDED', 'RETAINED'
        )
        AND (
          (b."paydunyaStatus" = 'COMPLETED' AND b."paydunyaVerifiedAt" IS NOT NULL)
          OR (b."paymentProvider" = 'JEKO' AND b."providerPaymentStatus" = 'SUCCESS' AND b."paymentVerifiedAt" IS NOT NULL)
        )
        AND EXISTS (
          SELECT 1 FROM competence."Transaction" proof
          WHERE proof."bookingId" = b."id"
            AND proof."type" = 'CLIENT_PAYMENT'
            AND proof."status" IN (
              'RECEIVED', 'BLOCKED', 'VALIDATED', 'TO_PAY_TEACHER', 'TEACHER_PAID',
              'DISPUTED', 'REFUND_PENDING', 'PARTIAL_REFUND_PENDING',
              'PARTIALLY_REFUNDED', 'REFUNDED', 'RETAINED'
            )
            AND proof."amount" > 0
            AND proof."amount" = CASE WHEN b."totalClientPays" > 0 THEN b."totalClientPays" ELSE b."totalPrice" END
        )
    ), ledger AS (
      SELECT tr."id", tr."type", tr."status", tr."amount", tr."createdAt"
      FROM competence."Transaction" tr
      JOIN verified_bookings b ON b."id" = tr."bookingId"
      WHERE tr."type" IN ('CLIENT_PAYMENT', 'RESCHEDULE_FEE', 'REFUND')
    ), totals AS (
      SELECT
        COUNT(*)::bigint AS "totalCount",
        COALESCE(SUM("amount") FILTER (WHERE "type" IN ('CLIENT_PAYMENT', 'RESCHEDULE_FEE')), 0)::bigint AS "totalSpent",
        COALESCE(SUM("amount") FILTER (WHERE "type" IN ('CLIENT_PAYMENT', 'RESCHEDULE_FEE') AND "status" = 'BLOCKED'), 0)::bigint AS "totalBlocked",
        COALESCE(SUM("amount") FILTER (WHERE "type" = 'REFUND'), 0)::bigint AS "totalRefunded"
      FROM ledger
    ), payment_page AS (
      SELECT "id", "createdAt" FROM ledger
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${CLIENT_PAYMENT_PAGE_SIZE} OFFSET ${offset}
    )
    SELECT p."id", t."totalCount", t."totalSpent", t."totalBlocked", t."totalRefunded"
    FROM totals t LEFT JOIN payment_page p ON true
    ORDER BY p."createdAt" DESC NULLS LAST, p."id" DESC
  `);

  const summary = rows[0];
  return {
    ids: rows.flatMap((row) => row.id ? [row.id] : []),
    totalCount: Number(summary?.totalCount ?? 0),
    totalSpent: Number(summary?.totalSpent ?? 0),
    totalBlocked: Number(summary?.totalBlocked ?? 0),
    totalRefunded: Number(summary?.totalRefunded ?? 0),
  };
}
