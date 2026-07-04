import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Accès réservé aux clients." }, { status: 403 });
  }
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, phone: true,
      commune: true, quartier: true, avatarUrl: true, role: true, createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Accès réservé aux clients." }, { status: 403 });
  }
  const userId = (session.user as any).id;

  const body = await req.json();
  const { action, name, phone, commune, quartier, avatarUrl, oldPassword, newPassword } = body;

  if (action === "changePassword") {
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Ancien et nouveau mot de passe requis" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Ancien mot de passe incorrect" }, { status: 400 });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    return NextResponse.json({ ok: true });
  }

  const data: any = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof phone === "string") data.phone = phone.trim() || null;
  if (typeof commune === "string") data.commune = commune.trim() || null;
  if (typeof quartier === "string") data.quartier = quartier.trim() || null;
  if (typeof avatarUrl === "string") data.avatarUrl = avatarUrl.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, email: true, name: true, phone: true,
      commune: true, quartier: true, avatarUrl: true, role: true,
    },
  });

  return NextResponse.json({ user: updated });
}
