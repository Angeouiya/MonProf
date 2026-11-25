import { getSafeInternalReturnPath } from "@/lib/safe-return-path";

export type LoginRole = "CLIENT" | "ADMIN" | "TEACHER";

export const AUTH_FAILURE = {
  unavailable: "AUTH_SERVICE_UNAVAILABLE",
  wrongSpace: "AUTH_WRONG_SPACE",
  disabled: "AUTH_ACCESS_DISABLED",
  temporaryExpired: "AUTH_TEMPORARY_EXPIRED",
  session: "AUTH_SESSION_UNAVAILABLE",
} as const;

const knownFailures = new Set<string>(Object.values(AUTH_FAILURE));

export async function authenticationBoundary<T>(provider: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Error && knownFailures.has(error.message)) throw error;
    // Do not propagate ORM diagnostics (which may contain identifiers) into the
    // NextAuth error URL. Keep only a technical code in the private server log.
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNKNOWN";
    console.error(JSON.stringify({ scope: "authentication", provider, code: /^[A-Z0-9_]{1,32}$/i.test(code) ? code : "UNKNOWN" }));
    throw new Error(AUTH_FAILURE.unavailable);
  }
}

export function loginErrorMessage(code: unknown, role: LoginRole, status?: number) {
  if (status === 429) return "Trop de tentatives rapprochées. Attendez une minute avant de réessayer.";
  switch (code) {
    case AUTH_FAILURE.wrongSpace:
      return "Ces identifiants ne correspondent pas à cet espace. Utilisez l’accès associé à votre compte.";
    case AUTH_FAILURE.disabled:
      return "L’accès de ce compte est désactivé. Contactez Compétence pour le faire vérifier.";
    case AUTH_FAILURE.temporaryExpired:
      return "Ce mot de passe temporaire a expiré ou a déjà été utilisé. Demandez un nouvel accès temporaire à Compétence.";
    case "CredentialsSignin":
      return role === "TEACHER" ? "Téléphone ou mot de passe professeur incorrect." : role === "ADMIN" ? "Email ou mot de passe administrateur incorrect." : "Email, téléphone ou mot de passe incorrect.";
    case AUTH_FAILURE.session:
      return "La connexion n’a pas pu être finalisée. Autorisez les cookies du site puis réessayez.";
    default:
      return "Le service de connexion est momentanément indisponible. Vos identifiants n’ont pas été modifiés. Réessayez dans quelques instants.";
  }
}

export function loginResultError(result: { error?: string | null; ok?: boolean; status?: number; url?: string | null } | undefined, role: LoginRole) {
  if (!result) return loginErrorMessage(AUTH_FAILURE.unavailable, role);
  if (result.error || result.ok !== true || result.status === 429) return loginErrorMessage(result.error, role, result.status);
  try {
    if (!result.url || new URL(result.url, "https://competence.local").searchParams.has("csrf")) return loginErrorMessage(AUTH_FAILURE.session, role);
  } catch { return loginErrorMessage(AUTH_FAILURE.session, role); }
  return null;
}

export async function readLoginSession(role: LoginRole) {
  const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error(AUTH_FAILURE.unavailable);
  const data = await response.json().catch(() => null);
  if (!data?.user) throw new Error(AUTH_FAILURE.session);
  if (data.user.role !== role) throw new Error(AUTH_FAILURE.wrongSpace);
  return data.user as { role: LoginRole; passwordMustChange?: boolean; portalPasswordMustChange?: boolean };
}

export function loginDestination(role: LoginRole, from?: string | null, mustChangePassword = false) {
  if (mustChangePassword) return role === "TEACHER" ? "/professeur/parametres?motDePasseTemporaire=1" : "/client/parametres?motDePasseTemporaire=1";
  const safe = getSafeInternalReturnPath(from);
  const pathname = safe ? new URL(safe, "https://competence.local").pathname : "";
  const admin = /^\/admin(?:\/|$)/.test(pathname);
  const teacher = /^\/professeur(?:\/|$)/.test(pathname);
  if (role === "ADMIN") return safe && admin && pathname !== "/admin/connexion" ? safe : "/admin";
  if (role === "TEACHER") return safe && teacher && pathname !== "/professeur/connexion" ? safe : "/professeur";
  return safe && !admin && !teacher && !["/connexion", "/inscription"].includes(pathname) ? safe : "/client";
}
