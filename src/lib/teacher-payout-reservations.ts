import "server-only";

import { Prisma } from "@prisma/client";

function activeJekoPayoutReservationWhere(
  teacherId: string,
  bookingId?: string | null,
): Prisma.TeacherPayoutRecordWhereInput {
  return {
    teacherId,
    provider: "JEKO",
    status: "DRAFT",
    ...(bookingId ? { allocations: { some: { bookingId } } } : {}),
  };
}

/**
 * Mutex comptable commun aux créations de DRAFT Jèko et aux retenues APPLIED.
 * Toutes ces mutations doivent l'acquérir en première opération dans une
 * transaction Serializable, avant de relire le solde qu'elles vont modifier.
 */
export async function lockTeacherPayoutBalance(
  tx: Prisma.TransactionClient,
  teacherId: string,
) {
  const lockedTeacher = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Teacher"
    WHERE "id" = ${teacherId}
    FOR UPDATE
  `);

  if (lockedTeacher.length !== 1) {
    throw new Error("TEACHER_PAYOUT_LOCK_NOT_FOUND");
  }
}

export async function lockTeacherPayoutBalances(
  tx: Prisma.TransactionClient,
  teacherIds: Iterable<string>,
) {
  const orderedTeacherIds = [...new Set([...teacherIds].filter(Boolean))].sort();
  for (const teacherId of orderedTeacherIds) {
    await lockTeacherPayoutBalance(tx, teacherId);
  }
  return orderedTeacherIds;
}

/** Variante autoritative à appeler après lockTeacherPayoutBalance. */
export async function hasActiveJekoPayoutReservationInTransaction(
  tx: Prisma.TransactionClient,
  teacherId: string,
  bookingId?: string | null,
) {
  return Boolean(await tx.teacherPayoutRecord.findFirst({
    where: activeJekoPayoutReservationWhere(teacherId, bookingId),
    select: { id: true },
  }));
}
