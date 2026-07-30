import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getNextAuthSecret } from "@/lib/auth-secret";
import { canTeacherUsePortal, normalizeTeacherPhone } from "@/lib/teacher-portal";
import {
  isEmailAccountIdentifier,
  normalizeAccountEmail,
  normalizeAccountPhone,
} from "@/lib/account-phone";
import {
  isActiveAdminAccount,
  normalizeAdminRole,
  resolveAdminPermissions,
} from "@/lib/admin-permissions";
import { isCurrentSessionVersion } from "@/lib/session-revocation";

// Même coût bcrypt pour un identifiant absent ou non autorisé afin de ne pas
// révéler par le temps de réponse si un email ou un téléphone est enregistré.
const DUMMY_PASSWORD_HASH = "$2b$12$Zit1ny6PYbY/3pK30skDi.b3iiR3ko3dVwMH7jhP6xAh0MfeabUkG";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        identifier: { label: "Email ou téléphone", type: "text" },
        email: { label: "Email", type: "email" },
        phone: { label: "Téléphone", type: "tel" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier || credentials?.email || credentials?.phone || "";
        if (!identifier || !credentials?.password) return null;
        const emailLogin = isEmailAccountIdentifier(identifier);
        const email = emailLogin ? normalizeAccountEmail(identifier) : null;
        const phoneNormalized = emailLogin ? null : normalizeAccountPhone(identifier);
        if (!email && !phoneNormalized) {
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const user = email
          ? await db.user.findUnique({ where: { email } })
          : await db.user.findUnique({ where: { phoneNormalized: phoneNormalized! } });
        const accountAllowed = Boolean(
          user
          // Un compte administrateur ne peut jamais contourner l'identifiant email.
          && !(user.role === "ADMIN" && !emailLogin)
          && !(user.role === "ADMIN" && !isActiveAdminAccount(user)),
        );
        const ok = await bcrypt.compare(
          credentials.password,
          accountAllowed && user ? user.passwordHash : DUMMY_PASSWORD_HASH,
        );
        if (!user || !accountAllowed || !ok) return null;

        let sessionVersion = user.sessionVersion;
        if (user.role === "CLIENT" && user.passwordMustChange) {
          // Le mot de passe temporaire est consommé atomiquement à la première
          // connexion. La session gagnante reste limitée au changement forcé;
          // toute autre tentative avec le même secret est refusée.
          if (!user.temporaryPasswordIssuedAt) return null;
          const claimed = await db.user.updateMany({
            where: {
              id: user.id,
              role: "CLIENT",
              passwordMustChange: true,
              temporaryPasswordIssuedAt: user.temporaryPasswordIssuedAt,
            },
            data: {
              temporaryPasswordIssuedAt: null,
              sessionVersion: { increment: 1 },
            },
          });
          if (claimed.count !== 1) return null;
          sessionVersion += 1;
        }
        if (user.role === "ADMIN") {
          await db.user.update({
            where: { id: user.id },
            data: { adminLastLoginAt: new Date() },
          });
        }
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name,
          phone: user.phone,
          role: user.role,
          passwordMustChange: user.role === "CLIENT" && user.passwordMustChange,
          adminTeamRole: user.role === "ADMIN" ? normalizeAdminRole(user.adminTeamRole) : null,
          adminPermissions: user.role === "ADMIN" ? resolveAdminPermissions(user) : [],
          adminAccountStatus: user.adminAccountStatus,
          sessionVersion,
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
        if (!credentials?.password) return null;
        if (!normalizedPhone) {
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const teacher = await db.teacher.findFirst({
          where: {
            portalPhone: normalizedPhone,
          },
        });
        const portalAllowed = Boolean(teacher && canTeacherUsePortal(teacher));
        const ok = await bcrypt.compare(
          credentials.password,
          portalAllowed && teacher?.portalPasswordHash
            ? teacher.portalPasswordHash
            : DUMMY_PASSWORD_HASH,
        );
        if (!teacher || !portalAllowed || !ok) return null;

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
          portalPasswordMustChange: teacher.portalPasswordMustChange,
          sessionVersion: teacher.sessionVersion,
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
        token.passwordMustChange = (user as any).passwordMustChange;
        token.portalPasswordMustChange = (user as any).portalPasswordMustChange;
        token.adminTeamRole = (user as any).adminTeamRole;
        token.adminPermissions = (user as any).adminPermissions;
        token.adminAccountStatus = (user as any).adminAccountStatus;
        token.sessionVersion = (user as any).sessionVersion;
        token.sessionInvalidated = false;
        return token;
      }

      if (token.sessionInvalidated === true) return token;
      if (!await isPersistedSessionCurrent(token)) {
        return { sessionInvalidated: true };
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sessionInvalidated === true) return null as any;
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).teacherId = token.teacherId;
        (session.user as any).phone = token.phone;
        (session.user as any).passwordMustChange = token.passwordMustChange;
        (session.user as any).portalPasswordMustChange = token.portalPasswordMustChange;
        (session.user as any).adminTeamRole = token.adminTeamRole;
        (session.user as any).adminPermissions = token.adminPermissions;
        (session.user as any).adminAccountStatus = token.adminAccountStatus;
      }
      return session;
    },
  },
  secret: getNextAuthSecret(),
};

async function isPersistedSessionCurrent(token: Record<string, unknown>) {
  const role = token.role;
  const tokenVersion = token.sessionVersion;

  if (role === "TEACHER") {
    const teacherId = typeof token.teacherId === "string"
      ? token.teacherId
      : typeof token.id === "string" ? token.id : "";
    if (!teacherId) return false;

    const teacher = await db.teacher.findUnique({
      where: { id: teacherId },
      select: {
        sessionVersion: true,
        status: true,
        portalAccessEnabled: true,
        portalPasswordHash: true,
      },
    });
    return Boolean(
      teacher
      && canTeacherUsePortal(teacher)
      && isCurrentSessionVersion(tokenVersion, teacher.sessionVersion),
    );
  }

  if ((role === "CLIENT" || role === "ADMIN") && typeof token.id === "string") {
    const user = await db.user.findUnique({
      where: { id: token.id },
      select: {
        role: true,
        sessionVersion: true,
        adminAccessEnabled: true,
        adminAccountStatus: true,
        adminDeletedAt: true,
      },
    });
    if (!user || user.role !== role) return false;
    if (role === "ADMIN" && !isActiveAdminAccount(user)) return false;
    return isCurrentSessionVersion(tokenVersion, user.sessionVersion);
  }

  return false;
}
