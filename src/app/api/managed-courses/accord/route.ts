import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import {
  confirmManagedParentSession,
  linkManagedParentAccount,
} from "@/lib/managed-parent-confirmation";
import { ManagedCourseError } from "@/lib/managed-course-error";
import {
  managedContract,
  requestManagedParentAction,
} from "@/lib/managed-courses";
import {
  managedBody,
  managedError,
  managedGuard,
  managedResponse,
} from "@/lib/managed-courses-http";
export async function POST(request: Request) {
  try {
    managedGuard(request);
    const body = z
      .union([
        z
          .object({
            token: z.string().length(43),
            action: z.literal("CONFIRM_SESSION"),
            sessionId: z.string().min(1).max(100),
          })
          .strict(),
        z
          .object({
            token: z.string().length(43),
            action: z.literal("LINK_ACCOUNT"),
          })
          .strict(),
        z
          .object({
            token: z.string().length(43),
            revision: z.number().int().positive(),
            accepted: z.literal(true),
          })
          .strict(),
        z.object({ token: z.string().length(43) }).strict(),
        z
          .object({
            token: z.string().length(43),
            action: z.enum(["CANCELLATION", "DISPUTE"]),
            reason: z.string().trim().min(10).max(500),
          })
          .strict(),
      ])
      .parse(await managedBody(request));
    if ("action" in body && body.action === "CONFIRM_SESSION")
      return managedResponse(
        await confirmManagedParentSession(
          { token: body.token },
          body.sessionId,
        ),
      );
    if ("action" in body && body.action === "LINK_ACCOUNT") {
      const client = await getSessionUser();
      if (client?.role !== "CLIENT" || client.passwordMustChange)
        throw new ManagedCourseError(
          "Connectez-vous à votre compte client dans un autre onglet, puis réessayez.",
          401,
        );
      return managedResponse(
        await linkManagedParentAccount(body.token, client.id),
      );
    }
    return managedResponse(
      "action" in body
        ? await requestManagedParentAction(body.token, body.action, body.reason)
        : await managedContract(
            body.token,
            "accepted" in body ? body.revision : undefined,
          ),
    );
  } catch (error) {
    return managedError(error);
  }
}
