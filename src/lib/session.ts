import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email?: string | null;
  name: string;
  role: "CLIENT" | "ADMIN" | "TEACHER";
  teacherId?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    id: (session.user as any).id,
    email: session.user.email,
    name: session.user.name!,
    role: (session.user as any).role,
    teacherId: (session.user as any).teacherId ?? null,
  };
}

export async function requireClient() {
  const u = await getSessionUser();
  if (!u) redirect("/connexion");
  if (u.role === "TEACHER") redirect("/professeur");
  if (u.role !== "CLIENT") redirect("/admin");
  return u;
}

export async function requireAdmin() {
  const u = await getSessionUser();
  if (!u) redirect("/admin/connexion");
  if (u.role === "TEACHER") redirect("/professeur");
  if (u.role !== "ADMIN") redirect("/");
  return u;
}

/** Récupère le client connecté ou null (pour les pages publiques qui s'adaptent) */
export async function optionalClient() {
  return await getSessionUser();
}
