import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { canTeacherUsePortal, normalizeTeacherPhone } from "@/lib/teacher-portal";
import {
  isActiveAdminAccount,
  normalizeAdminRole,
  resolveAdminPermissions,
} from "@/lib/admin-permissions";

const DEV_NEXTAUTH_SECRET = "monprof-ci-dev-secret-change-me";
const UNSAFE_NEXTAUTH_SECRETS = new Set(["", "change-me", DEV_NEXTAUTH_SECRET]);
let ephemeralProductionSecret: string | null = null;

function getNextAuthSecret() {
  const configuredSecret = process.env.NEXTAUTH_SECRET?.trim() ?? "";
  if (!UNSAFE_NEXTAUTH_SECRETS.has(configuredSecret)) return configuredSecret;

  if (process.env.NODE_ENV === "production") {
    if (!ephemeralProductionSecret) {
      ephemeralProductionSecret = randomBytes(32).toString("hex");
      console.error(
        "[security] NEXTAUTH_SECRET is missing or unsafe. Set a strong stable NEXTAUTH_SECRET in production environment variables.",
      );
    }
    return ephemeralProductionSecret;
  }

  return DEV_NEXTAUTH_SECRET;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user) return null;
        if (user.role === "ADMIN" && !isActiveAdminAccount(user)) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        if (user.role === "ADMIN") {
          await db.user.update({
            where: { id: user.id },
            data: { adminLastLoginAt: new Date() },
          });
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          adminTeamRole: user.role === "ADMIN" ? normalizeAdminRole(user.adminTeamRole) : null,
          adminPermissions: user.role === "ADMIN" ? resolveAdminPermissions(user) : [],
          adminAccountStatus: user.adminAccountStatus,
        } as any;
      },
    }),
    CredentialsProvider({
      id: "teacher-phone",
      name: "teacher-phone",
      credentials: {
        phone: { label: "Téléphone", type: "tel" },
        password: { label: "Mot de passe d'accès", type: "password" },
      },
      async authorize(credentials) {
        const normalizedPhone = normalizeTeacherPhone(credentials?.phone);
        if (!normalizedPhone || !credentials?.password) return null;

        const teacher = await db.teacher.findFirst({
          where: {
            portalPhone: normalizedPhone,
          },
        });
        if (!teacher || !canTeacherUsePortal(teacher)) return null;

        const ok = await bcrypt.compare(credentials.password, teacher.portalPasswordHash!);
        if (!ok) return null;

        await db.teacher.update({
          where: { id: teacher.id },
          data: { portalLastLoginAt: new Date(), lastActivityAt: new Date() },
        });

        return {
          id: teacher.id,
          teacherId: teacher.id,
          email: teacher.email ?? `${normalizedPhone.replace(/[^\d]/g, "")}@professeur.monprof.local`,
          name: teacher.professionalName || teacher.fullName,
          phone: teacher.phone,
          role: "TEACHER",
        } as any;
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: {
    signIn: "/connexion",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.teacherId = (user as any).teacherId;
        token.phone = (user as any).phone;
        token.adminTeamRole = (user as any).adminTeamRole;
        token.adminPermissions = (user as any).adminPermissions;
        token.adminAccountStatus = (user as any).adminAccountStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).teacherId = token.teacherId;
        (session.user as any).phone = token.phone;
        (session.user as any).adminTeamRole = token.adminTeamRole;
        (session.user as any).adminPermissions = token.adminPermissions;
        (session.user as any).adminAccountStatus = token.adminAccountStatus;
      }
      return session;
    },
  },
  secret: getNextAuthSecret(),
};
