export type LocalTeacherPayoutStatus = "DRAFT" | "PAID" | "CANCELLED";
export type ProviderTeacherPayoutStatus = "pending" | "success" | "failed";
export type TeacherPayoutTransition = "wait" | "finalize" | "cancel" | "already" | "conflict";

/**
 * Pure lifecycle decision used by API, webhook reconciliation and tests.
 * Only DRAFT + provider success is allowed to mutate the teacher ledger.
 */
export function decideTeacherPayoutTransition(
  localStatus: string,
  providerStatus: ProviderTeacherPayoutStatus,
): TeacherPayoutTransition {
  if (localStatus === "DRAFT") {
    if (providerStatus === "success") return "finalize";
    if (providerStatus === "failed") return "cancel";
    return "wait";
  }
  if (localStatus === "PAID") {
    return providerStatus === "success" ? "already" : "conflict";
  }
  if (localStatus === "CANCELLED") {
    return providerStatus === "failed" ? "already" : "conflict";
  }
  return "conflict";
}
