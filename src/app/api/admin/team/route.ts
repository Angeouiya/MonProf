import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { ADMIN_TEAM_ROLES, normalizeAdminRole } from "@/lib/admin-permissions";
import { isOwnerAdminEmail } from "@/lib/owner-account";

function validPassword(password: string) {
  return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("TEAM_MANAGE");
  if (!admin) return NextResponse.json({ error: "Seul le propriétaire peut gérer l'équipe admin." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const password = typeof body.password === "string" ? body.password : "";
  const requestedRole = normalizeAdminRole(body.adminTeamRole);
  const adminTeamRole = requestedRole === "OWNER" && !isOwnerAdminEmail(email) ? "SUPER_ADMIN" : requestedRole;

  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Nom et adresse email valide requis." }, { status: 400 });
  }
  if (!validPassword(password)) {
    return NextResponse.json({ error: "Le mot de passe temporaire doit contenir au moins 10 caractères, une lettre et un chiffre." }, { status: 400 });
  }
  if (!(ADMIN_TEAM_ROLES as readonly string[]).includes(adminTeamRole)) {
    return NextResponse.json({ error: "Rôle administrateur invalide." }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    return NextResponse.json({ error: "Cette adresse email appartient déjà à un compte. Utilisez une autre adresse ou traitez le compte existant." }, { status: 409 });
  }

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, 12),
        role: "ADMIN",
        adminTeamRole,
        adminAccountStatus: "ACTIVE",
        adminAccessEnabled: true,
        adminCreatedById: admin.id,
        adminPasswordChangedAt: new Date(),
      },
      select: { id: true, name: true, email: true, adminTeamRole: true, adminAccountStatus: true },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Administrateur ajouté",
        entityType: "User",
        entityId: user.id,
        detail: `${admin.name} a ajouté ${user.name} comme ${user.adminTeamRole}.`,
        newStatus: "ACTIVE",
      },
    });
    return user;
  });

  return NextResponse.json({ ok: true, admin: created });
}
