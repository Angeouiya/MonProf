import {
  calculateGrandAbidjanTransportFee,
  TRANSPORT_FEES,
  type NeighborhoodAliasMap,
} from "@/lib/pricing";

export const STANDARD_SESSION_DURATION_MINUTES = 120;
export const CUSTOM_SESSION_DURATION_OPTIONS = [60, 120] as const;
export type CustomSessionDurationMinutes = (typeof CUSTOM_SESSION_DURATION_OPTIONS)[number];

export type ScheduleBufferMinutes = {
  sameNeighborhood: number;
  sameCommune: number;
  nearCommune: number;
  farCommune: number;
  outsideGrandAbidjan: number;
  homeOnline: number;
  onlineOnline: number;
};

export const DEFAULT_SCHEDULE_BUFFER_MINUTES: ScheduleBufferMinutes = {
  sameNeighborhood: 30,
  sameCommune: 30,
  nearCommune: 60,
  farCommune: 90,
  outsideGrandAbidjan: 90,
  homeOnline: 30,
  onlineOnline: 0,
};

export type ScheduleSlotLike = {
  scheduledDate?: Date | string | null;
  scheduledTime?: string | null;
  durationMinutes?: number | null;
  courseFormat?: string | null;
  commune?: string | null;
  quartier?: string | null;
  transportFeeKey?: string | null;
};

export type NormalizedScheduleSlot = {
  scheduledDate: Date;
  dateKey: string;
  scheduledTime: string;
  normalizedTimeLabel: string;
  durationMinutes: number;
  range: { startMinutes: number; endMinutes: number } | null;
  courseFormat: "HOME" | "ONLINE" | string | null;
  commune: string | null;
  quartier: string | null;
  transportFeeKey: string | null;
};

export type ScheduleConflictKind = "OVERLAP" | "TRAVEL_BUFFER";

export type ScheduleSlotsConflictResult = {
  kind: ScheduleConflictKind;
  requested: NormalizedScheduleSlot;
  existing: NormalizedScheduleSlot;
  requiredBufferMinutes: number;
  gapMinutes: number | null;
  relation: "overlap" | "requested_before_existing" | "requested_after_existing";
};

export type ScheduleConflictContext = {
  grandAbidjanCommuneNames?: string[];
  neighborhoodAliases?: NeighborhoodAliasMap;
};

export function scheduleSlotsOverlap(first: ScheduleSlotLike, second: ScheduleSlotLike) {
  const a = normalizeScheduleSlot(first);
  const b = normalizeScheduleSlot(second);
  if (!a || !b || a.dateKey !== b.dateKey) return false;
  if (a.range && b.range) {
    return a.range.startMinutes < b.range.endMinutes
      && b.range.startMinutes < a.range.endMinutes;
  }
  return Boolean(a.normalizedTimeLabel && a.normalizedTimeLabel === b.normalizedTimeLabel);
}

export function scheduleSlotsConflict(
  requested: ScheduleSlotLike,
  existing: ScheduleSlotLike,
  buffers?: Partial<ScheduleBufferMinutes> | null,
  context?: ScheduleConflictContext,
): ScheduleSlotsConflictResult | null {
  const requestSlot = normalizeScheduleSlot(requested);
  const existingSlot = normalizeScheduleSlot(existing);
  if (!requestSlot || !existingSlot || requestSlot.dateKey !== existingSlot.dateKey) return null;

  const effectiveBuffers = resolveScheduleBuffers(buffers);
  const requiredBufferMinutes = resolveTravelBufferMinutes(
    requestSlot,
    existingSlot,
    effectiveBuffers,
    context,
  );

  if (requestSlot.range && existingSlot.range) {
    if (
      requestSlot.range.startMinutes < existingSlot.range.endMinutes
      && existingSlot.range.startMinutes < requestSlot.range.endMinutes
    ) {
      return {
        kind: "OVERLAP",
        requested: requestSlot,
        existing: existingSlot,
        requiredBufferMinutes,
        gapMinutes: null,
        relation: "overlap",
      };
    }

    const requestedBeforeExisting = requestSlot.range.endMinutes <= existingSlot.range.startMinutes;
    const gapMinutes = requestedBeforeExisting
      ? existingSlot.range.startMinutes - requestSlot.range.endMinutes
      : requestSlot.range.startMinutes - existingSlot.range.endMinutes;

    if (gapMinutes < requiredBufferMinutes) {
      return {
        kind: "TRAVEL_BUFFER",
        requested: requestSlot,
        existing: existingSlot,
        requiredBufferMinutes,
        gapMinutes,
        relation: requestedBeforeExisting ? "requested_before_existing" : "requested_after_existing",
      };
    }

    return null;
  }

  if (requestSlot.normalizedTimeLabel && requestSlot.normalizedTimeLabel === existingSlot.normalizedTimeLabel) {
    return {
      kind: "OVERLAP",
      requested: requestSlot,
      existing: existingSlot,
      requiredBufferMinutes,
      gapMinutes: null,
      relation: "overlap",
    };
  }

  return null;
}

