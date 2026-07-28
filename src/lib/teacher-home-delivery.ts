export function requiresTeacherHomeCommune({
  status,
  offersHome,
  commune,
}: {
  status?: string | null;
  offersHome: boolean;
  commune?: unknown;
}) {
  return status === "ACTIVE"
    && offersHome
    && !(typeof commune === "string" && commune.trim());
}
