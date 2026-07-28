import "server-only";

import { db } from "@/lib/db";

/** Empêche une retenue de modifier un solde déjà figé dans un DRAFT Jèko. */
export async function hasActiveJekoPayoutReservation(teacherId: string, bookingId?: string | null) {
  return Boolean(await db.teacherPayoutRecord.findFirst({
    where: {
      teacherId,
      provider: "JEKO",
      status: "DRAFT",
      ...(bookingId ? { allocations: { some: { bookingId } } } : {}),
    },
    select: { id: true },
  }));
}
