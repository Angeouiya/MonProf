import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { managedCoursesEnabled } from "@/lib/managed-courses-core";
import { ManagedCourseError } from "@/lib/managed-courses";
import { isManagedRequestOriginAllowed } from "@/lib/managed-courses-origin";

export function managedGuard(request: Request, requireEnabled = false) {
  if (requireEnabled && !managedCoursesEnabled())
    throw new ManagedCourseError("Service indisponible.", 404);
  if (!isManagedRequestOriginAllowed(request.url, request.headers.get("origin"), [process.env.APP_URL, process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL]))
    throw new ManagedCourseError("Origine non autorisée.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ManagedCourseError("Format JSON requis.", 415);
}
export async function managedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ManagedCourseError("Formulaire manquant.", 400);
  const decoder = new TextDecoder();
  let bytes = 0;
  let raw = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 24_000) {
      await reader.cancel();
      throw new ManagedCourseError("Formulaire trop volumineux.", 413);
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ManagedCourseError("Formulaire invalide.", 400);
  }
}
export function managedResponse(value: unknown) {
  return NextResponse.json(value, {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
export function managedError(error: unknown) {
  const message =
    error instanceof z.ZodError
      ? error.issues[0]?.message || "Champs invalides."
      : error instanceof ManagedCourseError
        ? error.message
        : error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ? "Cette opération est déjà enregistrée. Actualisez avant de réessayer."
          : "L'opération n'a pas pu être confirmée. Actualisez avant de réessayer.";
  return NextResponse.json(
    { error: message },
    {
      status:
        error instanceof ManagedCourseError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export const managedMoneySchema = z.object({
  amount: z.number().int().min(1).max(24_000_000),
  method: z.enum(["CASH", "WAVE", "ORANGE_MONEY", "MTN_MOMO", "BANK", "OTHER"]),
  reference: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .transform((value) => value.toUpperCase()),
  idempotencyKey: z.string().uuid(),
});
