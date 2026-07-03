export const WEEK_DAYS = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
] as const;

export const TWO_HOUR_SLOTS = [
  { key: "08-10", label: "08h00 - 10h00", shortLabel: "08h-10h" },
  { key: "10-12", label: "10h00 - 12h00", shortLabel: "10h-12h" },
  { key: "12-14", label: "12h00 - 14h00", shortLabel: "12h-14h" },
  { key: "14-16", label: "14h00 - 16h00", shortLabel: "14h-16h" },
  { key: "16-18", label: "16h00 - 18h00", shortLabel: "16h-18h" },
  { key: "18-20", label: "18h00 - 20h00", shortLabel: "18h-20h" },
  { key: "20-22", label: "20h00 - 22h00", shortLabel: "20h-22h" },
] as const;

export const MIN_BOOKING_NOTICE_HOURS = 24;

export type AvailabilityGrid = Record<string, Record<string, boolean>>;

export function createEmptyAvailability(): AvailabilityGrid {
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [
      day.key,
      Object.fromEntries(TWO_HOUR_SLOTS.map((slot) => [slot.key, false])),
    ]),
  );
}

export function normalizeAvailability(raw?: unknown): AvailabilityGrid {
  const empty = createEmptyAvailability();
  if (!raw || typeof raw !== "object") return empty;

  const value = raw as Record<string, Record<string, boolean>>;
  const legacyMap: Record<string, string[]> = {
    morning: ["08-10", "10-12"],
    afternoon: ["12-14", "14-16"],
    evening: ["16-18", "18-20", "20-22"],
  };

  for (const day of WEEK_DAYS) {
    const source = value[day.key];
    if (!source || typeof source !== "object") continue;

    for (const slot of TWO_HOUR_SLOTS) {
      if (typeof source[slot.key] === "boolean") {
        empty[day.key][slot.key] = source[slot.key];
      }
    }

    for (const [legacyKey, slotKeys] of Object.entries(legacyMap)) {
      if (source[legacyKey]) {
        for (const slotKey of slotKeys) empty[day.key][slotKey] = true;
      }
    }
  }

  return empty;
}

export function parseAvailability(raw?: string | null): AvailabilityGrid {
  if (!raw) return createEmptyAvailability();
  try {
    return normalizeAvailability(JSON.parse(raw));
  } catch {
    return createEmptyAvailability();
  }
}

export function slotLabel(value: string): string {
  return TWO_HOUR_SLOTS.find((slot) => slot.key === value)?.label ?? value;
}

export function dayLabel(value: string): string {
  return WEEK_DAYS.find((day) => day.key === value)?.label ?? value;
}

export function availabilitySelectionLabel(value: string): string {
  const [day, slot] = value.split("|");
  return `${dayLabel(day)} ${slotLabel(slot)}`;
}

export function parseAvailabilitySelection(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const validDays = new Set<string>(WEEK_DAYS.map((day) => day.key));
  const validSlots = new Set<string>(TWO_HOUR_SLOTS.map((slot) => slot.key));
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => {
        const [day, slot] = item.split("|");
        return validDays.has(day) && validSlots.has(slot);
      }),
  ));
}

export function getSelectionStartTime(selection: string): string | null {
  const [, slotKey] = selection.split("|");
  const slot = TWO_HOUR_SLOTS.find((item) => item.key === slotKey);
  if (!slot) return null;
  const [hour] = slot.key.split("-");
  return `${hour.padStart(2, "0")}:00`;
}

export function buildLocalCourseDateTime(dateInput: string | Date, startTime: string): Date | null {
  const dateParts = typeof dateInput === "string"
    ? dateInput.split("-").map(Number)
    : [dateInput.getFullYear(), dateInput.getMonth() + 1, dateInput.getDate()];
  const [year, month, day] = dateParts;
  if (!year || !month || !day) return null;

  const normalizedTime = startTime.trim().replace("h", ":");
  const [hourValue, minuteValue = "0"] = normalizedTime.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function getEarliestCourseStartDateTime({
  dateInput,
  selectedTimeSlots,
  customStartTime,
}: {
  dateInput: string | Date;
  selectedTimeSlots?: string[] | null;
  customStartTime?: string | null;
}): Date | null {
  const startTimes = [
    ...((selectedTimeSlots ?? []).map(getSelectionStartTime).filter(Boolean) as string[]),
    ...(customStartTime ? [customStartTime] : []),
  ];
  const dates = startTimes
    .map((startTime) => buildLocalCourseDateTime(dateInput, startTime))
    .filter((date): date is Date => Boolean(date));

  if (dates.length === 0) return null;
  return dates.reduce((earliest, date) => (
    date.getTime() < earliest.getTime() ? date : earliest
  ), dates[0]);
}

export function respectsMinimumBookingNotice(courseStartAt: Date | null, now = new Date(), hours = MIN_BOOKING_NOTICE_HOURS) {
  if (!courseStartAt) return false;
  return courseStartAt.getTime() >= now.getTime() + hours * 60 * 60 * 1000;
}

export function unavailableSelections(
  availability: AvailabilityGrid,
  selections: string[],
): string[] {
  return selections.filter((selection) => {
    const [day, slot] = selection.split("|");
    return !availability[day]?.[slot];
  });
}

export function groupPricingMultiplier(participantsCount: number): number {
  return 1 + Math.max(0, participantsCount - 1) * 0.5;
}

export function applyGroupPricing(baseAmount: number, participantsCount: number): number {
  return Math.round(baseAmount * groupPricingMultiplier(participantsCount));
}
