import { z } from "zod";
import { requireTeacherApi } from "@/lib/teacher-auth";
import {
  cancelManagedOffer,
  completeManagedSession,
  ManagedCourseError,
  respondManagedOffer,
} from "@/lib/managed-courses";
import {
  managedBody,
  managedError,
  managedGuard,
  managedResponse,
} from "@/lib/managed-courses-http";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("RESPOND"),
      offerId: z.string(),
      accept: z.boolean(),
      reason: z.string().trim().max(500).default(""),
      acceptedTerms: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("DONE"),
      dossierId: z.string(),
      sessionId: z.string(),
    })
    .strict(),
  z
    .object({
      action: z.literal("CANCEL"),
      offerId: z.string(),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
]);
export async function POST(request: Request) {
  try {
    managedGuard(request);
    const teacher = await requireTeacherApi();
    if (!teacher)
      throw new ManagedCourseError("Connexion professeur requise.", 401);
    const body = schema.parse(await managedBody(request));
    if (body.action === "RESPOND" && body.accept && !body.acceptedTerms)
      throw new ManagedCourseError("Acceptez les engagements professeur.", 400);
    return managedResponse(
      body.action === "RESPOND"
        ? await respondManagedOffer(
            body.offerId,
            teacher.id,
            body.accept,
            body.reason,
          )
        : body.action === "CANCEL"
          ? await cancelManagedOffer(
              body.offerId,
              teacher.id,
              false,
              body.reason,
            )
          : await completeManagedSession(
              body.dossierId,
              body.sessionId,
              teacher.id,
              false,
            ),
    );
  } catch (error) {
    return managedError(error);
  }
}
