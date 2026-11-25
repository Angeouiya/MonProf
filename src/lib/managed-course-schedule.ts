export const MANAGED_MAX_SESSIONS = 64;
export const MANAGED_MAX_WEEKS = 8;
export const MANAGED_MAX_WEEKLY_SLOTS = 8;
export type ManagedWeeklySlot = { dayOfWeek: number; time: string };
export type ManagedScheduleRule =
  | { mode: "DATES" }
  | { mode: "WEEKLY"; startDate: string; weeks: number; weeklySlots: ManagedWeeklySlot[] };
export const MANAGED_WEEK_DAYS = [
  { value: 1, label: "Lundi" }, { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" }, { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" }, { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
] as const;
const DAY_MS = 86_400_000;
function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
export function defaultManagedWeeklySlots(count: number, startDate: string): ManagedWeeklySlot[] {
  const anchor = validDate(startDate)?.getUTCDay() ?? 1;
  return Array.from({ length: count }, (_, index) => ({
    dayOfWeek: (anchor + Math.floor((index * 7) / Math.min(count, 7))) % 7,
    time: index >= 7 ? "10:00" : "16:00",
  }));
}
export function orderedManagedSessions(sessions: { date: string; time: string }[]) {
  if (!sessions.length || sessions.length > MANAGED_MAX_SESSIONS)
    throw new Error(`Choisissez de 1 à ${MANAGED_MAX_SESSIONS} séances.`);
  for (const session of sessions) {
    if (!validDate(session.date) || !/^(?:(?:0[8-9]|1\d):(?:00|30)|20:00)$/.test(session.time))
      throw new Error("Vérifiez les dates et les heures (08 h à 20 h, par pas de 30 minutes).");
  }
  const result = [...sessions].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  for (let index = 1; index < result.length; index++) {
    if (new Date(`${result[index].date}T${result[index].time}:00Z`).getTime()
      - new Date(`${result[index - 1].date}T${result[index - 1].time}:00Z`).getTime() < 120 * 60_000)
      throw new Error("Deux séances de deux heures se chevauchent. Modifiez les jours ou les heures.");
  }
  return result;
}
export function managedWeeklySessions(rule: Extract<ManagedScheduleRule, { mode: "WEEKLY" }>) {
  const anchor = validDate(rule.startDate);
  if (!anchor) throw new Error("Choisissez une date de début valide.");
  if (!Number.isInteger(rule.weeks) || rule.weeks < 1 || rule.weeks > MANAGED_MAX_WEEKS)
    throw new Error(`Choisissez de 1 à ${MANAGED_MAX_WEEKS} semaines.`);
  if (rule.weeklySlots.length < 1 || rule.weeklySlots.length > MANAGED_MAX_WEEKLY_SLOTS)
    throw new Error(`Choisissez de 1 à ${MANAGED_MAX_WEEKLY_SLOTS} créneaux par semaine.`);
  const result: { date: string; time: string }[] = [];
  for (const slot of rule.weeklySlots) {
    if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6
      || !/^(?:(?:0[8-9]|1\d):(?:00|30)|20:00)$/.test(slot.time))
      throw new Error("Les créneaux commencent entre 08 h et 20 h, par pas de 30 minutes.");
    const offset = (slot.dayOfWeek - anchor.getUTCDay() + 7) % 7;
    for (let week = 0; week < rule.weeks; week++) result.push({
      date: new Date(anchor.getTime() + (offset + week * 7) * DAY_MS).toISOString().slice(0, 10),
      time: slot.time,
    });
  }
  return orderedManagedSessions(result);
}
