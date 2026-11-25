import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import { ManagedCourseError } from "@/lib/managed-course-error";
import {
  createManagedPartner,
  setManagedPartnerActive,
  recordManagedPartnerPayment,
  reverseManagedPartnerPayment,
} from "@/lib/managed-partners";
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
      action: z.literal("CREATE"),
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(32),
    })
    .strict(),
  z
    .object({
      action: z.literal("STATUS"),
      partnerId: z.string().min(1).max(100),
      active: z.boolean(),
    })
    .strict(),
  managedMoneySchema
    .extend({
      action: z.literal("PAYMENT"),
      partnerId: z.string().min(1).max(100),
      note: z.string().trim().min(10).max(500),
      confirmedPaid: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("REVERSE_PAYMENT"),
      partnerId: z.string().min(1).max(100),
      paymentId: z.string().min(1).max(100),
      note: z.string().trim().min(10).max(500),
      confirmedCorrection: z.literal(true),
    })
    .strict(),
]);
export async function POST(request: Request) {
  try {
    managedGuard(request, true);
    const admin = await requireAdminApi("FINANCE_MANAGE");
    if (!admin) throw new ManagedCourseError("Accès refusé.", 403);
    const body = schema.parse(await managedBody(request));
    return managedResponse(
      body.action === "CREATE"
        ? await createManagedPartner(
            { name: body.name, phone: body.phone },
            admin.id,
          )
        : body.action === "STATUS"
          ? await setManagedPartnerActive(body.partnerId, body.active, admin.id)
          : body.action === "PAYMENT"
            ? await recordManagedPartnerPayment(body.partnerId, body, admin.id)
            : await reverseManagedPartnerPayment(
                body.partnerId,
                body.paymentId,
                body.note,
                admin.id,
              ),
    );
  } catch (error) {
    return managedError(error);
  }
}
