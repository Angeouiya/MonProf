import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { canTeacherUsePortal, normalizeTeacherPhone } from "@/lib/teacher-portal";

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
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).teacherId = token.teacherId;
        (session.user as any).phone = token.phone;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "monprof-ci-dev-secret-change-me",
};