export function resolveScheduleBuffers(buffers?: Partial<ScheduleBufferMinutes> | null): ScheduleBufferMinutes {
  return {
    sameNeighborhood: boundedMinutes(buffers?.sameNeighborhood, DEFAULT_SCHEDULE_BUFFER_MINUTES.sameNeighborhood),
    sameCommune: boundedMinutes(buffers?.sameCommune, DEFAULT_SCHEDULE_BUFFER_MINUTES.sameCommune),
    nearCommune: boundedMinutes(buffers?.nearCommune, DEFAULT_SCHEDULE_BUFFER_MINUTES.nearCommune),
    farCommune: boundedMinutes(buffers?.farCommune, DEFAULT_SCHEDULE_BUFFER_MINUTES.farCommune),
    outsideGrandAbidjan: boundedMinutes(buffers?.outsideGrandAbidjan, DEFAULT_SCHEDULE_BUFFER_MINUTES.outsideGrandAbidjan),
    homeOnline: boundedMinutes(buffers?.homeOnline, DEFAULT_SCHEDULE_BUFFER_MINUTES.homeOnline, 0),
    onlineOnline: boundedMinutes(buffers?.onlineOnline, DEFAULT_SCHEDULE_BUFFER_MINUTES.onlineOnline, 0),
  };
}

export function resolveTravelBufferMinutes(
  first: ScheduleSlotLike,
  second: ScheduleSlotLike,
  buffers?: Partial<ScheduleBufferMinutes> | null,
  context?: ScheduleConflictContext,
) {
  const effectiveBuffers = resolveScheduleBuffers(buffers);
  const firstOnline = normalizeFormat(first.courseFormat) === "ONLINE";
  const secondOnline = normalizeFormat(second.courseFormat) === "ONLINE";
  if (firstOnline && secondOnline) return effectiveBuffers.onlineOnline;
  if (firstOnline || secondOnline) return effectiveBuffers.homeOnline;

  const firstCommune = cleanText(first.commune);
  const secondCommune = cleanText(second.commune);
  const firstQuartier = cleanText(first.quartier);
  const secondQuartier = cleanText(second.quartier);
  const routeKey = cleanText(first.transportFeeKey) ?? cleanText(second.transportFeeKey);

  const transportKey = firstCommune && secondCommune
    ? calculateGrandAbidjanTransportFee({
        teacherCommune: firstCommune,
        teacherQuartier: firstQuartier,
        clientCommune: secondCommune,
        clientQuartier: secondQuartier,
        grandAbidjanCommuneNames: context?.grandAbidjanCommuneNames,
        neighborhoodAliases: context?.neighborhoodAliases,
      }).key
    : routeKey && routeKey !== TRANSPORT_FEES.ONLINE.key
      ? TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.key
      : routeKey;

  switch (transportKey) {
    case TRANSPORT_FEES.SAME_NEIGHBORHOOD.key:
      return effectiveBuffers.sameNeighborhood;
    case TRANSPORT_FEES.SAME_AREA.key:
      return effectiveBuffers.sameCommune;
    case TRANSPORT_FEES.NEAR_COMMUNE.key:
      return effectiveBuffers.nearCommune;
    case TRANSPORT_FEES.FAR_COMMUNE.key:
      return effectiveBuffers.farCommune;
    case TRANSPORT_FEES.ONLINE.key:
      return effectiveBuffers.homeOnline;
    case TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.key:
    default:
      return effectiveBuffers.outsideGrandAbidjan;
  }
}

