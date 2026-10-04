import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { VERIFIED_CLIENT_FUND_STATUS_VALUES } from "@/lib/payment-security";

export const CLIENT_COURSE_PAGE_SIZE = 20;
export type ClientCourseTab = "avenir" | "aconfirmer" | "termines";

type CourseIndexRow = {
  id: string | null;
  priorityId: string | null;
  upcomingCount: bigint;
  confirmationCount: bigint;
  completedCount: bigint;
  filteredCount: bigint;
};

/** Références et compteurs exacts : aucune liste complète de cours n'atteint le navigateur. */
export async function getClientCourseIndex(input: {
  clientId: string;
  tab: ClientCourseTab;
  page: number;
  search: string;
}) {
  const page = Math.max(1, Math.min(10_000, Math.trunc(input.page) || 1));
  const search = input.search.trim().slice(0, 100);
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const offset = (page - 1) * CLIENT_COURSE_PAGE_SIZE;
  const fundStatuses = Prisma.join(VERIFIED_CLIENT_FUND_STATUS_VALUES);

  const rows = await db.$queryRaw<CourseIndexRow[]>(Prisma.sql`
    WITH verified AS MATERIALIZED (
      SELECT b."id", b."createdAt", b."scheduledDate", b."startDate",
        b."status"::text AS "status", b."reference", b."subjectName",
        b."levelName", b."teacherId"
      FROM competence."Booking" b
      WHERE b."clientId" = ${input.clientId}
        AND b."isQuoteOnly" = false
        AND b."status"::text IN (
          'PAID', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_ADMIN_VALIDATION',
          'COURSE_DONE', 'PENDING_CLIENT_VALIDATION', 'VALIDATED_BY_CLIENT',
          'PAYMENT_TO_RELEASE', 'TEACHER_PAID'
        )
        AND b."paymentStatus"::text IN (${fundStatuses})
        AND (
          (UPPER(BTRIM(COALESCE(b."paydunyaStatus", ''))) = 'COMPLETED' AND b."paydunyaVerifiedAt" IS NOT NULL)
          OR (b."paymentProvider"::text = 'JEKO'
            AND UPPER(BTRIM(COALESCE(b."providerPaymentStatus", ''))) = 'SUCCESS'
            AND b."paymentVerifiedAt" IS NOT NULL)
        )
        AND EXISTS (
          SELECT 1 FROM competence."Transaction" proof
          WHERE proof."bookingId" = b."id"
            AND proof."type"::text = 'CLIENT_PAYMENT'
            AND proof."status"::text IN (${fundStatuses})
            AND proof."amount" > 0
            AND proof."amount" = CASE WHEN b."totalClientPays" > 0
              THEN b."totalClientPays" ELSE b."totalPrice" END
        )
    ), totals AS (
      SELECT
        COUNT(*) FILTER (WHERE "status" IN (
          'PAID', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_ADMIN_VALIDATION'
        ))::bigint AS "upcomingCount",
        COUNT(*) FILTER (WHERE "status" IN ('COURSE_DONE', 'PENDING_CLIENT_VALIDATION'))::bigint AS "confirmationCount",
        COUNT(*) FILTER (WHERE "status" IN (
          'VALIDATED_BY_CLIENT', 'PAYMENT_TO_RELEASE', 'TEACHER_PAID'
        ))::bigint AS "completedCount"
      FROM verified
    ), filtered AS (
      SELECT "id", "createdAt", "scheduledDate", "startDate" FROM verified
      WHERE (
        (${input.tab} = 'avenir' AND "status" IN (
          'PAID', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_ADMIN_VALIDATION'
        ))
        OR (${input.tab} = 'aconfirmer' AND "status" IN ('COURSE_DONE', 'PENDING_CLIENT_VALIDATION'))
        OR (${input.tab} = 'termines' AND "status" IN (
          'VALIDATED_BY_CLIENT', 'PAYMENT_TO_RELEASE', 'TEACHER_PAID'
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
      SELECT "id" AS "priorityId" FROM verified
      WHERE "status" = 'PENDING_CLIENT_VALIDATION'
      ORDER BY "createdAt" DESC LIMIT 1
    ), course_page AS (
      SELECT "id", "createdAt", "scheduledDate", "startDate" FROM filtered
      ORDER BY
        CASE WHEN ${input.tab} = 'avenir' THEN COALESCE("scheduledDate", "startDate") END ASC NULLS LAST,
        "createdAt" DESC, "id" DESC
      LIMIT ${CLIENT_COURSE_PAGE_SIZE} OFFSET ${offset}
    )
    SELECT p."id", priority."priorityId", totals."upcomingCount",
      totals."confirmationCount", totals."completedCount", filtered_total."filteredCount"
    FROM totals CROSS JOIN filtered_total
    LEFT JOIN priority ON true
    LEFT JOIN course_page p ON true
    ORDER BY
      CASE WHEN ${input.tab} = 'avenir' THEN COALESCE(p."scheduledDate", p."startDate") END ASC NULLS LAST,
      p."createdAt" DESC NULLS LAST, p."id" DESC
  `);

  const first = rows[0];
  return {
    ids: rows.flatMap((row) => row.id ? [row.id] : []),
    priorityId: first?.priorityId ?? null,
    upcomingCount: Number(first?.upcomingCount ?? 0),
    confirmationCount: Number(first?.confirmationCount ?? 0),
    completedCount: Number(first?.completedCount ?? 0),
    filteredCount: Number(first?.filteredCount ?? 0),
    page,
    search,
  };
}
