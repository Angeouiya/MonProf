import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "CLIENT" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const unreadCount = await db.notification.count({
    where: user.role === "ADMIN"
      ? { recipientType: "ADMIN", read: false }
      : {
          recipientType: "CLIENT",
          read: false,
          OR: [{ userId: user.id }, { clientId: user.id }],
        },
  });

  return NextResponse.json(
    { unreadCount },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const now = new Date();
  const ownershipWhere = {
    recipientType: "CLIENT" as const,
    OR: [{ userId: user.id }, { clientId: user.id }],
  };

  if (body.markAllRead) {
    await db.notification.updateMany({
      where: { ...ownershipWhere, read: false },
      data: { read: true, readAt: now, status: "SEEN" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "confirm") {
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "Notification requise." }, { status: 400 });
    }
    const notification = await db.notification.findFirst({
      where: { id: body.id, ...ownershipWhere },
      select: { id: true, status: true },
    });
    if (!notification) {
      return NextResponse.json({ error: "Notification introuvable." }, { status: 404 });
    }
    await db.notification.update({
      where: { id: notification.id },
      data: {
        read: true,
        readAt: now,
        status: "CONFIRMED",
        confirmedAt: now,
        response: typeof body.response === "string" && body.response.trim()
          ? body.response.trim().slice(0, 500)
          : "Confirmée par le client.",
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Notification requise." }, { status: 400 });
  }

  const notification = await db.notification.findFirst({
    where: { id: body.id, ...ownershipWhere },
    select: { id: true },
  });
  if (!notification) {
    return NextResponse.json({ error: "Notification introuvable." }, { status: 404 });
  }

  const read = body.read !== false;
  await db.notification.update({
    where: { id: notification.id },
    data: {
      read,
      readAt: read ? now : null,
      status: read ? "SEEN" : "CREATED",
    },
  });

  return NextResponse.json({ ok: true });
}
