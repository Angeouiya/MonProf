import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getWebPushActor } from "@/lib/web-push-actor";
import { getWebPushConfiguration } from "@/lib/web-push";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096).refine((value) => value.startsWith("https://"), "Endpoint push non sécurisé."),
  expirationTime: z.number().finite().nonnegative().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(2048),
    auth: z.string().min(8).max(1024),
  }),
});

export async function GET() {
  const actor = await getWebPushActor();
  if (!actor) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const config = await getWebPushConfiguration();
  const activeDevices = await db.webPushSubscription.count({
    where: {
      enabled: true,
      revokedAt: null,
      ...(actor.kind === "TEACHER" ? { teacherId: actor.teacherId } : { userId: actor.userId }),
    },
  });
  return noStore({ configured: config.configured, publicKey: config.publicKey, activeDevices });
}

export async function POST(request: Request) {
  const actor = await getWebPushActor();
  if (!actor) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const config = await getWebPushConfiguration();
  if (!config.configured) {
    return NextResponse.json({ error: "Les notifications push ne sont pas encore configurées sur le serveur." }, { status: 503 });
  }

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Abonnement push invalide." }, { status: 400 });
  }

  const { endpoint, expirationTime, keys } = parsed.data;
  await db.webPushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      expirationTime: expirationTime == null ? null : BigInt(Math.trunc(expirationTime)),
      userAgent: request.headers.get("user-agent")?.slice(0, 1000) || null,
      userId: actor.userId,
      teacherId: actor.teacherId,
      enabled: true,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      expirationTime: expirationTime == null ? null : BigInt(Math.trunc(expirationTime)),
      userAgent: request.headers.get("user-agent")?.slice(0, 1000) || null,
      userId: actor.userId,
      teacherId: actor.teacherId,
      enabled: true,
      revokedAt: null,
      failureCount: 0,
      lastFailureAt: null,
    },
  });

  return noStore({ ok: true, message: "Notifications activées sur cet appareil." });
}

export async function DELETE(request: Request) {
  const actor = await getWebPushActor();
  if (!actor) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  await db.webPushSubscription.updateMany({
    where: {
      ...(endpoint ? { endpoint } : {}),
      ...(actor.kind === "TEACHER" ? { teacherId: actor.teacherId } : { userId: actor.userId }),
    },
    data: { enabled: false, revokedAt: new Date() },
  });
  return noStore({ ok: true, message: "Notifications désactivées sur cet appareil." });
}

function noStore(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
