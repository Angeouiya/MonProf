import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CLIENT_DELETED_DRAFT_REASON } from "@/lib/booking-draft-deletion";
import { VERIFIED_CLIENT_FUND_STATUS_VALUES } from "@/lib/payment-security";

export const CLIENT_RESERVATION_PAGE_SIZE = 20;
export type ClientReservationTab = "all" | "actions" | "history";

type ReservationIndexRow = {
  id: string | null;
  priorityId: string | null;
  allCount: bigint;
  actionCount: bigint;
  historyCount: bigint;
  filteredCount: bigint;
};

/**
 * Une page de références et des compteurs exacts, sans envoyer tout
 * l'historique (ni toutes ses relations) au rendu Next.js.
 */
export async function getClientReservationIndex(input: {
  clientId: string;
  tab: ClientReservationTab;
  page: number;
  search: string;
}) {
  const page = Math.max(1, Math.min(10_000, Math.trunc(input.page) || 1));
  const search = input.search.trim().slice(0, 100);
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const offset = (page - 1) * CLIENT_RESERVATION_PAGE_SIZE;
  const fundStatuses = Prisma.join(VERIFIED_CLIENT_FUND_STATUS_VALUES);
  const rows = await db.$queryRaw<ReservationIndexRow[]>(Prisma.sql`
    WITH scoped AS MATERIALIZED (
      SELECT
        b."id", b."createdAt", b."status"::text AS "status",
        b."paymentStatus"::text AS "paymentStatus",
        b."reference", b."subjectName", b."levelName", b."teacherId",
        COALESCE((
          b."paymentStatus"::text IN (${fundStatuses})
          AND (
            (UPPER(BTRIM(COALESCE(b."paydunyaStatus", ''))) = 'COMPLETED' AND b."paydunyaVerifiedAt" IS NOT NULL)
            OR (b."paymentProvider"::text = 'JEKO' AND UPPER(BTRIM(COALESCE(b."providerPaymentStatus", ''))) = 'SUCCESS' AND b."paymentVerifiedAt" IS NOT NULL)
          )
          AND EXISTS (
            SELECT 1 FROM competence."Transaction" proof
            WHERE proof."bookingId" = b."id"
              AND proof."type"::text = 'CLIENT_PAYMENT'
              AND proof."status"::text IN (${fundStatuses})
              AND proof."amount" > 0
              AND proof."amount" = CASE WHEN b."totalClientPays" > 0 THEN b."totalClientPays" ELSE b."totalPrice" END
          )
        ), false) AS "verified"
      FROM competence."Booking" b
      WHERE b."clientId" = ${input.clientId}
        AND (
          b."cancellationReason" IS NULL
          OR b."cancellationReason" <> ${CLIENT_DELETED_DRAFT_REASON}
          OR b."paymentStatus"::text <> 'FAILED'
        )
    ), totals AS (
      SELECT
        COUNT(*)::bigint AS "allCount",
        COUNT(*) FILTER (WHERE
          ("status" = 'PENDING_PAYMENT' AND NOT "verified")
          OR ("status" = 'PENDING_CLIENT_VALIDATION' AND "verified")
          OR ("paymentStatus" = 'FAILED' AND "status" NOT IN ('CANCELLED', 'REFUNDED', 'DISPUTED'))
        )::bigint AS "actionCount",
        COUNT(*) FILTER (WHERE "status" IN (
          'VALIDATED_BY_CLIENT', 'TEACHER_PAID', 'CANCELLED', 'REFUNDED', 'DISPUTED'
        ))::bigint AS "historyCount"
      FROM scoped
    ), filtered AS (
      SELECT "id", "createdAt" FROM scoped
      WHERE (
        ${input.tab} = 'all'
        OR (${input.tab} = 'actions' AND (
          ("status" = 'PENDING_PAYMENT' AND NOT "verified")
          OR ("status" = 'PENDING_CLIENT_VALIDATION' AND "verified")
          OR ("paymentStatus" = 'FAILED' AND "status" NOT IN ('CANCELLED', 'REFUNDED', 'DISPUTED'))
        ))
        OR (${input.tab} = 'history' AND "status" IN (
          'VALIDATED_BY_CLIENT', 'TEACHER_PAID', 'CANCELLED', 'REFUNDED', 'DISPUTED'
        ))
      )
      AND (
        ${search} = ''
        OR "reference" ILIKE ${pattern} ESCAPE '\'
        OR "subjectName" ILIKE ${pattern} ESCAPE '\'
        OR "levelName" ILIKE ${pattern} ESCAPE '\'
        OR EXISTS (
          SELECT 1 FROM competence."Teacher" t
          WHERE t."id" = "teacherId"
            AND (t."fullName" ILIKE ${pattern} ESCAPE '\'
              OR t."professionalName" ILIKE ${pattern} ESCAPE '\')
        )
      )
    ), filtered_total AS (
      SELECT COUNT(*)::bigint AS "filteredCount" FROM filtered
    ), priority AS (
      SELECT "id" AS "priorityId" FROM scoped
      WHERE ("status" = 'PENDING_CLIENT_VALIDATION' AND "verified")
        OR ("status" = 'PENDING_PAYMENT' AND NOT "verified")
        OR ("paymentStatus" = 'FAILED' AND "status" NOT IN ('CANCELLED', 'REFUNDED', 'DISPUTED'))
      ORDER BY ("status" = 'PENDING_CLIENT_VALIDATION') DESC, "createdAt" DESC
      LIMIT 1
    ), reservation_page AS (
      SELECT "id", "createdAt" FROM filtered
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${CLIENT_RESERVATION_PAGE_SIZE} OFFSET ${offset}
    )
    SELECT p."id", priority."priorityId", totals."allCount", totals."actionCount",
      totals."historyCount", filtered_total."filteredCount"
    FROM totals CROSS JOIN filtered_total
    LEFT JOIN priority ON true
    LEFT JOIN reservation_page p ON true
    ORDER BY p."createdAt" DESC NULLS LAST, p."id" DESC
  `);

  const first = rows[0];
  return {
    ids: rows.flatMap((row) => row.id ? [row.id] : []),
    priorityId: first?.priorityId ?? null,
    allCount: Number(first?.allCount ?? 0),
    actionCount: Number(first?.actionCount ?? 0),
    historyCount: Number(first?.historyCount ?? 0),
    filteredCount: Number(first?.filteredCount ?? 0),
    page,
    search,
  };
}
