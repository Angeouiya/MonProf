/** Keep a teacher push click inside the professor area, never a foreign URL. */
export function safeTeacherNotificationLink(link: string | null | undefined) {
  if (!link || link.length > 500 || !link.startsWith("/professeur/")) return null;
  if (link.includes("//") || link.includes("\\") || /[\u0000-\u001F\u007F]/.test(link)) return null;
  return link;
}
