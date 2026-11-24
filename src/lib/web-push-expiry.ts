export function teacherPushMayBeDelivered(
  notification: { expiresAt: Date | null; deletedAt: Date | null } | null,
  now = new Date(),
) {
  return Boolean(notification && !notification.deletedAt && (!notification.expiresAt || notification.expiresAt > now));
}
