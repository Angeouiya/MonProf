// Reuse immutable formatting rules, never request/user data. Creating ICU date
// formatters in every rendered session is expensive under concurrent SSR.
const moneyFormatter = new Intl.NumberFormat("fr-FR");
const sessionDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Abidjan",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const scheduleDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
const dueDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});

export const managedMoney = (value: number) => `${moneyFormatter.format(value)} F CFA`;
export const managedSessionDate = (date: Date) => Number.isNaN(date.getTime())
  ? "Invalid Date"
  : sessionDateFormatter.format(date);
export const managedScheduleDate = (date: string) => scheduleDateFormatter.format(new Date(`${date}T00:00:00Z`));
export const managedDueDate = (date: string) => dueDateFormatter.format(new Date(`${date}T00:00:00Z`));
