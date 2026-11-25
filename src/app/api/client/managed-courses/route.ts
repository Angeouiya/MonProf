import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { confirmManagedParentSession } from "@/lib/managed-parent-confirmation";
import { ManagedCourseError } from "@/lib/managed-course-error";
import {
  managedBody,
  managedError,
  managedGuard,
  managedResponse,
} from "@/lib/managed-courses-http";
export async function POST(request: Request) {
  try {
    managedGuard(request, true);
    const client = await getSessionUser();
    if (client?.role !== "CLIENT" || client.passwordMustChange)
      throw new ManagedCourseError("Connexion client requise.", 401);
    const input = z
      .object({
        action: z.literal("CONFIRM_SESSION"),
        dossierId: z.string().min(1).max(100),
        sessionId: z.string().min(1).max(100),
      })
      .strict()
      .parse(await managedBody(request));
    return managedResponse(
      await confirmManagedParentSession(
        { clientId: client.id, dossierId: input.dossierId },
        input.sessionId,
      ),
    );
  } catch (error) {
    return managedError(error);
  }
}
