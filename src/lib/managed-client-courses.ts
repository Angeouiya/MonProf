import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type ClientSession = {
  id: string; sequence: number; scheduledDate: Date; scheduledTime: string;
  status: string; parentConfirmedAt: Date | null;
  teacher: { fullName: string; phone: string | null } | null;
};
type ClientDossier = {
  id: string; reference: string; subjectName: string; className: string;
  totalPrice: number; cancelledAmount: number; receivedAmount: number; onHold: boolean;
  sessions: ClientSession[];
};
type RawDossier = Omit<ClientDossier, "sessions"> & {
  sessions: (Omit<ClientSession, "scheduledDate" | "parentConfirmedAt"> & {
    scheduledDate: string; parentConfirmedAt: string | null;
  })[];
};

// Keep the client predicate inside the limited subquery, before either join.
// Prisma.sql binds every identifier VALUE; table/column names are static.
// No cross-request cache and no private fields beyond the previous projection.
export function managedClientCourseQuery(clientId: string, cursor?: { createdAt: Date; id: string } | null) {
  return Prisma.sql`
    SELECT p.id, p.reference, p."subjectName", p."className", p."totalPrice",
      p."cancelledAmount", p."receivedAmount", p."onHold",
      COALESCE(lessons.sessions, '[]'::jsonb) AS sessions
    FROM (
      SELECT d.id, d.reference, d."subjectName", d."className", d."totalPrice",
        d."cancelledAmount", d."receivedAmount", d."onHold", d."createdAt"
      FROM competence."ManagedCourseDossier" d
      WHERE d."clientId" = ${clientId}
        ${cursor ? Prisma.sql`AND (d."createdAt", d.id) < (${cursor.createdAt}, ${cursor.id})` : Prisma.empty}
      ORDER BY d."createdAt" DESC, d.id DESC LIMIT 21
    ) p
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'sequence', s.sequence,
        'scheduledDate', to_char(s."scheduledDate", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'scheduledTime', s."scheduledTime", 'status', s.status,
        'parentConfirmedAt', to_char(s."parentConfirmedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'teacher', CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('fullName', t."fullName", 'phone', t.phone) END
      ) ORDER BY s.sequence) AS sessions
      FROM competence."ManagedCourseSession" s
      LEFT JOIN competence."Teacher" t ON t.id = s."teacherId"
      WHERE s."dossierId" = p.id
    ) lessons ON TRUE
    ORDER BY p."createdAt" DESC, p.id DESC
  `;
}

export async function getManagedClientCourses(clientId: string, after?: string): Promise<ClientDossier[]> {
  if (!clientId) return [];
  const cursor = after ? await db.managedCourseDossier.findFirst({
    where: { clientId, id: after }, select: { id: true, createdAt: true },
  }) : null;
  const rows = await db.$queryRaw<RawDossier[]>(managedClientCourseQuery(clientId, cursor));
  return rows.map((row) => ({ ...row, sessions: row.sessions.map((session) => ({
    ...session, scheduledDate: new Date(session.scheduledDate),
    parentConfirmedAt: session.parentConfirmedAt ? new Date(session.parentConfirmedAt) : null,
  })) }));
}
