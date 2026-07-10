import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import {
  ADMIN_PERMISSIONS,
  ADMIN_TEAM_ROLES,
  normalizeAdminRole,
} from "@/lib/admin-permissions";
import { isOwnerAdminEmail } from "@/lib/owner-account";

function normalizePermissions(value: unknown) {
  if (!Array.isArray(value)) return null;
  return Array.from(new Set(value.filter((permission): permission is string =>
    typeof permission === "string" && (ADMIN_PERMISSIONS as readonly string[]).includes(permission),
  )));
}

function validPassword(password: string) {
  return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("TEAM_MANAGE");
  if (!admin) return NextResponse.json({ error: "Accès équipe refusé." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.role !== "ADMIN") return NextResponse.json({ error: "Administrateur introuvable." }, { status: 404 });

  const owner = isOwnerAdminEmail(target.email);
  const action = typeof body.action === "string" ? body.action : "update";
  if (action === "reset_password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (!validPassword(password)) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 10 caractères, une lettre et un chiffre." }, { status: 400 });
    }
    await db.$transaction([
      db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12), adminPasswordChangedAt: new Date() } }),
      db.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Mot de passe administrateur réinitialisé",
          entityType: "User",
          entityId: id,
          detail: `${admin.name} a réinitialisé le mot de passe de ${target.name}. Le mot de passe n'est pas conservé dans le journal.`,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  const requestedRole = normalizeAdminRole(body.adminTeamRole ?? target.adminTeamRole);
  if (!(ADMIN_TEAM_ROLES as readonly string[]).includes(requestedRole)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }
  const status = ["ACTIVE", "SUSPENDED", "BLOCKED"].includes(body.adminAccountStatus)
    ? body.adminAccountStatus as "ACTIVE" | "SUSPENDED" | "BLOCKED"
    : (target.adminAccountStatus ?? "ACTIVE");
  if (owner && (requestedRole !== "OWNER" || status !== "ACTIVE" || body.adminAccessEnabled === false)) {
    return NextResponse.json({ error: "Le compte propriétaire principal ne peut pas être suspendu, bloqué ou rétrogradé." }, { status: 400 });
  }
  if (id === admin.id && (status !== "ACTIVE" || body.adminAccessEnabled === false)) {
    return NextResponse.json({ error: "Vous ne pouvez pas suspendre votre propre session." }, { status: 400 });
  }

  const permissions = body.useRoleDefaults === true ? null : normalizePermissions(body.adminPermissions);
  const suspensionReason = typeof body.adminSuspensionReason === "string" && body.adminSuspensionReason.trim()
    ? body.adminSuspensionReason.trim().slice(0, 500)
    : null;
  const previousStatus = target.adminAccountStatus ?? "ACTIVE";
  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : target.name,
        phone: typeof body.phone === "string" ? body.phone.trim() || null : target.phone,
        adminTeamRole: owner ? "OWNER" : requestedRole,
        adminPermissions: body.useRoleDefaults === true ? Prisma.DbNull : (permissions ?? Prisma.DbNull),
        adminAccountStatus: owner ? "ACTIVE" : status,
        adminAccessEnabled: owner ? true : body.adminAccessEnabled !== false,
        adminSuspendedAt: status === "ACTIVE" ? null : new Date(),
        adminSuspensionReason: status === "ACTIVE" ? null : suspensionReason,
        adminDeletedAt: null,
      },
      select: { id: true, name: true, email: true, adminTeamRole: true, adminAccountStatus: true },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Accès administrateur modifié",
        entityType: "User",
        entityId: id,
        detail: `${admin.name} a modifié le rôle et les accès de ${target.name}. Rôle: ${user.adminTeamRole}.`,
        oldStatus: previousStatus,
        newStatus: user.adminAccountStatus,
      },
    });
    return user;
  });
  return NextResponse.json({ ok: true, admin: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("TEAM_MANAGE");
  if (!admin) return NextResponse.json({ error: "Accès équipe refusé." }, { status: 403 });
  const { id } = await params;
  const target = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true } });
  if (!target || target.role !== "ADMIN") return NextResponse.json({ error: "Administrateur introuvable." }, { status: 404 });
  if (id === admin.id) return NextResponse.json({ error: "Vous ne pouvez pas retirer votre propre compte." }, { status: 400 });
  if (isOwnerAdminEmail(target.email)) return NextResponse.json({ error: "Le compte propriétaire ne peut pas être retiré." }, { status: 400 });

  await db.$transaction([
    db.user.update({
      where: { id },
      data: {
        adminAccessEnabled: false,
        adminAccountStatus: "BLOCKED",
        adminDeletedAt: new Date(),
        adminSuspendedAt: new Date(),
        adminSuspensionReason: "Accès retiré de l'équipe administratrice.",
      },
    }),
    db.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Administrateur retiré",
        entityType: "User",
        entityId: id,
        detail: `${admin.name} a retiré ${target.name} de l'équipe. Le compte est conservé pour l'audit mais ne peut plus se connecter.`,
        oldStatus: "ACTIVE",
        newStatus: "BLOCKED",
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
