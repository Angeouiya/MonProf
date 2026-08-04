export const CLIENT_DELETED_DRAFT_REASON = "DRAFT_DELETED_BY_CLIENT";

export function isClientDeletedDraft(booking: {
  status?: string | null;
  cancellationReason?: string | null;
}) {
  return booking.status === "CANCELLED"
    && booking.cancellationReason === CLIENT_DELETED_DRAFT_REASON;
}
