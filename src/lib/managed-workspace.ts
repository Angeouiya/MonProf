import type { Prisma } from "@prisma/client";

export function managedProfessorOfferWhere(
  teacherId: string,
  history: boolean,
): Prisma.ManagedCourseOfferWhereInput {
  const active: Prisma.ManagedCourseOfferWhereInput = {
    OR: [
      { status: "OFFERED" },
      {
        status: { in: ["ACCEPTED", "CANCEL_REQUESTED", "PARTIAL_CANCELLED"] },
        sessions: { some: { status: { in: ["PLANNED", "DONE"] } } },
      },
    ],
  };
  return { teacherId, ...(history ? { NOT: active } : active) };
}

export function managedCanDeclareDone(
  session: { status: string; scheduledDate: Date; scheduledTime: string },
  onHold: boolean,
  now = Date.now(),
) {
  const end =
    Date.parse(
      `${session.scheduledDate.toISOString().slice(0, 10)}T${session.scheduledTime}:00Z`,
    ) +
    120 * 60_000;
  return (
    !onHold &&
    session.status === "PLANNED" &&
    Number.isFinite(end) &&
    end <= now
  );
}

export function managedStartsInFuture(
  session: { scheduledDate: Date; scheduledTime: string },
  now = Date.now(),
) {
  return (
    Date.parse(
      `${session.scheduledDate.toISOString().slice(0, 10)}T${session.scheduledTime}:00Z`,
    ) > now
  );
}

export function managedAvailableBalance(balance: number, held: number) {
  return Math.max(0, balance - Math.max(0, held));
}
