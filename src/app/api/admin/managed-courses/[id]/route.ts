import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import { hasAdminPermission } from "@/lib/admin-permissions";
import {
  cancelManagedOffer,
  cancelManagedSessions,
  completeManagedSession,
  createManagedContractLink,
  ManagedCourseError,
  offerManagedDossier,
  recordManagedReceipt,
  refundManagedCancelledSessions,
  rescheduleManagedSession,
  reverseManagedReceipt,
  reviseManagedPrice,
  setManagedHold,
} from "@/lib/managed-courses";
import {
  managedBody,
  managedError,
  managedGuard,
  managedMoneySchema,
  managedResponse,
} from "@/lib/managed-courses-http";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("OFFER"),
      teacherId: z.string().min(1).max(100),
      commissionPercent: z.number().int().min(20).max(30),
    })
    .strict(),
  z.object({ action: z.literal("CONTRACT_LINK") }).strict(),
  z
    .object({
      action: z.literal("VALIDATE"),
      sessionId: z.string().min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("RESCHEDULE"),
      sessionId: z.string().min(1).max(100),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().max(5),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("RELEASE"),
      offerId: z.string().min(1).max(100),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("REPRICE"),
      unitPrice: z.number().int().min(100).max(1_000_000),
      note: z.string().trim().min(10).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("HOLD"),
      onHold: z.boolean(),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("CANCEL_SESSIONS"),
      sessionIds: z.array(z.string().min(1).max(100)).min(1).max(24),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
  managedMoneySchema
    .extend({
      action: z.literal("REFUND"),
      note: z.string().trim().min(10).max(500),
      confirmedPaid: z.literal(true),
    })
    .strict(),
  managedMoneySchema
    .omit({ amount: true })
    .extend({
      action: z.literal("REVERSE_RECEIPT"),
      receiptId: z.string().min(1).max(100),
      note: z.string().trim().min(10).max(500),
      confirmedCorrection: z.literal(true),
    })
    .strict(),
  managedMoneySchema
    .extend({
      action: z.literal("RECEIPT"),
      receivedAt: z
        .string()
        .datetime()
        .refine(
          (value) => new Date(value).getTime() <= Date.now(),
          "Un encaissement ne peut pas être futur.",
        ),
    })
    .strict(),
]);
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    managedGuard(request);
    const body = schema.parse(await managedBody(request));
    const financeAction = [
      "RECEIPT",
      "REFUND",
      "REVERSE_RECEIPT",
      "HOLD",
      "CANCEL_SESSIONS",
    ].includes(body.action);
    const admin = await requireAdminApi(
      financeAction ? "FINANCE_MANAGE" : "BOOKINGS_MANAGE",
    );
    if (!admin) throw new ManagedCourseError("Accès refusé.", 403);
    if (
      body.action === "REPRICE" &&
      !hasAdminPermission(admin.permissions, "FINANCE_MANAGE")
    )
      throw new ManagedCourseError(
        "Autorisation finance requise pour un tarif exceptionnel.",
        403,
      );
    if (
      ["HOLD", "CANCEL_SESSIONS"].includes(body.action) &&
      !hasAdminPermission(admin.permissions, "BOOKINGS_MANAGE")
    )
      throw new ManagedCourseError(
        "Autorisations dossiers et finance requises.",
        403,
      );
    const { id } = await context.params;
    const result =
      body.action === "OFFER"
        ? await offerManagedDossier(
            id,
            body.teacherId,
            body.commissionPercent,
            admin.id,
          )
        : body.action === "CONTRACT_LINK"
          ? await createManagedContractLink(id, admin.id)
          : body.action === "VALIDATE"
            ? await completeManagedSession(id, body.sessionId, admin.id, true)
            : body.action === "RELEASE"
              ? await cancelManagedOffer(
                  body.offerId,
                  admin.id,
                  true,
                  body.reason,
                )
              : body.action === "RESCHEDULE"
                ? await rescheduleManagedSession(
                    id,
                    body.sessionId,
                    body.date,
                    body.time,
                    body.reason,
                    admin.id,
                  )
                : body.action === "REPRICE"
                  ? await reviseManagedPrice(
                      id,
                      body.unitPrice,
                      body.note,
                      admin.id,
                    )
                  : body.action === "HOLD"
                    ? await setManagedHold(
                        id,
                        body.onHold,
                        body.reason,
                        admin.id,
                      )
                    : body.action === "CANCEL_SESSIONS"
                      ? await cancelManagedSessions(
                          id,
                          body.sessionIds,
                          body.reason,
                          admin.id,
                        )
                      : body.action === "REFUND"
                        ? await refundManagedCancelledSessions(
                            id,
                            {
                              amount: body.amount,
                              method: body.method,
                              reference: body.reference,
                              idempotencyKey: body.idempotencyKey,
                              note: body.note,
                            },
                            admin.id,
                          )
                        : body.action === "REVERSE_RECEIPT"
                          ? await reverseManagedReceipt(
                              id,
                              body.receiptId,
                              {
                                method: body.method,
                                reference: body.reference,
                                idempotencyKey: body.idempotencyKey,
                                note: body.note,
                              },
                              admin.id,
                            )
                          : await recordManagedReceipt(id, body, admin.id);
    return managedResponse(result);
  } catch (error) {
    return managedError(error);
  }
}
