import { z } from "zod";
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
