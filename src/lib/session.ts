import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cache } from "react";

export type SessionUser = {
  id: string;
  email?: string | null;
  name: string;
  role: "CLIENT" | "ADMIN" | "TEACHER";
  teacherId?: string | null;
  phone?: string | null;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    id: (session.user as any).id,
    email: session.user.email,
    name: session.user.name!,
    role: (session.user as any).role,
    teacherId: (session.user as any).teacherId ?? null,
    phone: (session.user as any).phone ?? null,
  };
});

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
