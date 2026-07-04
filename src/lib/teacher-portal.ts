export const TEACHER_PORTAL_BLOCKED_STATUSES = [
  "INACTIVE",
  "SUSPENDED",
  "TEMPORARILY_SUSPENDED",
  "PERMANENTLY_SUSPENDED",
  "BLACKLISTED",
] as const;

export function normalizeTeacherPhone(phone?: string | null) {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("225")) return `+${digits}`;
  if (digits.length === 10) return `+225${digits}`;
  return `+${digits}`;
}

export function canTeacherUsePortal(teacher: {
  portalAccessEnabled?: boolean | null;
  portalPasswordHash?: string | null;
  status?: string | null;
}) {
  if (!teacher.portalAccessEnabled || !teacher.portalPasswordHash) return false;
  return !TEACHER_PORTAL_BLOCKED_STATUSES.includes(
    teacher.status as (typeof TEACHER_PORTAL_BLOCKED_STATUSES)[number],
  );
}
