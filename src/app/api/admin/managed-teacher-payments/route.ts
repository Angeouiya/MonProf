import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import {
  ManagedCourseError,
  recordManagedTeacherPayment,
  reverseManagedTeacherPayment,
} from "@/lib/managed-courses";
import {
  managedBody,
  managedError,
  managedGuard,
  managedMoneySchema,
  managedResponse,
} from "@/lib/managed-courses-http";
export async function POST(request: Request) {
  try {
    managedGuard(request);
    const admin = await requireAdminApi("FINANCE_MANAGE");
    if (!admin) throw new ManagedCourseError("Accès refusé.", 403);
    const body = z
      .union([
        managedMoneySchema
          .extend({
            teacherId: z.string().min(1).max(100),
            note: z.string().trim().min(10).max(500),
            confirmedPaid: z.literal(true),
          })
          .strict(),
        z
          .object({
            action: z.literal("REVERSE_PAYMENT"),
            teacherId: z.string().min(1).max(100),
            entryId: z.string().min(1).max(100),
            note: z.string().trim().min(10).max(500),
            confirmedCorrection: z.literal(true),
            idempotencyKey: z.string().uuid(),
          })
          .strict(),
      ])
      .parse(await managedBody(request));
    return managedResponse(
      "action" in body
        ? await reverseManagedTeacherPayment(
            body.teacherId,
            body.entryId,
            body.note,
            admin.id,
          )
        : await recordManagedTeacherPayment(body.teacherId, body, admin.id),
    );
  } catch (error) {
    return managedError(error);
  }
}