export function normalizeScheduleSlot(slot: ScheduleSlotLike): NormalizedScheduleSlot | null {
  const scheduledDate = parseScheduleDate(slot.scheduledDate);
  const scheduledTime = typeof slot.scheduledTime === "string" ? slot.scheduledTime.trim() : "";
  if (!scheduledDate || !scheduledTime) return null;
  const durationMinutes = normalizeDurationMinutes(slot.durationMinutes);
  return {
    scheduledDate,
    dateKey: dateKey(scheduledDate),
    scheduledTime,
    normalizedTimeLabel: normalizeTimeLabel(scheduledTime),
    durationMinutes,
    range: parseTimeRange(scheduledTime, durationMinutes),
    courseFormat: normalizeFormat(slot.courseFormat),
    commune: cleanText(slot.commune),
    quartier: cleanText(slot.quartier),
    transportFeeKey: cleanText(slot.transportFeeKey),
  };
}

export function parseScheduleDate(value?: Date | string | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeDurationMinutes(value?: number | string | null, fallback = STANDARD_SESSION_DURATION_MINUTES) {
  const parsed = typeof value === "string" ? Number(value) : Number(value ?? NaN);
  if (!Number.isFinite(parsed)) return fallback;
  const duration = Math.round(parsed);
  return duration >= 30 && duration <= 480 ? duration : fallback;
}

export function normalizeCustomDurationMinutes(value?: number | string | null): CustomSessionDurationMinutes {
  const parsed = Number(value);
  return parsed === 60 ? 60 : 120;
}

export function formatTimeRangeFromStart(startTime: string, durationMinutes = STANDARD_SESSION_DURATION_MINUTES) {
  const start = parseClockTime(startTime);
  if (!start) return "";
  const end = start.totalMinutes + normalizeDurationMinutes(durationMinutes);
  return `${formatMinutesAsTime(start.totalMinutes)} - ${formatMinutesAsTime(end)}`;
}

export function validateCustomScheduleTime(
  startTime: string,
  durationMinutes = STANDARD_SESSION_DURATION_MINUTES,
) {
  const parsed = parseClockTime(startTime);
  if (!parsed) {
    return { valid: false, reason: "Choisissez une heure valide." };
  }
  const duration = normalizeCustomDurationMinutes(durationMinutes);
  if (parsed.totalMinutes % 30 !== 0) {
    return { valid: false, reason: "L'heure personnalisée doit tomber sur une tranche de 30 minutes." };
  }
  const startLimit = 8 * 60;
  const endLimit = 22 * 60;
  const end = parsed.totalMinutes + duration;
  if (parsed.totalMinutes < startLimit || end > endLimit) {
    return { valid: false, reason: "L'horaire personnalisé doit rester entre 08h00 et 22h00." };
  }
  return { valid: true, reason: "" };
}

export function parseTimeRange(value: string, durationMinutes = STANDARD_SESSION_DURATION_MINUTES) {
  const label = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const compactRange = label.match(/\b([01]?\d|2[0-3])\s*-\s*([01]?\d|2[0-3])\b/);
  if (compactRange) {
    const startHour = Number(compactRange[1]);
    const endHour = Number(compactRange[2]);
    if (endHour > startHour) {
      return { startMinutes: startHour * 60, endMinutes: endHour * 60 };
    }
  }

  const times = Array.from(label.matchAll(/(?:^|[^\d])([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?/g))
    .map((match) => ({
      hour: Number(match[1]),
      minute: match[2] ? Number(match[2]) : 0,
    }))
    .filter((time) => Number.isFinite(time.hour) && Number.isFinite(time.minute));
  if (times.length === 0) return null;
  const start = times[0].hour * 60 + times[0].minute;
  const explicitEnd = times.length > 1 ? times[1].hour * 60 + times[1].minute : null;
  const end = explicitEnd && explicitEnd > start ? explicitEnd : start + normalizeDurationMinutes(durationMinutes);
  return { startMinutes: start, endMinutes: end };
}

export function formatMinutesAsTime(totalMinutes: number) {
  const minutesInDay = 24 * 60;
  const safeMinutes = ((Math.round(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay;
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`;
}

function parseClockTime(value?: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^([01]?\d|2[0-3])(?::|h)?([0-5]\d)?$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

function normalizeTimeLabel(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR");
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeFormat(value?: string | null) {
  const normalized = cleanText(value)?.toUpperCase();
  if (normalized === "EN_LIGNE" || normalized === "ONLINE" || normalized === "LINE") return "ONLINE";
  if (normalized === "DOMICILE" || normalized === "HOME" || normalized === "PRESENTIEL" || normalized === "PRÉSENTIEL") return "HOME";
  return normalized || null;
}

function boundedMinutes(value: number | undefined, fallback: number, minimum = 0, maximum = 180) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}

function cleanText(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
