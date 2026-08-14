"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BackButton } from "@/components/shared/back-button";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ProfessorTrustBadges } from "@/components/shared/professor-trust-badges";
import { BookingPricingBreakdown } from "@/components/shared/booking-pricing-breakdown";
import { JekoHostedCheckoutPreview } from "@/components/shared/jeko-hosted-checkout-preview";
import { PaymentMethodLogo } from "@/components/shared/payment-method-logo";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import { RestrictionNoticeDialog, type RestrictionNoticeVariant } from "@/components/shared/restriction-notice-dialog";
import { formatFCFA } from "@/lib/format";
import { isAllowedJekoRedirectUrl } from "@/lib/jeko-checkout-url";
import { activePaymentMethodOptions } from "@/lib/payment-methods";
import { filterLevelsForJourney, filterSubjectsForJourney } from "@/lib/catalog-journey";
import { PackType } from "@prisma/client";
import {
  COURSE_CATALOG,
  COURSE_CATEGORIES,
  SCHOOL_SYSTEMS,
  buildSchoolProgramSummary,
  getPreciseLevelOptions,
  isCourseCatalogItemCompatible,
  resolveBookingCourseCategory,
  validateEducationSelection,
} from "@/lib/course-catalog";
import {
  MIN_BOOKING_NOTICE_HOURS,
  availabilitySelectionLabel,
  dayLabel,
  getEarliestCourseStartDateTime,
  parseAvailability,
  respectsMinimumBookingNotice,
  TWO_HOUR_SLOTS,
  WEEK_DAYS,
} from "@/lib/scheduling";
import {
  COURSE_PACKS,
  buildNeighborhoodAliasMap,
  calculateBookingPricing,
  packSessionCount,
  type NeighborhoodAliasMap,
} from "@/lib/pricing";
import {
  formatTimeRangeFromStart,
  normalizeScheduleSlot,
  normalizeCustomDurationMinutes,
  resolveTravelBufferMinutes,
  scheduleSlotsConflict,
  validateCustomScheduleTime,
  type ScheduleBufferMinutes,
  type ScheduleSlotsConflictResult,
} from "@/lib/schedule-conflict-core";
import {
  buildAbidjanCommuneOptions,
  buildCityOptions,
  buildQuartierOptions,
  formatLocationSummary,
  isAbidjanCity,
} from "@/lib/ivory-coast-locations";
import {
  ArrowLeft, ArrowRight, Home, Video, User, Users,
  ShieldCheck, CalendarDays, CheckCircle2, Clock3, ClipboardList, WalletCards, ExternalLink, AlertTriangle,
} from "lucide-react";

type Teacher = {
  id: string;
  fullName: string;
  professionalName: string | null;
  photoUrl: string | null;
  jobTitle: string;
  commune: string | null;
  quartier?: string | null;
  rating: number;
  ratingCount: number;
  pricePerSession: number;
  commissionRate: number;
  badgeVerified: boolean;
  badgeRecommended: boolean;
  badgePremium: boolean;
  badgePopular: boolean;
  badgeNew: boolean;
  offersHome: boolean;
  offersOnline: boolean;
  offersGroup: boolean;
  availability: string | null;
  zones: string[];
  subjects: { name: string; isPrimary: boolean }[];
  levels: string[];
};

type CommuneOption = {
  id: string;
  name: string;
  zone: string | null;
  transportClass: "GRAND_ABIDJAN" | "PERI_URBAN" | "INTERIOR";
  transportFeeOverride: number | null;
  quarters: Array<{ id: string; name: string; aliases?: string | null }>;
};

type PricingConfig = {
  commissionPercent: number;
  transportFees: { sameCommune: number; nearCommune: number; farCommune: number; interior: number };
  scheduleBuffers: ScheduleBufferMinutes;
};

type InitialPartnerReferral = {
  code: string;
  promoterName: string;
  promoterPhone: string;
};

type InitialPromotionBenefits = {
  partnerDiscountPercent: number;
  partnerCommissionPercent: number;
  minimumMarginPercent: number;
  reward: {
    id: string;
    milestone: number;
    discountRate: number;
    validityDays: number;
    expiresAt: string;
  } | null;
};

type OccupiedTeacherSlot = {
  date: string;
  time: string;
  durationMinutes: number;
  bookingReference?: string | null;
  sequence?: number | null;
  courseFormat?: string | null;
  commune?: string | null;
  quartier?: string | null;
  transportFeeKey?: string | null;
};

type ScheduleOccurrence = {
  date: string;
  time: string;
  sequence: number;
  durationMinutes: number;
};

type OccupiedScheduleConflict = {
  occurrence: ScheduleOccurrence;
  occupied: OccupiedTeacherSlot;
  conflict: ScheduleSlotsConflictResult;
};

type RestrictionNoticeState = {
  title: string;
  description: ReactNode;
  variant?: RestrictionNoticeVariant;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

type TravelPlanningNotice = {
  status: "idle" | "clear" | "blocked";
  title: string;
  description: string;
  requestedLabel?: string;
  existingLabel?: string;
  requestedLocation?: string;
  existingLocation?: string;
  requiredBufferMinutes?: number;
  gapMinutes?: number | null;
};

type BookingJourney = "ivoirien" | "francais" | "professionnel";

const BOOKING_JOURNEY_CHOICES = [
  { value: "ivoirien", label: "Ivoirien", detail: "CP1 à Terminale" },
  { value: "francais", label: "Français", detail: "CP1 à Terminale" },
  { value: "professionnel", label: "Pro", detail: "40 000 F / séance de 2h" },
] as const;

type PriceChangeNotice = {
  fingerprint: string;
  previous: {
    courseAmount: number;
    transportFee: number;
    paymentServiceFeeAmount: number;
    paymentProviderFeeAmount: number;
    totalClientPays: number;
  };
  current: {
    unitSessionAmount: number;
    courseAmount: number;
    transportFee: number;
    paymentServiceFeeAmount: number;
    paymentProviderFeeAmount: number;
    paymentProviderFeeLabel?: string | null;
    paymentProviderFeeMethod: string | null;
    totalClientPays: number;
    priceTierKey: string;
    priceTierLabel: string;
    partnerDiscountAmount: number;
    rewardDiscountAmount: number;
    partnerCommissionAmount: number;
    transportFeeLabel: string | null;
    transportRouteLabel: string | null;
    numberOfSessions: number;
  };
};

const STEPS = ["Besoin", "Format", "Disponibilité", "Récapitulatif", "Paiement"];
const STEP_DETAILS = [
  {
    title: "Besoin du cours",
    description: "Choisissez le profil, la matière du professeur et le niveau concerné.",
  },
  {
    title: "Format",
    description: "Définissez le mode du cours et le nombre de participants.",
  },
  {
    title: "Date et horaires",
    description: "Sélectionnez une date, un créneau de 2h ou un autre horaire précis.",
  },
  {
    title: "Récapitulatif",
    description: "Vérifiez le professeur, le planning, la formule et le montant client.",
  },
  {
    title: "Paiement",
    description: "Contrôlez le dossier, choisissez votre moyen puis finalisez le paiement sécurisé sur Jèko.",
  },
] as const;
const FIELD_CLASS = "mt-1.5 w-full rounded-lg border border-[#DDE6F7] bg-white py-2.5 pl-3 pr-10 text-sm text-[#111827] outline-none transition focus:border-[#9AAAD0] focus:ring-2 focus:ring-[#DDE6F7]";
const FIELD_CLASS_TALL = "mt-1.5 h-11 w-full rounded-lg border border-[#DDE6F7] bg-white pl-3 pr-10 text-sm text-[#111827] outline-none transition focus:border-[#9AAAD0] focus:ring-2 focus:ring-[#DDE6F7]";
const OBJECTIVES = [
  { value: "Devoir / soutien", label: "Devoir / soutien" },
  { value: "Remise à niveau", label: "Remise à niveau" },
  { value: "Préparation examen", label: "Préparation examen (BEPC, BAC)" },
  { value: "Concours", label: "Concours / école" },
  { value: "Perfectionnement", label: "Perfectionnement" },
];
const PACK_OPTIONS = [
  { value: "SINGLE", label: COURSE_PACKS.SINGLE.label, count: COURSE_PACKS.SINGLE.sessions },
  { value: "PACK_4", label: COURSE_PACKS.PACK_4.label, count: COURSE_PACKS.PACK_4.sessions },
  { value: "PACK_8", label: COURSE_PACKS.PACK_8.label, count: COURSE_PACKS.PACK_8.sessions },
  { value: "PACK_12", label: COURSE_PACKS.PACK_12.label, count: COURSE_PACKS.PACK_12.sessions },
  { value: "CUSTOM", label: COURSE_PACKS.CUSTOM.label, count: COURSE_PACKS.CUSTOM.sessions },
];

function normalizeLocation(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
const PAYMENT_METHODS = activePaymentMethodOptions;

const CATEGORY_COPY: Record<string, {
  intro: string;
  levelLabel: string;
  subjectLabel: string;
  programLabel: string;
  programPlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
}> = {
  soutien_scolaire: {
    intro: "Décrivez le besoin de l'élève et choisissez uniquement une matière couverte par ce professeur.",
    levelLabel: "Niveau de l'élève",
    subjectLabel: "Matière",
    programLabel: "Programme, série ou précision complémentaire",
    programPlaceholder: "Ex : Programme officiel CI, lycée français, série Terminale D...",
    descriptionLabel: "Description du besoin",
    descriptionPlaceholder: "Ex : chapitres à revoir, devoirs, difficultés, objectif de progression...",
  },
  preparation_examens: {
    intro: "Précisez l'examen, le concours ou la certification préparée.",
    levelLabel: "Examen, concours ou niveau",
    subjectLabel: "Matière ou module préparé",
    programLabel: "Concours, examen ou session visée",
    programPlaceholder: "Ex : BEPC, BAC D, CAFOP, INFAS, TOEIC, IELTS...",
    descriptionLabel: "Objectif de préparation",
    descriptionPlaceholder: "Ex : entraînement sujets, méthodologie, oral, épreuves spécifiques...",
  },
  enseignement_superieur: {
    intro: "Renseignez le niveau universitaire ou supérieur concerné.",
    levelLabel: "Niveau d'études",
    subjectLabel: "Module ou matière",
    programLabel: "Filière, UE ou établissement",
    programPlaceholder: "Ex : BTS Finance, Licence 2 Droit, Master Data, mémoire...",
    descriptionLabel: "Besoin universitaire",
    descriptionPlaceholder: "Ex : module précis, TD, projet, rapport, mémoire, soutenance...",
  },
  formation_professionnelle: {
    intro: "Décrivez la compétence professionnelle à développer.",
    levelLabel: "Profil apprenant",
    subjectLabel: "Compétence à apprendre",
    programLabel: "Contexte professionnel",
    programPlaceholder: "Ex : salarié, entrepreneur, reconversion, Excel pour comptabilité...",
    descriptionLabel: "Besoin professionnel",
    descriptionPlaceholder: "Ex : objectif métier, niveau actuel, outil utilisé, résultat attendu...",
  },
  apprentissage_metier: {
    intro: "Précisez le métier ou le savoir-faire pratique à apprendre.",
    levelLabel: "Profil apprenant",
    subjectLabel: "Métier ou compétence pratique",
    programLabel: "Contexte de pratique",
    programPlaceholder: "Ex : débutant coiffure, couture pratique, installation solaire...",
    descriptionLabel: "Besoin métier",
    descriptionPlaceholder: "Ex : matériel disponible, objectif pratique, niveau actuel, contrainte...",
  },
  langues_communication: {
    intro: "Indiquez le niveau, l'usage et l'objectif de communication.",
    levelLabel: "Niveau ou usage",
    subjectLabel: "Langue ou compétence",
    programLabel: "Objectif linguistique",
    programPlaceholder: "Ex : anglais conversation, entretien, TOEFL, français professionnel...",
    descriptionLabel: "Besoin de communication",
    descriptionPlaceholder: "Ex : oral, écrit, certification, voyage, entretien, usage professionnel...",
  },
  formation_entreprise: {
    intro: "Décrivez la formation à organiser pour l'équipe ou l'organisation.",
    levelLabel: "Public concerné",
    subjectLabel: "Thème de formation",
    programLabel: "Entreprise, équipe ou objectif",
    programPlaceholder: "Ex : équipe commerciale, formation Excel, service client, IA...",
    descriptionLabel: "Cadrage entreprise",
    descriptionPlaceholder: "Ex : nombre de personnes, lieu, durée souhaitée, objectifs métier...",
  },
};

function getCategoryCopy(category: string) {
  return CATEGORY_COPY[category] ?? CATEGORY_COPY.soutien_scolaire;
}

function formatCatalogSubcategory(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase("fr-FR"));
}

function isSchoolContext(category: string) {
  return category === "soutien_scolaire" || category === "preparation_examens";
}

const CATEGORY_LEVEL_PATTERNS: Record<string, RegExp> = {
  soutien_scolaire: /(maternelle|primaire|cp|ce1|ce2|cm1|cm2|college|6e|5e|4e|3e|lycee|seconde|premiere|terminale|bac|bepc|cepe)/,
  preparation_examens: /(concours|cepe|bepc|bac|brevet|toeic|toefl|ielts|test|certification)/,
  enseignement_superieur: /(bts|licence|master|doctorat|universite|superieur|memoire|soutenance)/,
  formation_professionnelle: /(adulte|formation|professionnel|reconversion|metier)/,
  apprentissage_metier: /(adulte|formation|professionnel|metier|reconversion|technique)/,
  langues_communication: /(adulte|universite|formation|professionnel|test|toeic|toefl|ielts|college|lycee|primaire)/,
  formation_entreprise: /(entreprise|adulte|formation|professionnel|equipe)/,
};

function suggestLevelForCategory(levels: string[], category: string, currentLevel: string) {
  const pattern = CATEGORY_LEVEL_PATTERNS[category] ?? /./;

  const currentStillFits = currentLevel && pattern.test(normalizeForMatch(currentLevel));
  if (currentStillFits) return currentLevel;

  return levels.find((level) => pattern.test(normalizeForMatch(level))) ?? currentLevel;
}

function clampGroupParticipants(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2;
  return Math.max(2, Math.min(12, Math.round(parsed)));
}

function formatTimeRange(startTime: string, durationMinutes = 120) {
  return formatTimeRangeFromStart(startTime, durationMinutes) || startTime;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateInputLabel(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatDateTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const DATE_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const CLIENT_DAY_INDEX = new Map<string, number>(WEEK_DAYS.map((day, index) => [day.key, index === 6 ? 0 : index + 1]));

function dayKeyFromDateInput(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return DATE_DAY_KEYS[new Date(year, month - 1, day).getDay()];
}

function dateFromInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function addDaysToDateInput(value: string, days: number) {
  const date = dateFromInput(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function slotLabelFromSelection(selection?: string | null) {
  if (!selection) return null;
  const [, slotKey] = selection.split("|");
  const slot = TWO_HOUR_SLOTS.find((item) => item.key === slotKey);
  return slot?.label ?? selection;
}

function buildScheduleOccurrences({
  startDate,
  selectedTimeSlots,
  sessionsCount,
  fallbackTime,
  fallbackDurationMinutes,
}: {
  startDate: string;
  selectedTimeSlots: string[];
  sessionsCount: number;
  fallbackTime?: string | null;
  fallbackDurationMinutes?: number | null;
}): ScheduleOccurrence[] {
  const count = Math.max(1, Math.round(sessionsCount));
  if (!dateFromInput(startDate)) return [];
  const validSelections = selectedTimeSlots
    .map((selection) => {
      const [dayKey, slotKey] = selection.split("|");
      const dayIndex = CLIENT_DAY_INDEX.get(dayKey);
      const slotIndex = TWO_HOUR_SLOTS.findIndex((slot) => slot.key === slotKey);
      return dayIndex === undefined || slotIndex < 0 ? null : { selection, dayIndex, slotIndex };
    })
    .filter((selection): selection is NonNullable<typeof selection> => Boolean(selection));

  if (validSelections.length === 0) {
    if (!fallbackTime) return [];
    return Array.from({ length: count }, (_, index) => ({
      date: addDaysToDateInput(startDate, index * 7),
      time: fallbackTime,
      sequence: index + 1,
      durationMinutes: normalizeCustomDurationMinutes(fallbackDurationMinutes),
    })).filter((item) => Boolean(item.date));
  }

  const schedule: ScheduleOccurrence[] = [];
  for (let dayOffset = 0; schedule.length < count && dayOffset < count * 14 + 14; dayOffset += 1) {
    const date = dateFromInput(startDate);
    if (!date) break;
    date.setDate(date.getDate() + dayOffset);
    const matches = validSelections
      .filter((selection) => selection.dayIndex === date.getDay())
      .sort((a, b) => a.slotIndex - b.slotIndex);
    for (const match of matches) {
      const time = slotLabelFromSelection(match.selection);
      if (!time) continue;
      if (schedule.length >= count) break;
      schedule.push({
        date: toDateInputValue(date),
        time,
        sequence: schedule.length + 1,
        durationMinutes: 120,
      });
    }
  }
  return schedule;
}

function findOccupiedConflictForTime(
  occupiedSlots: OccupiedTeacherSlot[],
  date: string,
  time: string,
  durationMinutes = 120,
  requestContext: {
    courseFormat?: string | null;
    commune?: string | null;
    quartier?: string | null;
    transportFeeKey?: string | null;
  },
  scheduleBuffers: ScheduleBufferMinutes,
  conflictContext?: { grandAbidjanCommuneNames?: string[]; neighborhoodAliases?: NeighborhoodAliasMap },
) {
  for (const occupied of occupiedSlots) {
    if (occupied.date !== date) continue;
    const conflict = scheduleSlotsConflict(
      {
        scheduledDate: date,
        scheduledTime: time,
        durationMinutes,
        courseFormat: requestContext.courseFormat,
        commune: requestContext.commune,
        quartier: requestContext.quartier,
        transportFeeKey: requestContext.transportFeeKey,
      },
      {
        scheduledDate: occupied.date,
        scheduledTime: occupied.time,
        durationMinutes: occupied.durationMinutes,
        courseFormat: occupied.courseFormat,
        commune: occupied.commune,
        quartier: occupied.quartier,
        transportFeeKey: occupied.transportFeeKey,
      },
      scheduleBuffers,
      conflictContext,
    );
    if (conflict) return { occupied, conflict };
  }
  return null;
}

function findOccupiedConflictForSelection(
  occupiedSlots: OccupiedTeacherSlot[],
  date: string,
  selection: string,
  requestContext: {
    courseFormat?: string | null;
    commune?: string | null;
    quartier?: string | null;
    transportFeeKey?: string | null;
  },
  scheduleBuffers: ScheduleBufferMinutes,
  conflictContext?: { grandAbidjanCommuneNames?: string[]; neighborhoodAliases?: NeighborhoodAliasMap },
) {
  const time = slotLabelFromSelection(selection);
  return time ? findOccupiedConflictForTime(occupiedSlots, date, time, 120, requestContext, scheduleBuffers, conflictContext) : null;
}

function formatOccupiedConflictMessage(conflict: OccupiedScheduleConflict) {
  const sequenceLabel = conflict.occurrence.sequence > 1 ? `, séance ${conflict.occurrence.sequence}` : "";
  const referenceLabel = conflict.occupied.bookingReference ? `, dossier ${conflict.occupied.bookingReference}` : "";
  if (conflict.conflict.kind === "TRAVEL_BUFFER") {
    return `Déplacement insuffisant pour ce professeur (${formatDateInputLabel(conflict.occurrence.date)} · ${conflict.occurrence.time}${sequenceLabel}${referenceLabel}). Il faut au moins ${conflict.conflict.requiredBufferMinutes} min entre deux cours. Choisissez une autre heure ou un autre professeur.`;
  }
  return `Ce créneau est déjà payé pour ce professeur (${formatDateInputLabel(conflict.occurrence.date)} · ${conflict.occurrence.time}${sequenceLabel}${referenceLabel}). Choisissez un autre créneau ou un autre professeur.`;
}

function buildTravelPlanningNotice(
  occurrences: ScheduleOccurrence[],
  occupiedSlots: OccupiedTeacherSlot[],
  requestContext: {
    courseFormat?: string | null;
    commune?: string | null;
    quartier?: string | null;
    transportFeeKey?: string | null;
  },
  scheduleBuffers: ScheduleBufferMinutes,
  conflictContext?: { grandAbidjanCommuneNames?: string[]; neighborhoodAliases?: NeighborhoodAliasMap },
): TravelPlanningNotice {
  if (occurrences.length === 0) {
    return {
      status: "idle",
      title: "Planning à compléter",
      description: "Choisissez une date et un horaire : le moteur vérifiera les cours déjà payés du professeur avant paiement.",
    };
  }

  let closestClear: {
    occurrence: ScheduleOccurrence;
    occupied: OccupiedTeacherSlot;
    gapMinutes: number;
    requiredBufferMinutes: number;
  } | null = null;

  for (const occurrence of occurrences) {
    const requestedSlotInput = {
      scheduledDate: occurrence.date,
      scheduledTime: occurrence.time,
      durationMinutes: occurrence.durationMinutes,
      courseFormat: requestContext.courseFormat,
      commune: requestContext.commune,
      quartier: requestContext.quartier,
      transportFeeKey: requestContext.transportFeeKey,
    };
    const requested = normalizeScheduleSlot(requestedSlotInput);
    if (!requested?.range) continue;

    for (const occupied of occupiedSlots) {
      if (occupied.date !== occurrence.date) continue;
      const existingSlotInput = {
        scheduledDate: occupied.date,
        scheduledTime: occupied.time,
        durationMinutes: occupied.durationMinutes,
        courseFormat: occupied.courseFormat,
        commune: occupied.commune,
        quartier: occupied.quartier,
        transportFeeKey: occupied.transportFeeKey,
      };
      const existing = normalizeScheduleSlot(existingSlotInput);
      if (!existing?.range) continue;
      const conflict = scheduleSlotsConflict(requestedSlotInput, existingSlotInput, scheduleBuffers, conflictContext);
      if (conflict) {
        const requestedLabel = `${formatDateInputLabel(occurrence.date)} · ${occurrence.time}`;
        const existingLabel = `${formatDateInputLabel(occupied.date)} · ${occupied.time}${occupied.bookingReference ? ` · ${occupied.bookingReference}` : ""}`;
        return {
          status: "blocked",
          title: conflict.kind === "TRAVEL_BUFFER" ? "Déplacement insuffisant" : "Créneau déjà payé",
          description: conflict.kind === "TRAVEL_BUFFER"
            ? `Le professeur a déjà un cours confirmé sur cette journée. Il faut ${conflict.requiredBufferMinutes} min de déplacement entre les deux lieux, mais la marge disponible est de ${Math.max(0, conflict.gapMinutes ?? 0)} min.`
            : "Ce créneau chevauche un cours déjà payé pour ce professeur. Choisissez une autre heure ou un autre professeur.",
          requestedLabel,
          existingLabel,
          requestedLocation: formatTravelLocation(requestContext),
          existingLocation: formatTravelLocation(occupied),
          requiredBufferMinutes: conflict.requiredBufferMinutes,
          gapMinutes: conflict.gapMinutes,
        };
      }

      const requestedBeforeExisting = requested.range.endMinutes <= existing.range.startMinutes;
      const existingBeforeRequested = existing.range.endMinutes <= requested.range.startMinutes;
      if (!requestedBeforeExisting && !existingBeforeRequested) continue;
      const gapMinutes = requestedBeforeExisting
        ? existing.range.startMinutes - requested.range.endMinutes
        : requested.range.startMinutes - existing.range.endMinutes;
      const requiredBufferMinutes = resolveTravelBufferMinutes(requestedSlotInput, existingSlotInput, scheduleBuffers, conflictContext);
      if (gapMinutes < requiredBufferMinutes) continue;
      if (!closestClear || gapMinutes < closestClear.gapMinutes) {
        closestClear = { occurrence, occupied, gapMinutes, requiredBufferMinutes };
      }
    }
  }

  if (closestClear) {
    return {
      status: "clear",
      title: "Marge de déplacement suffisante",
      description: `Le calcul se fait entre le dernier cours confirmé du professeur et votre cours demandé, pas depuis son domicile. Marge disponible : ${closestClear.gapMinutes} min pour ${closestClear.requiredBufferMinutes} min requis.`,
      requestedLabel: `${formatDateInputLabel(closestClear.occurrence.date)} · ${closestClear.occurrence.time}`,
      existingLabel: `${formatDateInputLabel(closestClear.occupied.date)} · ${closestClear.occupied.time}${closestClear.occupied.bookingReference ? ` · ${closestClear.occupied.bookingReference}` : ""}`,
      requestedLocation: formatTravelLocation(requestContext),
      existingLocation: formatTravelLocation(closestClear.occupied),
      requiredBufferMinutes: closestClear.requiredBufferMinutes,
      gapMinutes: closestClear.gapMinutes,
    };
  }

  return {
    status: "clear",
    title: "Aucun cours payé proche ce jour",
    description: "Le temps de déplacement sera quand même contrôlé côté serveur avant paiement Jèko. Le calcul utilise les cours confirmés du professeur, pas son domicile.",
  };
}

function formatTravelLocation(slot: { courseFormat?: string | null; commune?: string | null; quartier?: string | null }) {
  if (slot.courseFormat === "ONLINE") return "En ligne";
  return [slot.commune, slot.quartier].filter(Boolean).join(" · ") || "Lieu à confirmer";
}

function buildSessionPreview(timeLabels: string[], customTimeRequest: string, sessionsCount: number, startDateLabel: string) {
  const anchors = [
    ...timeLabels,
    ...(customTimeRequest ? [`Demande client : ${customTimeRequest}`] : []),
  ];
  if (anchors.length === 0) return [];

  return Array.from({ length: sessionsCount }, (_, index) => ({
    label: `Séance ${index + 1}`,
    date: index === 0 && startDateLabel ? startDateLabel : startDateLabel ? `À programmer après ${startDateLabel}` : "Date à confirmer",
    time: anchors[index % anchors.length],
    repeated: index >= anchors.length,
  }));
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase();
}

function createClientCreationKey() {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `booking:${randomPart}`;
}

function toJekoPaymentMethod(method: string) {
  const methods: Record<string, string> = {
    WAVE: "wave",
    ORANGE_MONEY: "orange",
    MTN_MONEY: "mtn",
    MOOV_MONEY: "moov",
    DJAMO: "djamo",
  };
  return methods[method] ?? "wave";
}

export function ReserverForm({
  teacher, subjects, levels, communes, pricingConfig, initialJourney, eligibleJourneys, initialPartnerReferral, initialPromotionBenefits, occupiedSlots,
}: {
  teacher: Teacher;
  subjects: { id: string; name: string; slug: string }[];
  levels: { id: string; name: string; slug: string }[];
  communes: CommuneOption[];
  pricingConfig: PricingConfig;
  initialJourney?: BookingJourney;
  eligibleJourneys: BookingJourney[];
  initialPartnerReferral?: InitialPartnerReferral;
  initialPromotionBenefits?: InitialPromotionBenefits;
  occupiedSlots: OccupiedTeacherSlot[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [clientCreationKey] = useState(createClientCreationKey);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("WAVE");
  const [priceChangeNotice, setPriceChangeNotice] = useState<PriceChangeNotice | null>(null);
  const [restrictionNotice, setRestrictionNotice] = useState<RestrictionNoticeState | null>(null);
  const [paymentLaunchMessage, setPaymentLaunchMessage] = useState("");
  const [promotionBenefits, setPromotionBenefits] = useState<InitialPromotionBenefits | undefined>(initialPromotionBenefits);
  const [partnerVerificationState, setPartnerVerificationState] = useState<"idle" | "checking" | "verified" | "invalid">(
    initialPartnerReferral ? "verified" : "idle",
  );
  const displayName = teacher.professionalName || teacher.fullName;
  const teacherAvailability = parseAvailability(teacher.availability);
  const todayIso = useMemo(() => toDateInputValue(new Date()), []);
  const initialCourseCategory = initialJourney === "professionnel" ? "formation_professionnelle" : "soutien_scolaire";
  const initialJourneySubjects = initialJourney ? filterSubjectsForJourney(subjects, initialJourney) : [];
  const initialJourneyLevels = initialJourney ? filterLevelsForJourney(levels, initialJourney) : [];
  const initialLevelName = suggestLevelForCategory(
    initialJourneyLevels.map((level) => level.name),
    initialCourseCategory,
    initialJourneyLevels[0]?.name ?? "",
  );
  const initialSubjectName = initialJourneySubjects.find((subject) => (
    teacher.subjects.some((item) => item.isPrimary && item.name === subject.name)
  ))?.name ?? initialJourneySubjects[0]?.name ?? "";

  // Form state
  const [form, setForm] = useState({
    clientType: initialJourney === "professionnel" ? "Professionnel" : "Parent",
    courseCategory: initialCourseCategory,
    schoolSystem: initialJourney && initialJourney !== "professionnel" ? initialJourney : "",
    preciseLevel: "",
    courseCatalogId: "",
    levelName: initialLevelName,
    subjectName: initialSubjectName,
    customSubjectDetail: "",
    objective: OBJECTIVES[0].value,
    schoolProgram: "",
    needDescription: "",
    courseFormat: teacher.offersHome ? "HOME" : (teacher.offersOnline ? "ONLINE" : "HOME"),
    groupType: "INDIVIDUAL",
    participantsCount: 1,
    city: "",
    commune: "",
    quartier: "",
    addressHint: "",
    onlineLink: "",
    selectedTimeSlots: [] as string[],
    customDay: "",
    customStartTime: "",
    customDurationMinutes: 120,
    customTimeRequest: "",
    startDate: "",
    packType: "SINGLE" as PackType,
    message: "",
    partnerReferralCode: initialPartnerReferral?.code ?? "",
    partnerReferralName: initialPartnerReferral?.promoterName ?? "",
    partnerReferralPhone: initialPartnerReferral?.promoterPhone ?? "",
  });

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function handleStartDateChange(value: string) {
    const dayKey = dayKeyFromDateInput(value);
    setForm((current) => {
      const requestContext = {
        courseFormat: current.courseFormat,
        commune: current.courseFormat === "HOME" ? current.commune : null,
        quartier: current.courseFormat === "HOME" ? current.quartier : null,
        transportFeeKey: null,
      };
      const localRelevantCommunes = new Set(
        [teacher.commune, current.commune].map(normalizeLocation).filter(Boolean),
      );
      const localConflictContext = {
        grandAbidjanCommuneNames: communes.filter((commune) => commune.transportClass === "GRAND_ABIDJAN").map((commune) => commune.name),
        neighborhoodAliases: buildNeighborhoodAliasMap(
          communes
            .filter((commune) => localRelevantCommunes.has(normalizeLocation(commune.name)))
            .flatMap((commune) => commune.quarters.map((quarter) => ({
              ...quarter,
              communeId: commune.id,
              communeName: commune.name,
            }))),
        ),
      };
      return {
        ...current,
        startDate: value,
        selectedTimeSlots: dayKey
          ? current.selectedTimeSlots.filter((slot) => (
              slot.startsWith(`${dayKey}|`)
              && !findOccupiedConflictForSelection(
                occupiedSlots,
                value,
                slot,
                requestContext,
                pricingConfig.scheduleBuffers,
                localConflictContext,
              )
            ))
          : current.selectedTimeSlots,
        customDay: current.customDay && dayKey && current.customDay !== dayKey ? "" : current.customDay,
        customStartTime: current.customDay && dayKey && current.customDay !== dayKey ? "" : current.customStartTime,
      };
    });
  }

  function handleCityChange(value: string) {
    setForm((current) => ({
      ...current,
      city: value,
      commune: isAbidjanCity(value) ? "" : value,
      quartier: "",
      addressHint: current.addressHint,
    }));
  }

  function handleCommuneChange(value: string) {
    setForm((current) => ({
      ...current,
      commune: value,
      quartier: "",
    }));
  }

  const requestedCatalogCourse = COURSE_CATALOG.find((item) => item.id === form.courseCatalogId);
  const courseCategoryResolution = resolveBookingCourseCategory({
    requestedCategory: form.courseCategory,
    levelName: form.levelName,
    preciseLevel: form.preciseLevel,
    subjectName: form.subjectName,
    catalogItem: requestedCatalogCourse,
  });
  const effectiveCourseCategory = courseCategoryResolution.category;
  const categoryCopy = getCategoryCopy(effectiveCourseCategory);
  const categoryLabel = COURSE_CATEGORIES.find((category) => category.code === effectiveCourseCategory)?.label ?? effectiveCourseCategory;
  const schoolContext = isSchoolContext(effectiveCourseCategory);
  const needsCustomSubjectDetail = /autre|sp[ée]cifique|besoin/i.test(form.subjectName);
  const preciseLevelOptions = schoolContext && form.schoolSystem
    ? getPreciseLevelOptions(form.schoolSystem, form.levelName)
    : [];
  const requiresPreciseLevel = preciseLevelOptions.length > 0;
  const bookingJourney = ["formation_professionnelle", "apprentissage_metier", "enseignement_superieur", "langues_communication"].includes(effectiveCourseCategory)
    ? "professionnel"
    : form.schoolSystem === "francais"
      ? "francais"
      : form.schoolSystem === "ivoirien"
        ? "ivoirien"
        : "";
  const eligibleJourneyChoices = BOOKING_JOURNEY_CHOICES.filter(({ value }) => eligibleJourneys.includes(value));
  const bookingJourneyIndex = Math.max(0, eligibleJourneyChoices.findIndex(({ value }) => value === bookingJourney));
  const bookingJourneyRailStyle = {
    "--journey-count": Math.max(1, eligibleJourneyChoices.length),
    "--journey-index": bookingJourneyIndex,
  } as CSSProperties;
  const journeySubjects = useMemo(
    () => bookingJourney ? filterSubjectsForJourney(subjects, bookingJourney) : [],
    [bookingJourney, subjects],
  );
  const journeyLevels = useMemo(
    () => bookingJourney ? filterLevelsForJourney(levels, bookingJourney) : [],
    [bookingJourney, levels],
  );
  const hasTeacherLevels = journeyLevels.length > 0;
  const hasTeacherSubjects = journeySubjects.length > 0;
  const teacherSubjectNames = useMemo(
    () => journeySubjects.map((subject) => subject.name),
    [journeySubjects],
  );
  const teacherLevelNames = useMemo(
    () => journeyLevels.map((level) => level.name),
    [journeyLevels],
  );
  const selectedCategoryCourses = COURSE_CATALOG.filter((item) => isCourseCatalogItemCompatible({
    item,
    category: effectiveCourseCategory,
    schoolSystem: form.schoolSystem,
    preciseLevel: form.preciseLevel,
    selectedLevel: form.levelName,
    teacherLevels: teacherLevelNames,
    teacherSubjects: teacherSubjectNames,
    selectedSubject: form.subjectName,
  })).sort((a, b) => (
    a.sous_categorie.localeCompare(b.sous_categorie, "fr")
    || a.nom.localeCompare(b.nom, "fr")
  ));
  const selectedCategoryCourseIds = new Set(selectedCategoryCourses.map((item) => item.id));
  const selectedCategoryCourseGroupMap = new Map<string, typeof selectedCategoryCourses>();
  for (const item of selectedCategoryCourses) {
    const existing = selectedCategoryCourseGroupMap.get(item.sous_categorie);
    if (existing) existing.push(item);
    else selectedCategoryCourseGroupMap.set(item.sous_categorie, [item]);
  }
  const selectedCategoryCourseGroups = Array.from(selectedCategoryCourseGroupMap.entries()).map(([subcategory, items]) => ({
    label: formatCatalogSubcategory(subcategory),
    options: items.map((item) => ({
      value: item.id,
      label: item.niveau ? `${item.matiere_ou_competence} - ${item.niveau}` : item.nom,
      keywords: `${item.matiere_ou_competence} ${item.niveau ?? ""} ${item.public_cible} ${item.objectif}`,
    })),
  }));
  const levelSelectionGroups = useMemo(() => [{
    label: hasTeacherLevels ? `Niveaux de ${displayName}` : "Niveaux à configurer",
    options: journeyLevels.map((level) => ({
      value: level.name,
      label: level.name,
      keywords: level.slug,
    })),
  }], [displayName, hasTeacherLevels, journeyLevels]);
  const subjectSelectionGroups = useMemo(() => [{
    label: hasTeacherSubjects ? `Matières de ${displayName}` : "Matières à configurer",
    options: journeySubjects.map((subject) => ({
      value: subject.name,
      label: subject.name,
      keywords: subject.slug,
    })),
  }], [displayName, hasTeacherSubjects, journeySubjects]);
  const grandAbidjanCommunes = useMemo(() => communes.filter((commune) => commune.transportClass === "GRAND_ABIDJAN"), [communes]);
  const neighborhoodAliases = useMemo(() => {
    const relevantCommunes = new Set(
      [teacher.commune, form.commune].map(normalizeLocation).filter(Boolean),
    );
    return buildNeighborhoodAliasMap(
      communes
        .filter((commune) => relevantCommunes.has(normalizeLocation(commune.name)))
        .flatMap((commune) => commune.quarters.map((quarter) => ({
          ...quarter,
          communeId: commune.id,
          communeName: commune.name,
        }))),
    );
  }, [communes, form.commune, teacher.commune]);
  const communeSelectionGroups = useMemo(() => [{
    label: "Villes de Côte d'Ivoire",
    options: buildCityOptions([
      "Abidjan",
      ...communes.filter((commune) => commune.transportClass !== "GRAND_ABIDJAN").map((commune) => commune.name),
    ]),
  }], [communes]);
  const abidjanCommuneGroups = useMemo(() => [{
    label: "Communes du Grand Abidjan",
    options: grandAbidjanCommunes.length > 0
      ? grandAbidjanCommunes.map((commune) => ({ value: commune.name, label: commune.name, keywords: `${commune.name} ${commune.zone ?? ""}` }))
      : buildAbidjanCommuneOptions(),
  }], [grandAbidjanCommunes]);
  const selectedCommune = useMemo(() => communes.find((commune) => normalizeLocation(commune.name) === normalizeLocation(form.commune)), [communes, form.commune]);
  const quartierSelectionGroups = useMemo(() => [{
    label: form.commune ? `Quartiers - ${form.commune}` : form.city ? `Quartiers - ${form.city}` : "Quartiers connus",
    options: selectedCommune?.quarters.length
      ? selectedCommune.quarters.map((quarter) => ({ value: quarter.name, label: quarter.name, keywords: `${quarter.name} ${quarter.aliases ?? ""} ${form.commune}` }))
      : buildQuartierOptions(form.commune || form.city),
  }], [form.city, form.commune, selectedCommune]);
  const safeCourseCatalogId = selectedCategoryCourseIds.has(form.courseCatalogId) ? form.courseCatalogId : "";
  const selectedCatalogCourse = COURSE_CATALOG.find((item) => item.id === safeCourseCatalogId);
  const schoolProgramPayload = buildSchoolProgramSummary({
    clientType: form.clientType,
    category: effectiveCourseCategory,
    schoolSystem: form.schoolSystem,
    preciseLevel: form.preciseLevel,
    courseCatalogId: safeCourseCatalogId,
    freeProgram: form.schoolProgram,
  });
  const participantsCount = form.groupType === "SMALL_GROUP" ? clampGroupParticipants(form.participantsCount) : 1;
  const deliveryMode = form.courseFormat === "ONLINE" ? "en_ligne" : "domicile";
  const canResolveTransport = form.courseFormat === "HOME" && Boolean(form.commune.trim());
  const selectedJekoPaymentMethod = toJekoPaymentMethod(selectedPaymentMethod);
  const pricing = calculateBookingPricing({
    category: effectiveCourseCategory,
    schoolSystem: form.schoolSystem,
    levelName: form.levelName,
    preciseLevel: form.preciseLevel,
    subjectName: form.subjectName,
    courseCatalogName: selectedCatalogCourse?.nom,
    objective: form.objective,
    deliveryMode,
    requiresMaterial: false,
    packType: form.packType,
    participantsCount,
    teacherPricePerSession: teacher.pricePerSession,
    paymentMethod: selectedJekoPaymentMethod,
    teacherCommune: canResolveTransport ? teacher.commune : undefined,
    teacherQuartier: canResolveTransport ? teacher.quartier : undefined,
    teacherZoneNames: canResolveTransport ? teacher.zones : undefined,
    clientCommune: canResolveTransport ? form.commune : undefined,
    clientQuartier: canResolveTransport ? form.quartier : undefined,
    platformCommissionPercent: pricingConfig.commissionPercent,
    transportFeeAmounts: pricingConfig.transportFees,
    grandAbidjanCommuneNames: grandAbidjanCommunes.map((commune) => commune.name),
    clientCommuneTransportFeeOverride: selectedCommune?.transportFeeOverride,
    neighborhoodAliases,
    partnerDiscountPercent: promotionBenefits?.partnerDiscountPercent ?? 0,
    partnerCommissionPercent: promotionBenefits?.partnerCommissionPercent ?? 0,
    rewardDiscountPercent: promotionBenefits?.reward?.discountRate ?? 0,
    minimumPlatformMarginPercent: promotionBenefits?.minimumMarginPercent ?? 5,
  });
  const scheduleRequestContext = {
    courseFormat: form.courseFormat,
    commune: form.courseFormat === "HOME" ? form.commune : null,
    quartier: form.courseFormat === "HOME" ? form.quartier : null,
    transportFeeKey: pricing.transportFeeKey,
  };
  const scheduleConflictContext = {
    grandAbidjanCommuneNames: grandAbidjanCommunes.map((commune) => commune.name),
    neighborhoodAliases,
  };
  const selectedPackSessions = pricing.numberOfSessions ?? packSessionCount(form.packType);
  const selectedPackLabel = PACK_OPTIONS.find((pack) => pack.value === form.packType)?.label ?? form.packType;
  const basePrice = selectedPackSessions > 0 ? pricing.unitSessionAmount * selectedPackSessions : 0;
  const courseFormulaAmount = pricing.courseAmount;
  const totalPrice = pricing.totalClientPays;
  const hasResolvedPricing = bookingJourney !== "";
  const averageSessionPrice = selectedPackSessions > 0 ? Math.round(pricing.courseAmount / selectedPackSessions) : 0;
  const normalizedCustomDurationMinutes = normalizeCustomDurationMinutes(form.customDurationMinutes);
  const usesCustomSchedule = form.selectedTimeSlots.length === 0 && Boolean(form.customDay && form.customStartTime);
  const selectedSessionDurationMinutes = usesCustomSchedule ? normalizedCustomDurationMinutes : 120;
  const selectedSessionDurationLabel = selectedSessionDurationMinutes === 60 ? "1h" : "2h";
  const totalHours = selectedPackSessions * selectedSessionDurationMinutes / 60;
  const extraParticipantCount = Math.max(0, participantsCount - 1);
  const surchargePerExtraParticipant = Math.round(basePrice * 0.5);
  const selectedDays = Array.from(new Set([
    ...form.selectedTimeSlots.map((slot) => slot.split("|")[0]),
    ...(form.customDay ? [form.customDay] : []),
  ]));
  const selectedTimeLabels = form.selectedTimeSlots.map(availabilitySelectionLabel);
  const customTimeRange = form.customStartTime ? formatTimeRange(form.customStartTime, normalizedCustomDurationMinutes) : "";
  const customTimeValidation = form.customStartTime
    ? validateCustomScheduleTime(form.customStartTime, normalizedCustomDurationMinutes)
    : { valid: true, reason: "" };
  const customTimeParts = [
    form.customDay && customTimeRange ? `${dayLabel(form.customDay)} ${customTimeRange}` : "",
    form.customTimeRequest.trim(),
  ].filter(Boolean);
  const customTimeRequest = customTimeParts.join(" - ");
  const preferredTimeSummary = [
    ...selectedTimeLabels,
    ...(customTimeRequest ? [`Demande client : ${customTimeRequest}`] : []),
  ];
  const selectedStartDateLabel = formatDateInputLabel(form.startDate);
  const selectedStartDayKey = dayKeyFromDateInput(form.startDate);
  const selectedStartDayLabel = selectedStartDayKey ? dayLabel(selectedStartDayKey) : "";
  const selectedAvailabilityDays = selectedStartDayKey
    ? WEEK_DAYS.filter((day) => day.key === selectedStartDayKey)
    : [];
  const progressPercent = Math.round(((step + 1) / STEPS.length) * 100);
  const currentStepDetail = STEP_DETAILS[step] ?? STEP_DETAILS[0];
  const primarySubjectLabel = form.subjectName
    || journeySubjects.find((subject) => teacher.subjects.some((item) => item.isPrimary && item.name === subject.name))?.name
    || journeySubjects[0]?.name
    || (bookingJourney === "professionnel" ? "Compétence à choisir" : "Matière à choisir");
  const teacherTrustSignal = teacher.rating > 0
    ? `Note ${teacher.rating.toFixed(1)}/5 · ${teacher.commune ?? "Abidjan"}`
    : `Certifié · ${teacher.commune ?? "Abidjan"}`;
  const hasScheduleDayMismatch = Boolean(
    form.startDate
    && selectedDays.length > 0
    && selectedStartDayKey
    && !selectedDays.includes(selectedStartDayKey),
  );
  const selectedScheduleOccurrences = buildScheduleOccurrences({
    startDate: form.startDate,
    selectedTimeSlots: form.selectedTimeSlots,
    sessionsCount: selectedPackSessions,
    fallbackTime: customTimeRange || null,
    fallbackDurationMinutes: normalizedCustomDurationMinutes,
  });
  const sessionPreview = buildSessionPreview(selectedTimeLabels, customTimeRequest, selectedPackSessions, selectedStartDateLabel);
  const selectedScheduleConflicts: OccupiedScheduleConflict[] = selectedScheduleOccurrences
    .map((occurrence) => {
      const conflict = findOccupiedConflictForTime(
        occupiedSlots,
        occurrence.date,
        occurrence.time,
        occurrence.durationMinutes,
        scheduleRequestContext,
        pricingConfig.scheduleBuffers,
        scheduleConflictContext,
      );
      return conflict
        ? { occurrence, occupied: conflict.occupied, conflict: conflict.conflict }
        : null;
    })
    .filter((item): item is OccupiedScheduleConflict => Boolean(item));
  const firstScheduleConflict = selectedScheduleConflicts[0] ?? null;
  const travelPlanningNotice = buildTravelPlanningNotice(
    selectedScheduleOccurrences,
    occupiedSlots,
    scheduleRequestContext,
    pricingConfig.scheduleBuffers,
    scheduleConflictContext,
  );
  const hasValidStartDate = Boolean(form.startDate && form.startDate >= todayIso);
  const hasValidTimeRequest = form.selectedTimeSlots.length > 0 || Boolean(form.customDay && form.customStartTime);
  const earliestCourseStartAt = form.startDate
    ? getEarliestCourseStartDateTime({
        dateInput: form.startDate,
        selectedTimeSlots: form.selectedTimeSlots,
        customStartTime: usesCustomSchedule ? form.customStartTime : null,
      })
    : null;
  const minimumBookingDeadline = new Date(Date.now() + MIN_BOOKING_NOTICE_HOURS * 60 * 60 * 1000);
  const hasMinimumBookingNotice = hasValidTimeRequest && respectsMinimumBookingNotice(earliestCourseStartAt);
  const hasMixedScheduleRequest = form.selectedTimeSlots.length > 0 && Boolean(form.customDay || form.customStartTime || form.customTimeRequest.trim());
  const isScheduleReadyForPayment = hasValidStartDate && hasValidTimeRequest && !hasMixedScheduleRequest && customTimeValidation.valid && !hasScheduleDayMismatch && !firstScheduleConflict && hasMinimumBookingNotice;
  const paymentScheduleWarning = !form.startDate
    ? "Sélectionnez une date de première séance avant de passer au paiement."
    : form.startDate < todayIso
      ? "La date sélectionnée est passée. Choisissez aujourd'hui ou une date ultérieure."
      : hasMixedScheduleRequest
        ? "Choisissez soit un créneau disponible, soit un autre horaire personnalisé, pas les deux."
        : !customTimeValidation.valid
          ? customTimeValidation.reason
          : hasScheduleDayMismatch
            ? `La date choisie tombe un ${selectedStartDayLabel.toLowerCase()}, mais le créneau choisi correspond à un autre jour.`
            : firstScheduleConflict
              ? formatOccupiedConflictMessage(firstScheduleConflict)
              : !hasValidTimeRequest
                ? "Sélectionnez un créneau de 2h ou indiquez une préférence horaire complète."
                : !hasMinimumBookingNotice
                  ? `Réservez au moins ${MIN_BOOKING_NOTICE_HOURS}h avant le début du cours. Choisissez un créneau à partir du ${formatDateTimeLabel(minimumBookingDeadline)}.`
                  : "";

  function openRestrictionNotice(notice: RestrictionNoticeState) {
    setRestrictionNotice(notice);
  }

  function showValidationRestriction(message: string, title = "Action impossible pour le moment") {
    openRestrictionNotice({
      title,
      description: message,
      variant: "restriction",
      primaryLabel: "OK",
    });
  }

  function showScheduleConflictNotice(conflict: OccupiedScheduleConflict) {
    const isTravel = conflict.conflict.kind === "TRAVEL_BUFFER";
    openRestrictionNotice({
      title: isTravel ? "Déplacement insuffisant" : "Créneau déjà payé",
      description: (
        <div className="space-y-3">
          <p>{formatOccupiedConflictMessage(conflict)}</p>
          <div className="grid gap-2 rounded-xl border border-white/60 bg-white/70 p-3 text-xs font-bold text-[#111827]">
            <span>Cours demandé : {formatDateInputLabel(conflict.occurrence.date)} · {conflict.occurrence.time} · {formatTravelLocation(scheduleRequestContext)}</span>
            <span>Cours existant : {formatDateInputLabel(conflict.occupied.date)} · {conflict.occupied.time} · {formatTravelLocation(conflict.occupied)}</span>
            {isTravel && (
              <span>
                Marge disponible : {Math.max(0, conflict.conflict.gapMinutes ?? 0)} min · temps requis : {conflict.conflict.requiredBufferMinutes} min.
              </span>
            )}
          </div>
        </div>
      ),
      variant: "restriction",
      primaryLabel: "Choisir une autre heure",
      onPrimary: () => {
        setStep(2);
        if (typeof window !== "undefined") {
          window.setTimeout(() => document.querySelector("[data-booking-schedule-section]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        }
      },
      secondaryLabel: "Changer de professeur",
      onSecondary: () => {
        const params = new URLSearchParams();
        if (bookingJourney) params.set("journey", bookingJourney);
        router.push(`/client/rechercher${params.toString() ? `?${params}` : ""}`);
      },
    });
  }

  function handleJourneyChange(journey: "ivoirien" | "francais" | "professionnel") {
    if (!eligibleJourneys.includes(journey)) {
      showValidationRestriction("Ce professeur n'enseigne pas dans ce système. Choisissez un parcours autorisé.", "Système non disponible");
      return;
    }
    const nextSubjects = filterSubjectsForJourney(subjects, journey);
    const nextLevels = filterLevelsForJourney(levels, journey);
    if (nextSubjects.length === 0 || nextLevels.length === 0) {
      showValidationRestriction("Ce professeur n'a pas encore de matière et niveau compatibles avec ce système.", "Profil incompatible");
      return;
    }
    const nextSubject = nextSubjects.find((subject) => (
      teacher.subjects.some((item) => item.isPrimary && item.name === subject.name)
    ))?.name ?? nextSubjects[0]?.name ?? "";
    setForm((current) => {
      const nextCategory = journey === "professionnel" ? "formation_professionnelle" : "soutien_scolaire";
      const nextLevel = suggestLevelForCategory(
        nextLevels.map((level) => level.name),
        nextCategory,
        nextLevels[0]?.name ?? "",
      );
      const canonicalCategory = resolveBookingCourseCategory({
        requestedCategory: nextCategory,
        levelName: nextLevel,
        preciseLevel: "",
        subjectName: nextSubject,
        catalogItem: null,
      }).category;
      return {
        ...current,
        clientType: journey === "professionnel" ? "Professionnel" : "Parent",
        courseCategory: canonicalCategory,
        levelName: nextLevel,
        subjectName: nextSubject,
        schoolSystem: journey === "professionnel" ? "" : journey,
        preciseLevel: "",
        courseCatalogId: "",
      };
    });
  }

  function handleCourseCatalogChange(courseCatalogId: string) {
    const course = COURSE_CATALOG.find((item) => item.id === courseCatalogId);
    setForm((current) => ({
      ...current,
      courseCatalogId,
      courseCategory: resolveBookingCourseCategory({
        requestedCategory: current.courseCategory,
        levelName: current.levelName,
        preciseLevel: current.preciseLevel,
        subjectName: current.subjectName,
        catalogItem: course,
      }).category,
      schoolSystem: course?.systeme_scolaire ?? current.schoolSystem,
    }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!bookingJourney) return "Choisissez d'abord le parcours : ivoirien, français ou professionnel.";
      if (!form.clientType) return "Veuillez sélectionner le type de client.";
      if (!form.courseCategory) return "Veuillez sélectionner la catégorie du besoin.";
      if (!hasTeacherLevels) return "Ce professeur n'a pas encore de niveau/profil configuré par le service client.";
      if (!hasTeacherSubjects) return "Ce professeur n'a pas encore de matière configurée par le service client.";
      if (!form.levelName) return `Veuillez sélectionner : ${categoryCopy.levelLabel.toLowerCase()}.`;
      if (schoolContext) {
        const educationValidation = validateEducationSelection({
          category: effectiveCourseCategory,
          levelName: form.levelName,
          schoolSystem: form.schoolSystem,
          preciseLevel: form.preciseLevel,
        });
        if (!educationValidation.ok) return educationValidation.error;
      }
      if (!form.subjectName) return `Veuillez sélectionner : ${categoryCopy.subjectLabel.toLowerCase()}.`;
      if (needsCustomSubjectDetail && form.customSubjectDetail.trim().length < 4) {
        return "Veuillez préciser la matière ou le besoin spécifique.";
      }
    }
    if (s === 1) {
      if (!form.courseFormat) return "Veuillez choisir un format de cours.";
    }
    if (s === 2) {
      if (form.courseFormat === "HOME") {
        if (!form.city) return "Veuillez sélectionner votre ville.";
        if (isAbidjanCity(form.city) && !form.commune) return "Veuillez sélectionner la commune d'Abidjan concernée.";
        if (!form.commune) return "Veuillez sélectionner votre commune ou ville.";
        if (!form.quartier.trim()) return "Veuillez indiquer votre quartier.";
        if (!form.addressHint.trim()) return "Veuillez indiquer un repère ou une adresse approximative pour le cours à domicile.";
      }
      if (!form.startDate) {
        return "Veuillez sélectionner la date souhaitée pour commencer les séances.";
      }
      if (form.startDate < todayIso) {
        return "La date souhaitée ne peut pas être dans le passé. Choisissez aujourd'hui ou une date ultérieure.";
      }
      if (hasMixedScheduleRequest) {
        return "Choisissez soit un créneau disponible, soit un autre horaire personnalisé, pas les deux.";
      }
      if (form.selectedTimeSlots.length === 0 && !customTimeRequest) {
        return "Sélectionnez un créneau disponible ou indiquez votre horaire souhaité.";
      }
      if (form.selectedTimeSlots.length === 0 && (!form.customDay || !form.customStartTime)) {
        return "Pour une demande personnalisée sans créneau sélectionné, indiquez le jour et l'heure souhaités.";
      }
      if ((form.customDay && !form.customStartTime) || (!form.customDay && form.customStartTime)) {
        return "Pour une demande personnalisée, indiquez le jour et l'heure souhaités.";
      }
      if (!customTimeValidation.valid) {
        return customTimeValidation.reason;
      }
      if (hasScheduleDayMismatch) {
        return `La date choisie tombe un ${selectedStartDayLabel.toLowerCase()}. Sélectionnez un créneau du ${selectedStartDayLabel.toLowerCase()} ou modifiez la date.`;
      }
      if (firstScheduleConflict) {
        return formatOccupiedConflictMessage(firstScheduleConflict);
      }
      if (!hasMinimumBookingNotice) {
        return paymentScheduleWarning;
      }
    }
    if (s === 4) {
      if (firstScheduleConflict) return formatOccupiedConflictMessage(firstScheduleConflict);
      if (!isScheduleReadyForPayment) return paymentScheduleWarning || "Veuillez compléter le planning avant paiement.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      showValidationRestriction(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updatePartnerField(field: "partnerReferralCode" | "partnerReferralName" | "partnerReferralPhone", value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setPartnerVerificationState("idle");
    setPromotionBenefits(undefined);
  }

  async function verifyPartner() {
    if (!form.partnerReferralCode.trim() && (!form.partnerReferralName.trim() || !form.partnerReferralPhone.trim())) {
      showValidationRestriction("Saisissez le code partenaire, ou son nom avec son numéro.", "Informations partenaire incomplètes");
      return false;
    }
    setPartnerVerificationState("checking");
    const response = await fetch("/api/client/partner-referral/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.partnerReferralCode.trim() || undefined,
        name: form.partnerReferralName.trim() || undefined,
        phone: form.partnerReferralPhone.trim() || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPartnerVerificationState("invalid");
      showValidationRestriction(data.error || "Partenaire non vérifié.", "Code partenaire non appliqué");
      return false;
    }
    setForm((current) => ({
      ...current,
      partnerReferralCode: data.partner.code,
      partnerReferralName: data.partner.promoterName,
      partnerReferralPhone: data.partner.promoterPhone,
    }));
    setPromotionBenefits(data.benefits);
    setPartnerVerificationState("verified");
    setRestrictionNotice({
      title: data.benefits.partnerDiscountPercent > 0 ? "Réduction de 10 % appliquée" : "Partenaire confirmé",
      description: data.benefits.partnerDiscountPercent > 0
        ? "Le montant du cours vient d'être recalculé. Le professeur conserve son montant exact et le partenaire recevra 10 % sur chaque paiement éligible pendant six mois."
        : "Votre compte est déjà rattaché à ce partenaire. Sa commission reste active jusqu'à la fin des six mois.",
      variant: "info",
      primaryLabel: "Voir le nouveau total",
      onPrimary: () => setRestrictionNotice(null),
    });
    return true;
  }

  async function submit(confirmedPricingFingerprint?: string) {
    const err = [0, 1, 2, 3, 4].map(validateStep).find(Boolean);
    if (err) {
      showValidationRestriction(err);
      return;
    }
    const hasPartnerInput = Boolean(form.partnerReferralCode.trim() || form.partnerReferralName.trim() || form.partnerReferralPhone.trim());
    if (hasPartnerInput && partnerVerificationState !== "verified") {
      await verifyPartner();
      return;
    }
    setSubmitting(true);
    setPaymentLaunchMessage("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: teacher.id,
          subjectName: form.subjectName,
          levelName: form.levelName,
          objective: form.objective,
          clientType: form.clientType,
          courseCategory: effectiveCourseCategory,
          schoolSystem: form.schoolSystem || undefined,
          preciseLevel: form.preciseLevel || undefined,
          courseCatalogId: safeCourseCatalogId || undefined,
          schoolProgram: form.schoolProgram || undefined,
          needDescription: [
            needsCustomSubjectDetail ? `Matière / besoin spécifique : ${form.customSubjectDetail.trim()}` : "",
            form.needDescription.trim(),
          ].filter(Boolean).join("\n\n") || undefined,
          courseFormat: form.courseFormat,
          groupType: form.groupType,
          participantsCount,
          requiresMaterial: false,
          commune: form.commune.trim(),
          quartier: form.quartier.trim(),
          addressHint: form.addressHint.trim(),
          onlineLink: form.onlineLink.trim(),
          preferredDays: selectedDays,
          selectedTimeSlots: form.selectedTimeSlots,
          preferredTime: preferredTimeSummary.join(" ; "),
          customStartTime: form.customStartTime || undefined,
          customDurationMinutes: usesCustomSchedule ? normalizedCustomDurationMinutes : undefined,
          startDate: form.startDate || undefined,
          sessionsCount: PACK_OPTIONS.find((p) => p.value === form.packType)?.count ?? 1,
          packType: form.packType,
          message: form.message.trim(),
          partnerReferralCode: form.partnerReferralCode || undefined,
          partnerReferralName: form.partnerReferralName.trim() || undefined,
          partnerReferralPhone: form.partnerReferralPhone.trim() || undefined,
          clientCreationKey,
          paymentMethod: toJekoPaymentMethod(selectedPaymentMethod),
          expectedPricing: {
            unitSessionAmount: pricing.unitSessionAmount,
            courseAmount: pricing.courseAmount,
            transportFee: pricing.transportFee,
            paymentServiceFeeAmount: pricing.paymentServiceFeeAmount,
            paymentProviderFeeAmount: pricing.paymentProviderFeeAmount,
            paymentProviderFeeMethod: pricing.paymentProviderFeeMethod,
            totalClientPays: pricing.totalClientPays,
            priceTierKey: pricing.priceTierKey,
            partnerDiscountAmount: pricing.partnerDiscountAmount,
            rewardDiscountAmount: pricing.rewardDiscountAmount,
            partnerCommissionAmount: pricing.partnerCommissionAmount,
          },
          confirmedPricingFingerprint,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (
          res.status === 409
          && data.code === "PRICE_CHANGED"
          && data.requiresPriceConfirmation === true
          && typeof data.pricingFingerprint === "string"
          && data.pricing
        ) {
          setPriceChangeNotice({
            fingerprint: data.pricingFingerprint,
            previous: {
              courseAmount: pricing.courseAmount,
              transportFee: pricing.transportFee,
              paymentServiceFeeAmount: pricing.paymentServiceFeeAmount,
              paymentProviderFeeAmount: pricing.paymentProviderFeeAmount,
              totalClientPays: pricing.totalClientPays,
            },
            current: data.pricing,
          });
          return;
        }
        showValidationRestriction(data.error || "Erreur lors de la réservation", "Réservation impossible");
        return;
      }
      setPriceChangeNotice(null);
      if (isAllowedJekoRedirectUrl(data.payment?.checkoutUrl)) {
        setPaymentLaunchMessage("Page Jèko prête. Ouverture du paiement sécurisé...");
        window.location.assign(data.payment.checkoutUrl);
      } else if (data.payment?.status === "succeeded") {
        setPaymentLaunchMessage("Paiement confirmé. Ouverture de votre réservation...");
        router.push(`/client/reservations/${data.booking.id}?jeko=confirmed`);
      } else {
        openRestrictionNotice({
          title: "Paiement à reprendre",
          description: data.payment?.message || data.payment?.error || "Jèko n'a pas renvoyé de lien de paiement sécurisé. Le dossier reste en brouillon et aucun professeur n'est notifié.",
          variant: "warning",
          primaryLabel: "Ouvrir le dossier",
          onPrimary: () => router.push(`/client/reservations/${data.booking.id}?payment=pending`),
        });
      }
    } catch (e: any) {
      showValidationRestriction("Erreur réseau, veuillez réessayer.", "Connexion impossible");
    } finally {
      setSubmitting(false);
    }
  }

  const isFinalStep = step === STEPS.length - 1;
  const primaryActionLabel = isFinalStep ? "Payer via Jèko" : "Continuer";
  const primaryActionDisabled = submitting;
  const handlePrimaryAction = () => {
    if (isFinalStep) {
      void submit();
      return;
    }
    next();
  };

  return (
    <div className="client-booking-form client-booking-flow mx-auto w-full max-w-7xl space-y-3 pb-36 sm:pb-8">
      <section className="client-booking-shell min-w-0 overflow-hidden rounded-lg border border-[#DDE6F7] bg-white">
        <div className="border-b border-[#E6EAF3] px-3 py-2 sm:px-5">
          <BackButton fallbackHref="/client/rechercher" className="min-h-10 rounded-lg px-3" />
        </div>
        <div className="client-booking-hero grid min-w-0 gap-3 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)] lg:items-center">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <ProfessorImage photoUrl={teacher.photoUrl} name={displayName} size={64} shape="circle" verified={teacher.badgeVerified} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Réservation</p>
              <h1 className="truncate text-xl font-semibold tracking-normal text-[#111827] sm:text-2xl">{displayName}</h1>
              <p className="mt-0.5 truncate text-sm font-medium text-[#64748B]">{teacher.jobTitle} · {teacher.commune ?? "Abidjan"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ProfessorTrustBadges
                  verified={teacher.badgeVerified}
                  recommended={teacher.badgeRecommended}
                  premium={teacher.badgePremium}
                  popular={teacher.badgePopular}
                  isNew={teacher.badgeNew}
                  size="sm"
                  maxSecondary={0}
                />
                <span className="hidden min-h-8 items-center gap-1.5 text-xs font-semibold text-[#111B4D] min-[420px]:inline-flex">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Paiement protégé
                </span>
              </div>
            </div>
          </div>

          <div className="client-booking-total-card hidden rounded-lg border border-[#111B4D] bg-[#111B4D] p-3 text-white min-[720px]:block">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#DDE6F7]">Total actuel</p>
                <p className="mt-1 text-2xl font-semibold leading-tight text-white">
                  {hasResolvedPricing ? formatFCFA(totalPrice) : "À calculer"}
                </p>
              </div>
              <WalletCards className="mt-1 h-5 w-5 text-white" />
            </div>
            <p className="mt-2 text-xs font-medium leading-5 text-white">
              {!hasResolvedPricing
                ? "Choisissez votre parcours pour calculer le tarif officiel."
                : pricing.transportFeePending
                ? "Déplacement en attente du choix de la commune."
                : pricing.transportFee > 0
                  ? `Déplacement inclus : ${formatFCFA(pricing.transportFee)}`
                  : "Aucun frais de déplacement ajouté."}
            </p>
          </div>
        </div>

        <div data-client-booking-progress className="client-booking-progress border-t border-[#E6EAF3] px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827]">Étape {step + 1} sur {STEPS.length} · {currentStepDetail.title}</p>
              <p className="mt-0.5 hidden text-sm text-[#64748B] sm:block">{currentStepDetail.description}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-[#111B4D]">{progressPercent}%</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full bg-[#111B4D] transition-[width] duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      <div className="client-booking-workspace grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="client-booking-step-card client-booking-step-panel min-w-0 overflow-hidden rounded-lg border-[#DDE6F7] bg-white">
          <CardContent className="p-4 sm:p-6">
            {/* Step 1 — Besoin */}
            {step === 0 && (
            <div className="space-y-5">
              <StepIntro step="Étape 1" title="Besoin du cours" description={categoryCopy.intro} />
              <div>
                <Label>Quel parcours ? *</Label>
                <div
                  className="journey-switcher mt-2"
                  data-size="regular"
                  data-booking-journey-switcher
                  data-mini-app-tabs
                  data-active-journey={bookingJourney || "none"}
                  data-journey-count={eligibleJourneyChoices.length}
                >
                  <div className="journey-switcher__rail" style={bookingJourneyRailStyle} role="tablist" aria-label="Choisir un parcours" data-mini-app-tablist>
                    <span className="journey-switcher__indicator" aria-hidden="true" />
                    {eligibleJourneyChoices.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleJourneyChange(value)}
                        aria-selected={bookingJourney === value}
                        role="tab"
                        data-active={bookingJourney === value ? "true" : "false"}
                        data-journey-tab={value}
                        className="journey-switcher__link"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-center text-xs font-semibold text-[#64748B]">
                  {eligibleJourneyChoices.find(({ value }) => value === bookingJourney)?.detail}
                </p>
              </div>
              {bookingJourney && (
              <>
              <div className="grid gap-4 min-[720px]:grid-cols-2">
                <div>
                  <Label htmlFor="levelName">{categoryCopy.levelLabel} *</Label>
                  <SearchableCatalogSelect
                    id="levelName"
                    name="levelName"
                    value={form.levelName}
                    onValueChange={(value) => setForm((current) => {
                      const nextPreciseLevel = "";
                      return {
                        ...current,
                        levelName: value,
                        preciseLevel: nextPreciseLevel,
                        courseCatalogId: "",
                        courseCategory: resolveBookingCourseCategory({
                          requestedCategory: current.courseCategory,
                          levelName: value,
                          preciseLevel: nextPreciseLevel,
                          subjectName: current.subjectName,
                          catalogItem: null,
                        }).category,
                      };
                    })}
                    placeholder={`Rechercher ${categoryCopy.levelLabel.toLowerCase()}`}
                    searchPlaceholder="Tapez le niveau, profil, diplôme ou concours..."
                    emptyLabel="Aucun niveau configuré pour ce professeur."
                    allLabel="Aucun niveau choisi"
                    groups={levelSelectionGroups}
                    triggerClassName="mt-1.5 min-h-12 rounded-lg"
                  />
                  {journeyLevels.length > 0 ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[#64748B]">
                      {bookingJourney === "professionnel" ? "Profils couverts" : "Niveaux couverts"} : {journeyLevels.map((item) => item.name).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-[#111B4D]">
                      Aucun niveau n'est configuré pour ce professeur. Le service client doit compléter sa fiche.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="subjectName">{categoryCopy.subjectLabel} *</Label>
                  {journeySubjects.length === 1 ? (
                    <div className="mt-1.5 flex min-h-12 items-center rounded-lg border border-[#DDE6F7] bg-[#F8FAFD] px-3 text-sm font-semibold text-[#111827]">
                      {form.subjectName}
                    </div>
                  ) : (
                    <SearchableCatalogSelect
                      id="subjectName"
                      name="subjectName"
                      value={form.subjectName}
                      onValueChange={(value) => setForm((current) => ({
                        ...current,
                        subjectName: value,
                        courseCatalogId: "",
                        courseCategory: resolveBookingCourseCategory({
                          requestedCategory: current.courseCategory,
                          levelName: current.levelName,
                          preciseLevel: current.preciseLevel,
                          subjectName: value,
                          catalogItem: null,
                        }).category,
                      }))}
                      placeholder={`Rechercher ${categoryCopy.subjectLabel.toLowerCase()}`}
                      searchPlaceholder="Tapez une matière, compétence ou module..."
                      emptyLabel="Aucune matière configurée pour ce professeur."
                      allLabel="Aucune matière choisie"
                      groups={subjectSelectionGroups}
                      triggerClassName="mt-1.5 min-h-12 rounded-lg"
                    />
                  )}
                  {hasTeacherSubjects && journeySubjects.length > 1 ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[#64748B]">
                      {bookingJourney === "professionnel" ? "Compétences proposées" : "Matières enseignées"} par {displayName}.
                    </p>
                  ) : !hasTeacherSubjects ? (
                    <p className="mt-1 text-xs font-medium text-[#111B4D]">
                      Aucune matière n'est configurée pour ce professeur. Le service client doit compléter sa fiche.
                    </p>
                  ) : null}
                </div>
                {requiresPreciseLevel && (
                  <div className="min-[720px]:col-span-2 rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <Label htmlFor="preciseLevel">Classe exacte *</Label>
                    <select
                      id="preciseLevel"
                      value={form.preciseLevel}
                      onChange={(e) => setForm((current) => ({ ...current, preciseLevel: e.target.value, courseCatalogId: "" }))}
                      className={FIELD_CLASS}
                    >
                      <option value="">Choisir la classe...</option>
                      {preciseLevelOptions.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <p className="mt-3 text-xs font-medium text-[#6B7280]">
                      La classe applique automatiquement le bon tarif officiel. Aucun prix propre au professeur n'intervient.
                    </p>
                  </div>
                )}
                {needsCustomSubjectDetail && (
                  <div className="min-[720px]:col-span-2 rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <Label htmlFor="customSubjectDetail">Précisez la matière ou le besoin *</Label>
                    <Textarea
                      id="customSubjectDetail"
                      value={form.customSubjectDetail}
                      onChange={(e) => update("customSubjectDetail", e.target.value)}
                      placeholder="Ex : préparation concours INFAS, dessin technique, bureautique Excel, oral d'anglais, module universitaire précis..."
                      className="mt-1.5 min-h-24 bg-white"
                    />
                    <p className="mt-1 text-xs text-[#64748B]">
                      Cette précision sera transmise au service client avec la réservation de {displayName}.
                    </p>
                  </div>
                )}
              </div>
              <details className="rounded-lg border border-[#E3E8F2] bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[#111B4D]">
                  Ajouter des précisions (optionnel)
                </summary>
                <div className="mt-4 space-y-4 border-t border-[#E6EAF3] pt-4">
                  <div>
                    <Label htmlFor="courseCatalogId">Cours précis</Label>
                    <SearchableCatalogSelect
                      id="courseCatalogId"
                      value={safeCourseCatalogId}
                      onValueChange={handleCourseCatalogChange}
                      name="courseCatalogId"
                      placeholder="Rechercher un cours compatible"
                      searchPlaceholder="Tapez une matière, un niveau ou un mot-clé..."
                      emptyLabel="Aucun cours catalogue compatible avec ce professeur."
                      allLabel="Aucun cours précis"
                      groups={selectedCategoryCourseGroups}
                      triggerClassName="mt-1.5 min-h-12 rounded-lg"
                    />
                  </div>
                  {selectedCatalogCourse && (
                    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                      <p className="text-sm font-semibold text-[#111827]">{selectedCatalogCourse.nom}</p>
                      <p className="mt-1 text-xs leading-5 text-[#6B7280]">{selectedCatalogCourse.objectif}</p>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="objective">Objectif</Label>
                    <select
                      id="objective"
                      value={form.objective}
                      onChange={(e) => update("objective", e.target.value)}
                      className={FIELD_CLASS}
                    >
                      {OBJECTIVES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="schoolProgram">{categoryCopy.programLabel}</Label>
                    <Input
                      id="schoolProgram"
                      value={form.schoolProgram}
                      onChange={(e) => update("schoolProgram", e.target.value)}
                      placeholder={categoryCopy.programPlaceholder}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="needDescription">{categoryCopy.descriptionLabel}</Label>
                    <Textarea
                      id="needDescription"
                      value={form.needDescription}
                      onChange={(e) => update("needDescription", e.target.value)}
                      placeholder={categoryCopy.descriptionPlaceholder}
                      rows={3}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </details>
              </>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <StepIntro step="Étape 2" title="Format du cours" description="Choisissez le mode, le type de cours et le nombre de participants." />
              <div>
                <Label>Mode de cours *</Label>
                <div className="mt-2 grid gap-3 min-[720px]:grid-cols-2">
                  <button
                    type="button"
                    disabled={!teacher.offersHome}
                    onClick={() => update("courseFormat", "HOME")}
                    className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
                      form.courseFormat === "HOME"
                        ? "border-[#111B4D] bg-white text-[#111B4D]"
                        : "border-[#E3E8F2] bg-white hover:border-[#111B4D] hover:bg-white"
                    } ${!teacher.offersHome ? "cursor-not-allowed border-[#E3E8F2] text-[#9CA3AF]" : ""}`}
                  >
                    <Home className={`mt-0.5 h-5 w-5 ${form.courseFormat === "HOME" ? "text-[#111B4D]" : "text-[#64748B]"}`} />
                    <div>
                      <p className="text-sm font-medium text-[#111827]">À domicile</p>
                      <p className="text-xs text-[#64748B]">Le professeur se déplace chez vous.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={!teacher.offersOnline}
                    onClick={() => update("courseFormat", "ONLINE")}
                    className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
                      form.courseFormat === "ONLINE"
                        ? "border-[#111B4D] bg-white text-[#111B4D]"
                        : "border-[#E3E8F2] bg-white hover:border-[#111B4D] hover:bg-white"
                    } ${!teacher.offersOnline ? "cursor-not-allowed border-[#E3E8F2] text-[#9CA3AF]" : ""}`}
                  >
                    <Video className={`mt-0.5 h-5 w-5 ${form.courseFormat === "ONLINE" ? "text-[#111B4D]" : "text-[#64748B]"}`} />
                    <div>
                      <p className="text-sm font-medium text-[#111827]">En ligne</p>
                      <p className="text-xs text-[#64748B]">Cours via Meet, Zoom ou WhatsApp.</p>
                    </div>
                  </button>
                </div>
              </div>
              {teacher.offersGroup && (
                <div>
                  <Label>Type de cours *</Label>
                  <RadioGroup
                    value={form.groupType}
                    onValueChange={(v) => {
                      setForm((current) => ({
                        ...current,
                        groupType: v,
                        participantsCount: v === "SMALL_GROUP" ? clampGroupParticipants(current.participantsCount) : 1,
                      }));
                    }}
                    className="mt-2 grid gap-3 min-[720px]:grid-cols-2"
                  >
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                      form.groupType === "INDIVIDUAL" ? "border-[#111B4D] bg-white text-[#111B4D]" : "border-[#E3E8F2] bg-white hover:border-[#111B4D] hover:bg-white"
                    }`}>
                      <RadioGroupItem value="INDIVIDUAL" />
                      <User className="h-5 w-5 text-[#64748B]" />
                      <div>
                        <p className="text-sm font-medium text-[#111827]">Cours individuel</p>
                        <p className="text-xs text-[#64748B]">Un seul élève.</p>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                      form.groupType === "SMALL_GROUP" ? "border-[#111B4D] bg-white text-[#111B4D]" : "border-[#E3E8F2] bg-white hover:border-[#111B4D] hover:bg-white"
                    }`}>
                      <RadioGroupItem value="SMALL_GROUP" />
                      <Users className="h-5 w-5 text-[#64748B]" />
                      <div>
                        <p className="text-sm font-medium text-[#111827]">Petit groupe</p>
                        <p className="text-xs text-[#64748B]">
                          Plusieurs élèves. +50% du montant de base par participant supplémentaire.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {form.groupType === "SMALL_GROUP" && (
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                  <div className="grid gap-4 min-[720px]:grid-cols-[1fr_220px] min-[640px]:items-end">
                    <div>
                      <Label htmlFor="participantsCount">Nombre de participants *</Label>
                      <p className="mt-1 text-sm text-[#64748B]">
                        Le premier participant paie le tarif normal. Chaque participant supplémentaire ajoute 50% du montant de base.
                      </p>
                    </div>
                    <Input
                      id="participantsCount"
                      type="number"
                      min={2}
                      max={12}
                      value={participantsCount}
                      onChange={(event) => update("participantsCount", clampGroupParticipants(event.target.value))}
                      className="h-11 rounded-lg bg-white"
                    />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm min-[760px]:grid-cols-3">
                    <InfoMini label="Base" value={formatFCFA(basePrice)} />
                    <InfoMini label="Par participant en plus" value={`+${formatFCFA(surchargePerExtraParticipant)}`} />
                    <InfoMini label="Total formule groupe" value={formatFCFA(courseFormulaAmount)} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-[#6B7280]">
                    Calcul groupe : {formatFCFA(basePrice)} + {formatCount(extraParticipantCount, "participant supplémentaire", "participants supplémentaires")} x {formatFCFA(surchargePerExtraParticipant)} = {formatFCFA(courseFormulaAmount)}.
                  </p>
                </div>
              )}

              {(effectiveCourseCategory === "apprentissage_metier" || effectiveCourseCategory === "formation_professionnelle") && (
                <div className="flex items-start gap-3 rounded-lg border border-[#DDE6F7] bg-white p-4 text-sm text-[#111827]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                  <span>
                    <span className="block font-semibold">Matériel obligatoire à la charge de l'apprenant</span>
                    <span className="mt-1 block text-[#6B7280]">
                      Compétence ne fournit, ne loue et ne facture aucun matériel. Pour les formations professionnelles ou métiers pratiques,
                      l'apprenant doit disposer du matériel demandé avant la séance.
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Lieu & dispo */}
          {step === 2 && (
            <div className="space-y-5">
              <StepIntro step="Étape 3" title="Lieu et disponibilité" description="Choisissez une date, un lieu et un horaire compatible avec le professeur." />

              {form.courseFormat === "HOME" ? (
                <div className="grid gap-4 min-[720px]:grid-cols-2">
                  <div>
                    <Label htmlFor="city">Ville *</Label>
                    <SearchableCatalogSelect
                      id="city"
                      name="city"
                      value={form.city}
                      onValueChange={handleCityChange}
                      placeholder="Saisir ou rechercher la ville"
                      searchPlaceholder="Tapez Abidjan, Bouaké, Yamoussoukro..."
                      emptyLabel="Aucune ville disponible."
                      allLabel="Aucune ville choisie"
                      groups={communeSelectionGroups}
                      triggerClassName="mt-1.5 min-h-12 rounded-lg"
                      allowCustomValue
                      customValueLabel="Utiliser cette ville"
                    />
                  </div>
                  {isAbidjanCity(form.city) && (
                    <div>
                      <Label htmlFor="commune">Commune d'Abidjan *</Label>
                      <SearchableCatalogSelect
                        id="commune"
                        name="commune"
                        value={form.commune}
                        onValueChange={handleCommuneChange}
                        placeholder="Choisir Cocody, Yopougon, Marcory..."
                        searchPlaceholder="Tapez Cocody, Angré, Riviera, Yopougon..."
                        emptyLabel="Aucune commune d'Abidjan trouvée."
                        allLabel="Aucune commune choisie"
                        groups={abidjanCommuneGroups}
                        triggerClassName="mt-1.5 min-h-12 rounded-lg"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="quartier">Quartier *</Label>
                    <SearchableCatalogSelect
                      id="quartier"
                      name="quartier"
                      value={form.quartier}
                      onValueChange={(value) => update("quartier", value)}
                      placeholder="Sélectionner ou saisir le quartier"
                      searchPlaceholder="Tapez le quartier, ex : Riviera, Zone 4..."
                      emptyLabel="Aucun quartier trouvé."
                      allLabel="Aucun quartier choisi"
                      groups={quartierSelectionGroups}
                      triggerClassName="mt-1.5 min-h-12 rounded-lg"
                      allowCustomValue
                      customValueLabel="Utiliser ce quartier"
                    />
                  </div>
                  <div className={isAbidjanCity(form.city) ? undefined : "min-[720px]:col-span-2"}>
                    <Label htmlFor="addressHint">Repère / adresse approximative *</Label>
                    <Textarea
                      id="addressHint"
                      value={form.addressHint}
                      onChange={(e) => update("addressHint", e.target.value)}
                      placeholder="Ex : près de la pharmacie, immeuble blanc, entrée principale... L'adresse exacte peut être confirmée après validation."
                      rows={2}
                    />
                  </div>
                  <div className="min-[720px]:col-span-2 rounded-lg border border-[#DDE6F7] bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111827]">Déplacement</p>
                        <p className="mt-0.5 text-xs font-medium leading-5 text-[#64748B]">
                          {form.commune
                            ? `${pricing.transportRouteLabel ?? formatLocationSummary(form.city, form.commune, form.quartier)} · ${formatSentencePart(pricing.transportRuleLabel ?? "règle de déplacement")}`
                            : "Choisissez votre commune pour obtenir le montant exact."}
                        </p>
                      </div>
                      <p className="shrink-0 text-base font-semibold text-[#111B4D]">
                        {!form.commune ? "À calculer" : pricing.transportFee === 0 ? "Gratuit" : formatFCFA(pricing.transportFee)}
                      </p>
                    </div>
                    {form.commune && pricing.transportFee > 0 && (
                      <p className="mt-1 text-xs font-medium text-[#64748B]">Versé intégralement au professeur.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="onlineLink">Lien préféré (optionnel)</Label>
                  <Input
                    id="onlineLink"
                    value={form.onlineLink}
                    onChange={(e) => update("onlineLink", e.target.value)}
                    placeholder="Ex: Meet, Zoom — le service client ajoutera le lien définitif"
                  />
                  <p className="mt-1 text-xs text-[#64748B]">
                    Le lien de connexion définitif sera communiqué après validation de la réservation.
                  </p>
                </div>
              )}

              <Separator />

              <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
                  <div>
                    <Label htmlFor="startDate" className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                      <CalendarDays className="h-4 w-4" />
                      Date de la première séance *
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      min={todayIso}
                      value={form.startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      onInput={(e) => handleStartDateChange(e.currentTarget.value)}
                      className="mt-2 h-12 rounded-lg"
                      aria-invalid={!hasValidStartDate}
                      required
                    />
                    <p className="mt-1.5 text-xs text-[#64748B]">
                      Le client doit réserver au moins {MIN_BOOKING_NOTICE_HOURS}h avant le début du cours. Cette date est reprise au récapitulatif, au paiement et dans l'espace service client.
                    </p>
                  </div>
                  <div className={`rounded-lg border px-4 py-3 ${
                    hasScheduleDayMismatch
                      ? "border-[#111B4D] bg-white text-[#111827]"
                      : selectedStartDateLabel
                        ? "border-[#DDE6F7] bg-white text-[#111827]"
                        : "border-[#E3E8F2] bg-white text-[#111B4D]"
                  }`}>
                    <p className="text-xs font-semibold uppercase tracking-normal text-[#6B7280]">Date retenue pour le paiement</p>
                    <p className="mt-1 text-base font-semibold leading-snug">
                      {selectedStartDateLabel || "À sélectionner avant paiement"}
                    </p>
                    <p className="mt-1 text-sm leading-snug text-[#64748B]">
                      {hasScheduleDayMismatch
                        ? `Cette date tombe un ${selectedStartDayLabel.toLowerCase()}, mais aucun créneau de ce jour n'est sélectionné.`
                        : selectedStartDateLabel
                          ? "La réservation et la notification professeur utiliseront cette date comme première séance souhaitée."
                          : "Aucune réservation ne peut être finalisée sans date."}
                    </p>
                  </div>
                </div>
              </div>

              <div data-booking-schedule-section>
                <Label>Créneaux disponibles du professeur *</Label>
                <p className="mt-1 text-sm text-[#64748B]">
                  Sélectionnez un ou plusieurs créneaux exacts. Chaque séance dure 2 heures.
                  {selectedStartDayLabel ? ` Pour la date choisie, seuls les créneaux du ${selectedStartDayLabel.toLowerCase()} sont activés.` : " Choisissez d'abord la date souhaitée."}
                </p>
                <div className="mt-3 space-y-3">
                  {selectedAvailabilityDays.length === 0 && (
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
                      <p className="font-semibold text-[#111B4D]">Choisissez d'abord une date</p>
                      <p className="mt-1 text-sm leading-6 text-[#64748B]">
                        Les créneaux s'affichent ensuite uniquement pour le jour correspondant, afin de garder la réservation claire et rapide.
                      </p>
                    </div>
                  )}
                  {selectedAvailabilityDays.map((day) => {
                    const matchesSelectedDate = !selectedStartDayKey || day.key === selectedStartDayKey;
                    const availableSlots = TWO_HOUR_SLOTS.filter((slot) => matchesSelectedDate && !!teacherAvailability[day.key]?.[slot.key]);
                    const freeSlotsCount = availableSlots.filter((slot) => !findOccupiedConflictForSelection(
                      occupiedSlots,
                      form.startDate,
                      `${day.key}|${slot.key}`,
                      scheduleRequestContext,
                      pricingConfig.scheduleBuffers,
                      scheduleConflictContext,
                    )).length;
                    return (
                      <div key={day.key} className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[#111B4D]">{day.label}</p>
                          <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]">
                            {freeSlotsCount} libre{freeSlotsCount > 1 ? "s" : ""}
                          </span>
                        </div>
                        {availableSlots.length === 0 ? (
                          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#64748B]">
                            Aucun créneau disponible ce jour.
                          </p>
                        ) : (
                          <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                            {availableSlots.map((slot) => {
                              const key = `${day.key}|${slot.key}`;
                              const checked = form.selectedTimeSlots.includes(key);
                              const occupiedConflict = findOccupiedConflictForSelection(
                                occupiedSlots,
                                form.startDate,
                                key,
                                scheduleRequestContext,
                                pricingConfig.scheduleBuffers,
                                scheduleConflictContext,
                              );
                              const locked = Boolean(occupiedConflict);
                              const lockedLabel = occupiedConflict?.conflict.kind === "TRAVEL_BUFFER"
                                ? "Déplacement insuffisant"
                                : "Déjà payé";
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  aria-disabled={locked}
                                  onClick={() => {
                                    if (locked && occupiedConflict) {
                                      showScheduleConflictNotice({
                                        occurrence: {
                                          date: form.startDate,
                                          time: slot.label,
                                          sequence: 1,
                                          durationMinutes: 120,
                                        },
                                        occupied: occupiedConflict.occupied,
                                        conflict: occupiedConflict.conflict,
                                      });
                                      return;
                                    }
                                    update(
                                      "selectedTimeSlots",
                                      checked
                                        ? form.selectedTimeSlots.filter((item) => item !== key)
                                        : [...form.selectedTimeSlots, key],
                                    );
                                  }}
                                  className={`min-h-11 rounded-lg border px-2 py-2 text-center text-xs font-semibold transition ${
                                    checked
                                      ? "border-[#111B4D] bg-[#111B4D] text-white"
                                      : locked
                                        ? "cursor-not-allowed border-[#E5E7EB] bg-[#F8FAFC] text-[#94A3B8]"
                                      : "border-[#E3E8F2] bg-white text-[#111B4D] hover:border-[#DDE6F7] hover:bg-white"
                                  }`}
                                  title={locked ? lockedLabel : undefined}
                                >
                                  <span className="block">{slot.label}</span>
                                  {locked && <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-[#64748B]">{lockedLabel}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {form.selectedTimeSlots.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTimeLabels.map((label) => (
                      <span key={label} className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-[#111B4D]">
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {sessionPreview.length > 0 && (
                  <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <div className="flex flex-col gap-1 min-[720px]:flex-row min-[720px]:items-end min-[720px]:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">Plan prévisionnel des séances de {selectedSessionDurationLabel}</p>
                        <p className="text-xs leading-5 text-[#6B7280]">
                          Le service client confirmera les dates exactes avec {displayName}. Les créneaux répétés suivent la disponibilité du professeur.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[#111B4D]">{formatCount(selectedPackSessions, "séance")}, {totalHours}h</span>
                    </div>
                    <div className="mt-3 grid gap-2 min-[720px]:grid-cols-2 lg:grid-cols-3">
                      {sessionPreview.map((session) => (
                        <div key={session.label} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
                          <p className="font-semibold text-[#111827]">{session.label}</p>
                          <p className="mt-0.5 text-xs font-semibold text-[#111827]">{session.date}</p>
                          <p className="mt-0.5 text-xs font-medium text-[#6B7280]">{session.time}</p>
                          {session.repeated && <p className="mt-1 text-xs text-[#6B7280]">Répété selon disponibilité</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <details className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#111B4D] marker:hidden">
                  Un autre horaire ?
                </summary>
                <div className="mt-3 border-t border-[#E5E7EB] pt-4">
                  <p className="text-sm text-[#64748B]">
                    Indiquez une plage précise. La plateforme vérifie déjà les créneaux payés et le temps de déplacement avant paiement.
                  </p>
                  <div className="mt-3 grid gap-3 min-[720px]:grid-cols-[1fr_180px_180px]">
                  <div>
                    <Label htmlFor="customDay" className="text-xs font-semibold text-[#64748B]">Jour souhaité</Label>
                    <select
                      id="customDay"
                      value={form.customDay}
                      onChange={(event) => update("customDay", event.target.value)}
                      className={FIELD_CLASS_TALL}
                    >
                      <option value="">Aucun jour personnalisé</option>
                      {WEEK_DAYS.map((day) => (
                        <option key={day.key} value={day.key} disabled={Boolean(selectedStartDayKey && day.key !== selectedStartDayKey)}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="customStartTime" className="text-xs font-semibold text-[#64748B]">Heure souhaitée</Label>
                    <Input
                      id="customStartTime"
                      type="time"
                      min="08:00"
                      max={normalizedCustomDurationMinutes === 60 ? "21:00" : "20:00"}
                      step={1800}
                      value={form.customStartTime}
                      onChange={(event) => update("customStartTime", event.target.value)}
                      className="mt-1.5 h-11 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customDurationMinutes" className="text-xs font-semibold text-[#64748B]">Durée</Label>
                    <select
                      id="customDurationMinutes"
                      value={String(normalizedCustomDurationMinutes)}
                      onChange={(event) => update("customDurationMinutes", Number(event.target.value))}
                      className={FIELD_CLASS_TALL}
                    >
                      <option value="60">1h · prix identique</option>
                      <option value="120">2h standard</option>
                    </select>
                  </div>
                  <div className="min-[720px]:col-span-3">
                    <Label htmlFor="customTimeRequest" className="text-xs font-semibold text-[#64748B]">Précision optionnelle</Label>
                    <Textarea
                      id="customTimeRequest"
                      value={form.customTimeRequest}
                      onChange={(event) => update("customTimeRequest", event.target.value)}
                      placeholder="Ex : possible aussi après l'école, préférence samedi matin, éviter les jours d'examen..."
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                  </div>
                  {!customTimeValidation.valid && form.customStartTime && (
                    <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                      {customTimeValidation.reason}
                    </div>
                  )}
                  {usesCustomSchedule && firstScheduleConflict && (
                    <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                      <p>{firstScheduleConflict.conflict.kind === "TRAVEL_BUFFER" ? "Déplacement insuffisant sur cet autre horaire." : "Cet autre horaire chevauche un créneau payé."}</p>
                      <button type="button" onClick={() => showScheduleConflictNotice(firstScheduleConflict)} className="mt-2 text-xs font-black uppercase tracking-wide text-[#111B4D] underline">
                        Voir l'explication
                      </button>
                    </div>
                  )}
                  {form.customDay && customTimeRange && (
                    <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <div className="grid gap-3 min-[720px]:grid-cols-[1fr_auto] min-[640px]:items-center">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">Demande client prévisualisée</p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {dayLabel(form.customDay)} {customTimeRange}. Cette demande représente une séance de {selectedSessionDurationLabel}; le prix reste identique.
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-right">
                        <p className="text-xs font-semibold uppercase tracking-normal text-[#6B7280]">Prix moyen</p>
                        <p className="mt-0.5 whitespace-nowrap text-sm font-semibold text-[#111827]">{formatFCFA(averageSessionPrice)} / séance</p>
                      </div>
                    </div>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-[#64748B]">
                    Les créneaux standards restent des blocs de 2h. Dans “Autre horaire”, 1h ou 2h verrouillent l'agenda, mais ne changent pas le prix officiel affiché.
                  </p>
                </div>
              </details>

              <div
                className={`rounded-lg border p-4 ${
                  travelPlanningNotice.status === "blocked"
                    ? "border-red-200 bg-white"
                    : travelPlanningNotice.status === "clear"
                      ? "border-emerald-200 bg-white"
                      : "border-[#E5E7EB] bg-white"
                }`}
                data-booking-travel-buffer-explanation
              >
                <div className="flex flex-col gap-3 min-[720px]:flex-row min-[720px]:items-start min-[720px]:justify-between">
                  <div>
                    <p className={`text-sm font-black ${travelPlanningNotice.status === "blocked" ? "text-red-700" : "text-[#111B4D]"}`}>
                      {travelPlanningNotice.title}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
                      {travelPlanningNotice.description}
                    </p>
                  </div>
                  {travelPlanningNotice.status === "blocked" && firstScheduleConflict && (
                    <Button type="button" variant="outline" onClick={() => showScheduleConflictNotice(firstScheduleConflict)} className="min-h-10 shrink-0 rounded-lg">
                      Voir la restriction
                    </Button>
                  )}
                </div>
                {(travelPlanningNotice.requestedLabel || travelPlanningNotice.existingLabel) && (
                  <div className="mt-3 grid gap-2 text-xs font-bold text-[#111827] min-[720px]:grid-cols-2">
                    {travelPlanningNotice.requestedLabel && (
                      <div className="rounded-lg border border-[#EEF2F7] bg-[#F8FAFC] p-3">
                        <p className="uppercase tracking-wide text-[#64748B]">Votre cours demandé</p>
                        <p className="mt-1">{travelPlanningNotice.requestedLabel}</p>
                        <p className="mt-0.5 text-[#64748B]">{travelPlanningNotice.requestedLocation ?? formatTravelLocation(scheduleRequestContext)}</p>
                      </div>
                    )}
                    {travelPlanningNotice.existingLabel && (
                      <div className="rounded-lg border border-[#EEF2F7] bg-[#F8FAFC] p-3">
                        <p className="uppercase tracking-wide text-[#64748B]">Cours confirmé du professeur</p>
                        <p className="mt-1">{travelPlanningNotice.existingLabel}</p>
                        {travelPlanningNotice.existingLocation && <p className="mt-0.5 text-[#64748B]">{travelPlanningNotice.existingLocation}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Formule *</Label>
                <div className="mt-2 flex items-center justify-between gap-4 rounded-lg border border-[#111B4D] bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{selectedPackLabel}</p>
                    <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                      {formatCount(selectedPackSessions, "séance")} de {selectedSessionDurationLabel} · env. {formatFCFA(averageSessionPrice)} / séance
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-semibold text-[#111B4D]">{formatFCFA(pricing.totalClientPays)}</p>
                </div>
                <details className="mt-2 rounded-lg border border-[#E5E7EB] bg-white p-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[#111B4D] marker:hidden">
                    Comparer les formules
                  </summary>
                  <RadioGroup
                    value={form.packType}
                    onValueChange={(v) => update("packType", v as PackType)}
                    className="mt-4 grid gap-2 border-t border-[#E5E7EB] pt-4 min-[720px]:grid-cols-2"
                  >
                    {PACK_OPTIONS.map((p) => {
                      const optionPricing = calculateBookingPricing({
                        category: effectiveCourseCategory,
                        schoolSystem: form.schoolSystem,
                        levelName: form.levelName,
                        preciseLevel: form.preciseLevel,
                        subjectName: form.subjectName,
                        courseCatalogName: selectedCatalogCourse?.nom,
                        objective: form.objective,
                        deliveryMode,
                        requiresMaterial: false,
                        packType: p.value,
                        participantsCount,
                        teacherPricePerSession: teacher.pricePerSession,
                        paymentMethod: selectedJekoPaymentMethod,
                        teacherCommune: canResolveTransport ? teacher.commune : undefined,
                        teacherQuartier: canResolveTransport ? teacher.quartier : undefined,
                        teacherZoneNames: canResolveTransport ? teacher.zones : undefined,
                        clientCommune: canResolveTransport ? form.commune : undefined,
                        clientQuartier: canResolveTransport ? form.quartier : undefined,
                        platformCommissionPercent: pricingConfig.commissionPercent,
                        transportFeeAmounts: pricingConfig.transportFees,
                        grandAbidjanCommuneNames: grandAbidjanCommunes.map((commune) => commune.name),
                        clientCommuneTransportFeeOverride: selectedCommune?.transportFeeOverride,
                        neighborhoodAliases,
                      });
                      const count = optionPricing.numberOfSessions ?? 0;
                      const average = count > 0 ? Math.round(optionPricing.courseAmount / count) : 0;
                      return (
                        <label
                          key={p.value}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                            form.packType === p.value ? "border-[#111B4D] bg-white text-[#111B4D]" : "border-[#E3E8F2] bg-white hover:border-[#111B4D]"
                          }`}
                        >
                          <RadioGroupItem value={p.value} />
                          <span>
                            <span className="block font-medium text-[#111827]">{p.label}</span>
                            <span className="block text-xs text-[#64748B]">
                              {formatCount(count, "séance")} · {formatFCFA(optionPricing.totalClientPays)} · env. {formatFCFA(average)} / séance
                            </span>
                            {optionPricing.discountAmount > 0 && (
                              <span className="mt-0.5 block text-xs font-semibold text-[#111B4D]">
                                Économie {formatFCFA(optionPricing.discountAmount)} · {formatDiscountRate(optionPricing.discountRate)}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </details>
              </div>

              <details className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#111B4D] marker:hidden">
                  Ajouter un message (optionnel)
                </summary>
                <div className="mt-3 border-t border-[#E5E7EB] pt-4">
                  <Label htmlFor="message">Message pour le service client</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    placeholder="Précisez vos attentes, le chapitre à traiter, etc."
                    rows={3}
                    className="mt-1.5"
                  />
                </div>
              </details>
            </div>
          )}

          {/* Step 4 — Récapitulatif */}
          {step === 3 && (
            <div className="space-y-5">
              <StepIntro step="Étape 4" title="Récapitulatif" description="Relisez les informations qui seront enregistrées et transmises au service client." />

              {/* Carte prof */}
              <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4">
                <ProfessorImage photoUrl={teacher.photoUrl} name={displayName} size="md" shape="circle" verified={teacher.badgeVerified} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#111827]">{displayName}</p>
                  <p className="text-sm text-[#6B7280]">{teacher.jobTitle}</p>
                  <p className="text-xs text-[#6B7280]">
                    {teacherTrustSignal}
                  </p>
                </div>
              </div>

              {/* Récap */}
              <div className="grid gap-2 min-[720px]:grid-cols-2">
                <SummaryLine
                  icon={<ClipboardList className="h-4 w-4" />}
                  label="Besoin"
                  value={`${form.subjectName} · ${form.preciseLevel || form.levelName}`}
                />
                <SummaryLine
                  icon={form.courseFormat === "HOME" ? <Home className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  label="Format"
                  value={`${form.courseFormat === "HOME" ? "À domicile" : "En ligne"} · ${form.groupType === "INDIVIDUAL" ? "Individuel" : formatCount(participantsCount, "participant")}`}
                />
                <SummaryLine
                  icon={form.courseFormat === "HOME" ? <Home className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  label="Lieu"
                  value={form.courseFormat === "HOME"
                    ? `${formatLocationSummary(form.city, form.commune, form.quartier)} · ${pricing.transportFee === 0 ? "déplacement gratuit" : formatFCFA(pricing.transportFee)}`
                    : "En ligne"}
                />
                <SummaryLine
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Planning"
                  value={`${selectedStartDateLabel || "Date à choisir"} · ${preferredTimeSummary.join(" ; ") || "Créneau à choisir"}`}
                />
                <div className="min-[720px]:col-span-2">
                  <SummaryLine
                    icon={<WalletCards className="h-4 w-4" />}
                    label="Formule"
                    value={`${selectedPackLabel} · ${formatCount(selectedPackSessions, "séance")}`}
                  />
                </div>
              </div>

              <details className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#111B4D] marker:hidden">
                  Voir toutes les informations
                </summary>
                <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                  <dl className="divide-y divide-[#EEF2F7] text-sm">
                  <Row label="Type client" value={form.clientType} />
                  <Row label="Catégorie" value={categoryLabel} />
                  {form.schoolSystem && <Row label="Système scolaire" value={SCHOOL_SYSTEMS.find((system) => system.value === form.schoolSystem)?.label ?? form.schoolSystem} />}
                  {form.preciseLevel && <Row label="Classe / niveau précis" value={form.preciseLevel} />}
                  {selectedCatalogCourse && <Row label="Cours catalogue" value={selectedCatalogCourse.nom} />}
                  {schoolProgramPayload && <Row label="Résumé parcours" value={schoolProgramPayload} />}
                  <Row label="Matière" value={form.subjectName} />
                  {needsCustomSubjectDetail && <Row label="Besoin spécifique" value={form.customSubjectDetail || "—"} />}
                  <Row label="Niveau" value={form.levelName} />
                  <Row label="Objectif" value={form.objective} />
                  <Row label="Format" value={form.courseFormat === "HOME" ? "À domicile" : "En ligne"} />
                  <Row label="Type" value={form.groupType === "INDIVIDUAL" ? "Individuel" : "Petit groupe"} />
                  <Row label="Participants" value={`${participantsCount} ${participantsCount > 1 ? "participants" : "participant"}`} />
                  <Row label="Tarif appliqué" value={pricing.priceTierLabel} />
                  {form.courseFormat === "HOME" ? (
                    <>
                      <Row label="Commune" value={form.commune || "—"} />
                      <Row label="Quartier" value={form.quartier || "—"} />
                      {form.addressHint && <Row label="Adresse" value={form.addressHint} />}
                      <Row label="Trajet" value={pricing.transportRouteLabel ?? "À confirmer"} />
                      <Row label="Déplacement" value={formatFCFA(pricing.transportFee)} />
                    </>
                  ) : (
                    form.onlineLink && <Row label="Lien" value={form.onlineLink} />
                  )}
                  {(effectiveCourseCategory === "apprentissage_metier" || effectiveCourseCategory === "formation_professionnelle") && (
                    <Row label="Matériel" value="Obligatoire côté apprenant, non fourni ni facturé par Compétence" />
                  )}
                  <Row label="Date souhaitée" value={selectedStartDateLabel || "—"} />
                  <Row label="Validation planning" value={isScheduleReadyForPayment ? "Date et créneau prêts pour paiement" : paymentScheduleWarning || "Planning à compléter"} />
                  <Row label="Créneaux / préférence" value={preferredTimeSummary.join(" ; ") || "—"} />
                    <Row label="Formule" value={selectedPackLabel} />
                  </dl>
                </div>
              </details>

              {/* Montants */}
              <div className="space-y-3">
                <BookingPricingBreakdown
                  unitPrice={pricing.unitSessionAmount}
                  totalPrice={totalPrice}
                  sessionsCount={selectedPackSessions}
                  participantsCount={participantsCount}
                  groupType={form.groupType}
                  packType={form.packType}
                  priceTierKey={pricing.priceTierKey}
                  priceTierLabel={pricing.priceTierLabel}
                  paymentProviderLabel="Jèko"
                  courseAmount={pricing.courseAmount}
                  transportFee={pricing.transportFee}
                  transportFeeLabel={pricing.transportFeeLabel}
                  transportFeePending={pricing.transportFeePending}
                  transportRouteLabel={pricing.transportRouteLabel}
                  transportRuleLabel={pricing.transportRuleLabel}
                  materialFee={pricing.materialFee}
                  discountAmount={pricing.discountAmount}
                  appliedDiscountKind={pricing.appliedDiscountKind}
                  partnerDiscountAmount={pricing.partnerDiscountAmount}
                  rewardDiscountAmount={pricing.rewardDiscountAmount}
                  paymentServiceFeeAmount={pricing.paymentServiceFeeAmount}
                  paymentServiceFeeLabel={pricing.paymentServiceFeeLabel}
                  totalBeforePaymentServiceFee={pricing.totalBeforePaymentServiceFee}
                  paymentProviderFeeAmount={pricing.paymentProviderFeeAmount}
                  paymentProviderFeeLabel={pricing.paymentProviderFeeLabel}
                  totalBeforePaymentProviderFee={pricing.totalBeforePaymentProviderFee}
                />
                {sessionPreview.length > 1 && (
                  <details className="rounded-lg border border-[#DDE6F7] bg-white p-3">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[#111B4D] marker:hidden">
                      Voir le planning des {sessionPreview.length} séances
                    </summary>
                    <div className="mt-3 border-t border-[#E5E7EB] pt-3">
                    <div className="flex flex-col gap-1 min-[460px]:flex-row min-[460px]:items-end min-[460px]:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Séances prévues</p>
                        <p className="mt-0.5 text-xs font-medium leading-5 text-[#64748B]">
                          Une séance dure {selectedSessionDurationLabel}. La première date est celle choisie par le client.
                        </p>
                      </div>
                      <span className="w-fit rounded-lg border border-[#DDE6F7] bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]">
                        {sessionPreview.length} séance{sessionPreview.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 min-[720px]:grid-cols-2">
                      {sessionPreview.map((session) => (
                        <div key={session.label} className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 text-xs text-[#111827]">
                          <p className="font-semibold text-[#111827]">{session.label}</p>
                          <p className="mt-0.5 font-medium leading-5 text-[#111827]">{session.date}</p>
                          <p className="mt-0.5 font-semibold text-[#64748B]">{session.time}</p>
                        </div>
                      ))}
                    </div>
                    </div>
                  </details>
                )}
                <div className="flex items-start gap-2 rounded-lg border border-[#DDE6F7] bg-white p-3 text-xs font-medium leading-5 text-[#64748B]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                  <span>
                    Le paiement sera finalisé sur Jèko, confirmé côté serveur, puis gardé sécurisé jusqu'à votre confirmation après le cours.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 5 — Paiement */}
          {step === 4 && (
            <div className="space-y-5">
              <StepIntro
                step="Étape 5"
                title="Payer avec Jèko"
                description="Choisissez votre moyen de paiement. La réservation sera activée uniquement après confirmation serveur."
              />

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Votre séance</p>
                    <p className="mt-1 text-base font-semibold text-[#111827]">{form.subjectName} · {form.levelName}</p>
                    <p className="mt-0.5 text-sm font-medium text-[#64748B]">Avec {displayName}</p>
                  </div>

                  <div className="mt-4 grid gap-2 min-[720px]:grid-cols-2">
                    <SummaryLine icon={<CalendarDays className="h-4 w-4" />} label="Date de première séance" value={selectedStartDateLabel || "Date obligatoire"} />
                    <SummaryLine icon={<Clock3 className="h-4 w-4" />} label="Créneau demandé" value={preferredTimeSummary.join(" ; ") || "Créneau obligatoire"} />
                    <SummaryLine icon={form.courseFormat === "HOME" ? <Home className="h-4 w-4" /> : <Video className="h-4 w-4" />} label="Format" value={form.courseFormat === "HOME" ? "À domicile" : "En ligne"} />
                    <SummaryLine icon={<Users className="h-4 w-4" />} label="Formule" value={PACK_OPTIONS.find((p) => p.value === form.packType)?.label ?? form.packType} />
                  </div>

                  {schoolProgramPayload && (
                    <p className="mt-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#6B7280]">
                      {schoolProgramPayload}
                    </p>
                  )}

                  {!isScheduleReadyForPayment && (
                    <div className="mt-4 rounded-lg border border-[#111B4D] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#111B4D]">
                      {paymentScheduleWarning}
                    </div>
                  )}
                </div>

                <BookingPricingBreakdown
                  presentation="checkout"
                  unitPrice={pricing.unitSessionAmount}
                  totalPrice={totalPrice}
                  sessionsCount={selectedPackSessions}
                  participantsCount={participantsCount}
                  groupType={form.groupType}
                  packType={form.packType}
                  priceTierKey={pricing.priceTierKey}
                  priceTierLabel={pricing.priceTierLabel}
                  paymentProviderLabel="Jèko"
                  courseAmount={pricing.courseAmount}
                  transportFee={pricing.transportFee}
                  transportFeeLabel={pricing.transportFeeLabel}
                  transportFeePending={pricing.transportFeePending}
                  transportRouteLabel={pricing.transportRouteLabel}
                  transportRuleLabel={pricing.transportRuleLabel}
                  materialFee={pricing.materialFee}
                  discountAmount={pricing.discountAmount}
                  appliedDiscountKind={pricing.appliedDiscountKind}
                  partnerDiscountAmount={pricing.partnerDiscountAmount}
                  rewardDiscountAmount={pricing.rewardDiscountAmount}
                  paymentServiceFeeAmount={pricing.paymentServiceFeeAmount}
                  paymentServiceFeeLabel={pricing.paymentServiceFeeLabel}
                  totalBeforePaymentServiceFee={pricing.totalBeforePaymentServiceFee}
                  paymentProviderFeeAmount={pricing.paymentProviderFeeAmount}
                  paymentProviderFeeLabel={pricing.paymentProviderFeeLabel}
                  totalBeforePaymentProviderFee={pricing.totalBeforePaymentProviderFee}
                />
              </div>

              <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold text-[#111827]">Quelqu’un vous a recommandé Compétence.CI ?</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                    Saisissez son code, ou son nom et son numéro. Votre premier cours bénéficie de 10 % et le partenaire reçoit 10 % sur vos paiements éligibles pendant six mois.
                  </p>
                  {partnerVerificationState === "verified" && form.partnerReferralCode && (
                    <p className="mt-3 inline-flex min-h-8 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-900">
                      Partenaire vérifié · {form.partnerReferralCode}
                    </p>
                  )}
                </div>
                <div className="mt-4 grid gap-3 min-[720px]:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="partnerReferralCode">Code partenaire</Label>
                    <Input
                      id="partnerReferralCode"
                      value={form.partnerReferralCode}
                      onChange={(event) => updatePartnerField("partnerReferralCode", event.target.value.toUpperCase())}
                      placeholder="CP-XXXXXXXX"
                      maxLength={24}
                      autoComplete="off"
                      readOnly={partnerVerificationState === "verified"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partnerReferralName">Nom de l’apporteur d’affaires</Label>
                    <Input
                      id="partnerReferralName"
                      value={form.partnerReferralName}
                      onChange={(event) => updatePartnerField("partnerReferralName", event.target.value)}
                      placeholder="Ex : Kouamé Jean"
                      maxLength={120}
                      autoComplete="off"
                      readOnly={partnerVerificationState === "verified"}
                      className={partnerVerificationState === "verified" ? "bg-[#F8FAFC]" : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partnerReferralPhone">Téléphone de l’apporteur</Label>
                    <Input
                      id="partnerReferralPhone"
                      value={form.partnerReferralPhone}
                      onChange={(event) => updatePartnerField("partnerReferralPhone", event.target.value)}
                      placeholder="+225 XX XX XX XX XX"
                      maxLength={32}
                      inputMode="tel"
                      autoComplete="off"
                      readOnly={partnerVerificationState === "verified"}
                      className={partnerVerificationState === "verified" ? "bg-[#F8FAFC]" : undefined}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold leading-5 text-[#475569]">
                    La réduction porte uniquement sur le cours. Transport, frais de service et frais Jèko restent séparés. Le montant professeur ne change jamais.
                  </p>
                  {partnerVerificationState !== "verified" && (
                    <Button type="button" variant="outline" onClick={verifyPartner} disabled={partnerVerificationState === "checking"} className="min-h-11 shrink-0 rounded-lg">
                      {partnerVerificationState === "checking" ? "Vérification…" : "Vérifier et appliquer"}
                    </Button>
                  )}
                </div>
                {pricing.partnerDiscountAmount > 0 && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
                    Réduction partenaire appliquée : -{formatFCFA(pricing.partnerDiscountAmount)}
                  </div>
                )}
                {pricing.rewardDiscountAmount > 0 && promotionBenefits?.reward && (
                  <div className="mt-3 rounded-lg border border-[#E8D7A0] bg-[#FFF9E8] px-4 py-3 text-sm font-bold text-[#6B4F00]">
                    Cadeau du {promotionBenefits.reward.milestone}ᵉ paiement appliqué automatiquement : -{formatFCFA(pricing.rewardDiscountAmount)}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-[#E3E8F2] bg-white">
                  <div className="border-b border-[#E5E7EB] bg-white p-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Paiement externalisé</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <JekoMark />
                        <span className="inline-flex min-h-8 items-center rounded-lg border border-[#CAD7F2] bg-white px-3 text-xs font-semibold text-[#111B4D]">
                          Confirmation sécurisée
                        </span>
                      </div>
                      <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#64748B]">
                        Jèko collecte les informations de paiement et confirme le résultat directement au serveur Compétence.CI. Aucun code secret Mobile Money n'est enregistré ici.
                      </p>
                      <JekoHostedCheckoutPreview
                        amount={totalPrice}
                        method={selectedPaymentMethod}
                        merchantName="Boutique Compétence"
                        className="mt-4 max-w-md"
                      />
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-sm font-semibold text-[#111827]">Choisissez votre moyen de paiement Jèko</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Moyen de paiement Jèko">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setSelectedPaymentMethod(m.value)}
                          aria-pressed={selectedPaymentMethod === m.value}
                          className={selectedPaymentMethod === m.value
                            ? "flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border-2 border-[#111B4D] bg-[#EEF2FF] p-2.5 text-center ring-2 ring-[#C7D2FE]"
                            : "flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-[#E3E8F2] bg-white p-2.5 text-center transition hover:border-[#818CF8]"}
                        >
                          <PaymentMethodLogo method={m.value} className="h-10 w-full min-w-0" />
                          <span className="text-xs font-semibold text-[#111827]">{m.label}</span>
                          {selectedPaymentMethod === m.value && <span className="text-[10px] font-bold uppercase text-[#3730A3]">Sélectionné</span>}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 flex gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#111B4D]">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      Le bouton final ouvre la page sécurisée Jèko, puis l'application officielle du moyen choisi pour autoriser le paiement. La réservation ne sera marquée payée qu'après confirmation signée et contrôle serveur.
                    </p>
                    {paymentLaunchMessage && (
                      <p className="mt-3 rounded-lg border border-[#DDE6F7] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold leading-5 text-[#111B4D]" data-booking-payment-inline-state>
                        {paymentLaunchMessage}
                      </p>
                    )}
                  </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 hidden flex-col-reverse gap-3 border-t border-[#E3E8F2] pt-4 min-[720px]:flex min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={back} disabled={submitting} className="min-h-11 w-full rounded-lg min-[640px]:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            ) : (
              <span className="hidden min-[720px]:block" />
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} className="min-h-11 w-full rounded-lg min-[640px]:w-auto">
                Continuer
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => void submit()} disabled={submitting} className="min-h-11 w-full min-w-44 rounded-lg min-[640px]:w-auto">
                {submitting ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-[#9AAAD0]" /> Traitement...</>
                ) : (
                  <><ExternalLink className="mr-2 h-4 w-4" /> Continuer vers Jèko</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
        </Card>

        <aside className="client-booking-side-summary hidden xl:block xl:self-start">
          <div className="rounded-lg border border-[#DDE6F7] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Dossier en cours</p>
            <h2 className="mt-1 text-base font-semibold text-[#111827]">Votre réservation</h2>
            <div className="mt-3 divide-y divide-[#E6EAF3] border-y border-[#E6EAF3]">
              <SummaryLine flat icon={<ClipboardList className="h-4 w-4" />} label="Besoin" value={primarySubjectLabel} />
              <SummaryLine flat icon={<CalendarDays className="h-4 w-4" />} label="Date" value={selectedStartDateLabel || "À choisir"} />
              <SummaryLine flat icon={<Clock3 className="h-4 w-4" />} label="Créneau" value={preferredTimeSummary.join(" ; ") || "À choisir"} />
              <SummaryLine flat icon={<Users className="h-4 w-4" />} label="Participants" value={`${participantsCount}`} />
            </div>
            <p className="mt-3 flex gap-2 text-xs font-medium leading-5 text-[#64748B]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
              Professeur, planning et montant restent liés au même dossier.
            </p>
          </div>
        </aside>
      </div>

      <div
        className="client-booking-mobile-action fixed inset-x-2 z-40 rounded-lg border border-[#DDE6F7] bg-white p-2.5 min-[390px]:inset-x-3 min-[720px]:hidden"
        style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-2 px-1">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-semibold text-[#111827]">
              Étape {step + 1}/{STEPS.length} · {currentStepDetail.title}
            </span>
            <span className="shrink-0 text-xs font-semibold text-[#111B4D]">
              {hasResolvedPricing ? formatFCFA(totalPrice) : "À calculer"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={back} disabled={submitting} className="h-11 w-11 shrink-0 rounded-lg p-0" aria-label="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            onClick={handlePrimaryAction}
            disabled={primaryActionDisabled}
            className="min-h-11 flex-1 rounded-lg bg-[#111B4D] px-3 text-white hover:bg-[#1E2A78]"
          >
            <span className="truncate">{submitting ? "Traitement..." : primaryActionLabel}</span>
            {!submitting && !isFinalStep && <ArrowRight className="ml-2 h-4 w-4" />}
            {!submitting && isFinalStep && <ExternalLink className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>

      {restrictionNotice && (
        <RestrictionNoticeDialog
          open={Boolean(restrictionNotice)}
          onOpenChange={(open) => {
            if (!open) setRestrictionNotice(null);
          }}
          title={restrictionNotice.title}
          description={restrictionNotice.description}
          variant={restrictionNotice.variant}
          primaryLabel={restrictionNotice.primaryLabel}
          onPrimary={restrictionNotice.onPrimary}
          secondaryLabel={restrictionNotice.secondaryLabel}
          onSecondary={restrictionNotice.onSecondary}
        />
      )}

      <AlertDialog
        open={Boolean(priceChangeNotice)}
        onOpenChange={(open) => {
          if (!open && !submitting) setPriceChangeNotice(null);
        }}
      >
        <AlertDialogContent className="max-w-xl border-[#F5C451] p-0">
          <AlertDialogHeader className="border-b border-[#F3E3B1] bg-[#FFF9E8] p-5 text-left">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5C451] text-[#4A3300]">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <AlertDialogTitle className="text-[#2F2300]">Le tarif a été recalculé</AlertDialogTitle>
                <AlertDialogDescription className="mt-1 leading-5 text-[#6C550D]">
                  Une donnée tarifaire a changé depuis l'affichage initial. Aucun paiement n'a été lancé : contrôlez le nouveau montant avant de continuer vers Jèko.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {priceChangeNotice && (
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#E3E8F2] bg-[#F8FAFC] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Montant affiché avant</p>
                  <p className="mt-1 text-2xl font-semibold text-[#64748B] line-through decoration-[#B42318]">
                    {formatFCFA(priceChangeNotice.previous.totalClientPays)}
                  </p>
                </div>
                <div className="rounded-lg border-2 border-[#111B4D] bg-[#EEF2FF] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#111B4D]">Nouveau total Jèko</p>
                  <p className="mt-1 text-2xl font-bold text-[#111B4D]">
                    {formatFCFA(priceChangeNotice.current.totalClientPays)}
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-[#E6EAF3] rounded-lg border border-[#E3E8F2] px-4 text-sm">
                <PriceConfirmationRow label={`Cours · ${priceChangeNotice.current.priceTierLabel}`} value={priceChangeNotice.current.courseAmount} />
                <PriceConfirmationRow label={priceChangeNotice.current.transportRouteLabel || "Déplacement"} value={priceChangeNotice.current.transportFee} />
                <PriceConfirmationRow label="Frais de service Compétence" value={priceChangeNotice.current.paymentServiceFeeAmount} />
                <PriceConfirmationRow label={priceChangeNotice.current.paymentProviderFeeLabel || "Frais de paiement Jèko"} value={priceChangeNotice.current.paymentProviderFeeAmount} />
                <PriceConfirmationRow label="Total confirmé" value={priceChangeNotice.current.totalClientPays} strong />
              </dl>
            </div>
          )}

          <AlertDialogFooter className="border-t border-[#E6EAF3] p-5">
            <AlertDialogCancel disabled={submitting}>Revenir et modifier</AlertDialogCancel>
            <AlertDialogAction
              disabled={!priceChangeNotice || submitting}
              onClick={() => {
                if (!priceChangeNotice) return;
                const fingerprint = priceChangeNotice.fingerprint;
                setPriceChangeNotice(null);
                void submit(fingerprint);
              }}
              className="bg-[#111B4D] text-white hover:bg-[#1E2A78]"
            >
              Confirmer {priceChangeNotice ? formatFCFA(priceChangeNotice.current.totalClientPays) : "le tarif"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PriceConfirmationRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className={strong ? "font-bold text-[#111827]" : "font-medium text-[#64748B]"}>{label}</dt>
      <dd className={strong ? "shrink-0 font-bold text-[#111B4D]" : "shrink-0 font-semibold text-[#111827]"}>{formatFCFA(value)}</dd>
    </div>
  );
}

function formatDiscountRate(rate: number) {
  return `${Number((Math.max(0, rate) * 100).toFixed(1)).toLocaleString("fr-FR")} %`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 min-[720px]:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="min-w-0 text-[#6B7280]">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-[#111827] min-[720px]:text-right">{value}</dd>
    </div>
  );
}

function StepIntro({ step, title, description }: { step: string; title: string; description: ReactNode }) {
  return (
    <div className="px-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{step}</p>
      <h2 className="mt-1 text-lg font-semibold tracking-normal text-[#111827] sm:text-xl">{title}</h2>
      <p className="mt-1 hidden text-sm font-medium leading-5 text-[#64748B] sm:block sm:leading-6">{description}</p>
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
      <p className="text-xs font-medium leading-snug text-[#6B7280]">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold leading-snug text-[#111827]">{value}</p>
    </div>
  );
}

function SummaryLine({ icon, label, value, flat = false }: { icon: ReactNode; label: string; value: ReactNode; flat?: boolean }) {
  return (
    <div className={flat
      ? "flex min-w-0 items-start gap-2 bg-white py-3"
      : "flex min-w-0 items-start gap-2 rounded-lg border border-[#E6EAF3] bg-white px-3 py-2"}
    >
      <span className="mt-0.5 shrink-0 text-[#111B4D]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold leading-snug text-[#111827]">{value}</p>
      </div>
    </div>
  );
}

function JekoMark() {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3" aria-label="Jèko Checkout">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111B4D] text-[11px] font-semibold text-white">
        JÈ
      </span>
      <span className="text-sm font-semibold tracking-normal text-[#111827]">
        Jèko
        <span className="ml-1 font-semibold text-[#64748B]">Checkout</span>
      </span>
    </span>
  );
}

function formatSentencePart(value: string) {
  return value.trim().replace(/[.!?]+$/, "");
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
