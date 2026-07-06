"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { BackButton } from "@/components/shared/back-button";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ProfessorTrustBadges } from "@/components/shared/professor-trust-badges";
import { BookingPricingBreakdown } from "@/components/shared/booking-pricing-breakdown";
import { ImportantActionNotice } from "@/components/shared/important-action-confirm";
import { PaymentMethodLogo } from "@/components/shared/payment-method-logo";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import { formatFCFA } from "@/lib/format";
import { activePaymentMethodOptions } from "@/lib/payment-methods";
import { PackType } from "@prisma/client";
import {
  CLIENT_TYPES,
  COURSE_CATALOG,
  COURSE_CATEGORIES,
  SCHOOL_SYSTEMS,
  buildSchoolProgramSummary,
  getPreciseLevelOptions,
  isLyceeLevel,
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
  calculateBookingPricing,
  packSessionCount,
} from "@/lib/pricing";
import {
  ArrowLeft, ArrowRight, Lock, Home, Video, User, Users,
  ShieldCheck, CalendarDays, CheckCircle2, Clock3, ClipboardList, WalletCards, ExternalLink,
} from "lucide-react";

type Teacher = {
  id: string;
  fullName: string;
  professionalName: string | null;
  photoUrl: string | null;
  jobTitle: string;
  commune: string | null;
  rating: number;
  ratingCount: number;
  pricePerSession: number;
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
    description: "Sélectionnez une date, un créneau de 2h ou une demande horaire précise.",
  },
  {
    title: "Récapitulatif",
    description: "Vérifiez le professeur, le planning, la formule et le montant client.",
  },
  {
    title: "Paiement",
    description: "Contrôlez le dossier puis finalisez le paiement sur PayDunya.",
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
const PAYMENT_METHODS = activePaymentMethodOptions;

const CLIENT_TYPE_DEFAULT_CATEGORY: Record<string, string> = {
  Parent: "soutien_scolaire",
  Élève: "soutien_scolaire",
  Étudiant: "enseignement_superieur",
  Professionnel: "formation_professionnelle",
  Entreprise: "formation_entreprise",
};

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

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase();
}

function isCatalogCourseCoveredByTeacher(
  item: (typeof COURSE_CATALOG)[number],
  teacherSubjects: string[],
  selectedSubject: string,
) {
  const subject = normalizeForMatch(item.matiere_ou_competence);
  const name = normalizeForMatch(item.nom);
  const selected = normalizeForMatch(selectedSubject);
  const allowedSubjects = teacherSubjects.map(normalizeForMatch).filter(Boolean);

  if (selected && (subject.includes(selected) || selected.includes(subject) || name.includes(selected))) {
    return true;
  }

  return allowedSubjects.some((allowed) => (
    subject.includes(allowed)
    || allowed.includes(subject)
    || name.includes(allowed)
  ));
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

function formatTimeRange(startTime: string) {
  const [hourValue, minuteValue = "0"] = startTime.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return startTime;

  const start = new Date(2026, 0, 1, hour, minute, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}h${minutes}`;
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

function dayKeyFromDateInput(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return DATE_DAY_KEYS[new Date(year, month - 1, day).getDay()];
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

type ReservationFormNoticeInput = {
  step: number;
  displayName: string;
  courseFormat: string;
  groupType: string;
  participantsCount: number;
  selectedStartDateLabel: string;
  preferredTimeSummary: string[];
  isScheduleReadyForPayment: boolean;
  paymentScheduleWarning: string;
  isQuoteOnly: boolean;
  totalPrice: number;
};

function getReservationFormNotice({
  step,
  displayName,
  courseFormat,
  groupType,
  participantsCount,
  selectedStartDateLabel,
  preferredTimeSummary,
  isScheduleReadyForPayment,
  paymentScheduleWarning,
  isQuoteOnly,
  totalPrice,
}: ReservationFormNoticeInput) {
  if (step === 0) {
    return {
      title: "À terminer : besoin du cours",
      description: `Cette réservation sera rattachée à ${displayName}. Choisissez uniquement une matière et un niveau que ce professeur peut assurer, puis ajoutez les précisions utiles pour le service client.`,
    };
  }

  if (step === 1) {
    return {
      title: "À vérifier : format et participants",
      description: `Choisissez ${courseFormat === "HOME" ? "le cours à domicile" : "le cours en ligne"}, puis indiquez si la séance est individuelle ou en petit groupe. Chaque participant supplémentaire ajoute 50% du prix de base; le matériel éventuel reste à la charge de l'apprenant.`,
    };
  }

  if (step === 2) {
    return {
      title: "Obligatoire : date et créneau",
      description: isScheduleReadyForPayment
        ? `Première séance : ${selectedStartDateLabel}. Créneau transmis : ${preferredTimeSummary.join(" ; ")}. Les séances durent 2h et seront visibles côté service client pour ce professeur.`
        : paymentScheduleWarning || `Sélectionnez une date d'aujourd'hui ou ultérieure, puis un créneau de 2h. La réservation doit être faite au moins ${MIN_BOOKING_NOTICE_HOURS}h avant le cours.`,
    };
  }

  if (step === 3) {
    return {
      title: "À contrôler avant paiement",
      description: `Relisez le professeur, la matière, le niveau, la date, le créneau, le format ${courseFormat === "HOME" ? "à domicile" : "en ligne"} et le montant. ${groupType === "SMALL_GROUP" ? `${participantsCount} participants sont comptés dans le calcul.` : "La séance est comptée en individuel."}`,
    };
  }

  return {
    title: isQuoteOnly ? "Action finale : envoyer le dossier" : "Action finale : paiement PayDunya",
    description: isQuoteOnly
      ? "Aucun paiement n'est demandé maintenant. Le service client reçoit le dossier, vérifie le montant, puis vous confirme la suite."
      : `Le client paie uniquement le montant total affiché : ${formatFCFA(totalPrice)}. Le moyen de paiement et le numéro sont saisis sur PayDunya, puis la confirmation serveur PayDunya active la réservation.`,
  };
}

export function ReserverForm({
  teacher, subjects, levels, communes,
}: {
  teacher: Teacher;
  subjects: { id: string; name: string; slug: string }[];
  levels: { id: string; name: string; slug: string }[];
  communes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const displayName = teacher.professionalName || teacher.fullName;
  const teacherAvailability = parseAvailability(teacher.availability);
  const todayIso = useMemo(() => toDateInputValue(new Date()), []);

  // Form state
  const [form, setForm] = useState({
    clientType: "Parent",
    courseCategory: "soutien_scolaire",
    schoolSystem: "",
    preciseLevel: "",
    courseCatalogId: "",
    levelName: teacher.levels[0] ?? "",
    subjectName: teacher.subjects[0]?.name ?? "",
    customSubjectDetail: "",
    objective: OBJECTIVES[0].value,
    schoolProgram: "",
    needDescription: "",
    courseFormat: teacher.offersHome ? "HOME" : (teacher.offersOnline ? "ONLINE" : "HOME"),
    groupType: "INDIVIDUAL",
    participantsCount: 1,
    commune: "",
    quartier: "",
    addressHint: "",
    onlineLink: "",
    selectedTimeSlots: [] as string[],
    customDay: "",
    customStartTime: "",
    customTimeRequest: "",
    startDate: "",
    packType: "SINGLE" as PackType,
    message: "",
  });

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function handleStartDateChange(value: string) {
    const dayKey = dayKeyFromDateInput(value);
    setForm((current) => ({
      ...current,
      startDate: value,
      selectedTimeSlots: dayKey
        ? current.selectedTimeSlots.filter((slot) => slot.startsWith(`${dayKey}|`))
        : current.selectedTimeSlots,
      customDay: current.customDay && dayKey && current.customDay !== dayKey ? "" : current.customDay,
      customStartTime: current.customDay && dayKey && current.customDay !== dayKey ? "" : current.customStartTime,
    }));
  }

  const categoryCopy = getCategoryCopy(form.courseCategory);
  const categoryLabel = COURSE_CATEGORIES.find((category) => category.code === form.courseCategory)?.label ?? form.courseCategory;
  const schoolContext = isSchoolContext(form.courseCategory);
  const hasTeacherLevels = teacher.levels.length > 0;
  const hasTeacherSubjects = teacher.subjects.length > 0;
  const needsCustomSubjectDetail = /autre|sp[ée]cifique|besoin/i.test(form.subjectName);
  const isLyceeSelection = schoolContext && isLyceeLevel(form.levelName);
  const preciseLevelOptions = isLyceeSelection ? getPreciseLevelOptions(form.schoolSystem) : [];
  const teacherSubjectNames = useMemo(() => teacher.subjects.map((subject) => subject.name), [teacher.subjects]);
  const selectedCategoryCourses = useMemo(() => (
    COURSE_CATALOG.filter((item) => (
      item.categorie === form.courseCategory
      && (!form.schoolSystem || !item.systeme_scolaire || item.systeme_scolaire === form.schoolSystem)
      && (!form.preciseLevel || !item.niveau || item.niveau === form.preciseLevel)
      && isCatalogCourseCoveredByTeacher(item, teacherSubjectNames, form.subjectName)
    )).sort((a, b) => (
      a.sous_categorie.localeCompare(b.sous_categorie, "fr")
      || a.nom.localeCompare(b.nom, "fr")
    ))
  ), [form.courseCategory, form.preciseLevel, form.schoolSystem, form.subjectName, teacherSubjectNames]);
  const selectedCategoryCourseIds = useMemo(() => new Set(selectedCategoryCourses.map((item) => item.id)), [selectedCategoryCourses]);
  const selectedCategoryCourseGroups = useMemo(() => {
    const groups = new Map<string, typeof selectedCategoryCourses>();
    for (const item of selectedCategoryCourses) {
      const existing = groups.get(item.sous_categorie);
      if (existing) existing.push(item);
      else groups.set(item.sous_categorie, [item]);
    }
    return Array.from(groups.entries()).map(([subcategory, items]) => ({
      label: formatCatalogSubcategory(subcategory),
      options: items.map((item) => ({
        value: item.id,
        label: item.niveau ? `${item.matiere_ou_competence} - ${item.niveau}` : item.nom,
        keywords: `${item.matiere_ou_competence} ${item.niveau ?? ""} ${item.public_cible} ${item.objectif}`,
      })),
    }));
  }, [selectedCategoryCourses]);
  const levelSelectionGroups = useMemo(() => [{
    label: hasTeacherLevels ? `Niveaux de ${displayName}` : "Niveaux à configurer",
    options: levels.map((level) => ({
      value: level.name,
      label: level.name,
      keywords: level.slug,
    })),
  }], [displayName, hasTeacherLevels, levels]);
  const subjectSelectionGroups = useMemo(() => [{
    label: hasTeacherSubjects ? `Matières de ${displayName}` : "Matières à configurer",
    options: subjects.map((subject) => ({
      value: subject.name,
      label: subject.name,
      keywords: subject.slug,
    })),
  }], [displayName, hasTeacherSubjects, subjects]);
  const communeSelectionGroups = useMemo(() => [{
    label: "Communes du Grand Abidjan",
    options: communes.map((commune) => ({
      value: commune.name,
      label: commune.name,
      keywords: commune.name,
    })),
  }], [communes]);
  const safeCourseCatalogId = selectedCategoryCourseIds.has(form.courseCatalogId) ? form.courseCatalogId : "";
  const selectedCatalogCourse = COURSE_CATALOG.find((item) => item.id === safeCourseCatalogId);
  const schoolProgramPayload = buildSchoolProgramSummary({
    clientType: form.clientType,
    category: form.courseCategory,
    schoolSystem: form.schoolSystem,
    preciseLevel: form.preciseLevel,
    courseCatalogId: safeCourseCatalogId,
    freeProgram: form.schoolProgram,
  });
  const participantsCount = form.groupType === "SMALL_GROUP" ? clampGroupParticipants(form.participantsCount) : 1;
  const deliveryMode = form.courseFormat === "ONLINE" ? "en_ligne" : "domicile";
  const canResolveTransport = form.courseFormat === "HOME" && Boolean(form.commune.trim());
  const pricing = calculateBookingPricing({
    category: form.courseCategory,
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
    teacherCommune: canResolveTransport ? teacher.commune : undefined,
    teacherZoneNames: canResolveTransport ? teacher.zones : undefined,
    clientCommune: canResolveTransport ? form.commune : undefined,
  });
  const selectedPackSessions = pricing.numberOfSessions ?? packSessionCount(form.packType);
  const basePrice = selectedPackSessions > 0 ? pricing.unitSessionAmount * selectedPackSessions : 0;
  const courseFormulaAmount = pricing.courseAmount;
  const totalPrice = pricing.totalClientPays;
  const averageSessionPrice = selectedPackSessions > 0 ? Math.round(pricing.courseAmount / selectedPackSessions) : 0;
  const totalHours = selectedPackSessions * 2;
  const extraParticipantCount = Math.max(0, participantsCount - 1);
  const surchargePerExtraParticipant = Math.round(basePrice * 0.5);
  const selectedDays = Array.from(new Set([
    ...form.selectedTimeSlots.map((slot) => slot.split("|")[0]),
    ...(form.customDay ? [form.customDay] : []),
  ]));
  const selectedTimeLabels = form.selectedTimeSlots.map(availabilitySelectionLabel);
  const customTimeRange = form.customStartTime ? formatTimeRange(form.customStartTime) : "";
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
  const mobileAvailabilityDays = selectedStartDayKey
    ? WEEK_DAYS.filter((day) => day.key === selectedStartDayKey)
    : [];
  const progressPercent = Math.round(((step + 1) / STEPS.length) * 100);
  const currentStepDetail = STEP_DETAILS[step] ?? STEP_DETAILS[0];
  const primarySubjectLabel = form.subjectName || teacher.subjects.find((subject) => subject.isPrimary)?.name || teacher.subjects[0]?.name || "Matière à choisir";
  const teacherTrustSignal = teacher.rating > 0
    ? `Note ${teacher.rating.toFixed(1)}/5 · ${teacher.commune ?? "Abidjan"}`
    : `Certifié · ${teacher.commune ?? "Abidjan"}`;
  const hasScheduleDayMismatch = Boolean(
    form.startDate
    && selectedDays.length > 0
    && selectedStartDayKey
    && !selectedDays.includes(selectedStartDayKey),
  );
  const sessionPreview = buildSessionPreview(selectedTimeLabels, customTimeRequest, selectedPackSessions, selectedStartDateLabel);
  const hasValidStartDate = Boolean(form.startDate && form.startDate >= todayIso);
  const hasValidTimeRequest = form.selectedTimeSlots.length > 0 || Boolean(form.customDay && form.customStartTime);
  const earliestCourseStartAt = form.startDate
    ? getEarliestCourseStartDateTime({
        dateInput: form.startDate,
        selectedTimeSlots: form.selectedTimeSlots,
        customStartTime: form.customStartTime,
      })
    : null;
  const minimumBookingDeadline = new Date(Date.now() + MIN_BOOKING_NOTICE_HOURS * 60 * 60 * 1000);
  const hasMinimumBookingNotice = hasValidTimeRequest && respectsMinimumBookingNotice(earliestCourseStartAt);
  const isScheduleReadyForPayment = hasValidStartDate && hasValidTimeRequest && !hasScheduleDayMismatch && hasMinimumBookingNotice;
  const paymentScheduleWarning = !form.startDate
    ? "Sélectionnez une date de première séance avant de passer au paiement."
    : form.startDate < todayIso
      ? "La date sélectionnée est passée. Choisissez aujourd'hui ou une date ultérieure."
      : hasScheduleDayMismatch
        ? `La date choisie tombe un ${selectedStartDayLabel.toLowerCase()}, mais le créneau choisi correspond à un autre jour.`
        : !hasValidTimeRequest
          ? "Sélectionnez un créneau de 2h ou indiquez une préférence horaire complète."
          : !hasMinimumBookingNotice
            ? `Réservez au moins ${MIN_BOOKING_NOTICE_HOURS}h avant le début du cours. Choisissez un créneau à partir du ${formatDateTimeLabel(minimumBookingDeadline)}.`
          : "";
  const reservationFormNotice = getReservationFormNotice({
    step,
    displayName,
    courseFormat: form.courseFormat,
    groupType: form.groupType,
    participantsCount,
    selectedStartDateLabel,
    preferredTimeSummary,
    isScheduleReadyForPayment,
    paymentScheduleWarning,
    isQuoteOnly: pricing.isQuoteOnly,
    totalPrice,
  });

  function handleClientTypeChange(clientType: string) {
    const nextCategory = CLIENT_TYPE_DEFAULT_CATEGORY[clientType] ?? form.courseCategory;
    setForm((current) => ({
      ...current,
      clientType,
      courseCategory: nextCategory,
      levelName: suggestLevelForCategory(teacher.levels, nextCategory, current.levelName),
      schoolSystem: isSchoolContext(nextCategory) ? current.schoolSystem : "",
      preciseLevel: isSchoolContext(nextCategory) ? current.preciseLevel : "",
      courseCatalogId: current.courseCategory === nextCategory ? current.courseCatalogId : "",
    }));
  }

  function handleCourseCategoryChange(courseCategory: string) {
    setForm((current) => ({
      ...current,
      courseCategory,
      levelName: suggestLevelForCategory(teacher.levels, courseCategory, current.levelName),
      schoolSystem: isSchoolContext(courseCategory) ? current.schoolSystem : "",
      preciseLevel: "",
      courseCatalogId: "",
    }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.clientType) return "Veuillez sélectionner le type de client.";
      if (!form.courseCategory) return "Veuillez sélectionner la catégorie du besoin.";
      if (!hasTeacherLevels) return "Ce professeur n'a pas encore de niveau/profil configuré par le service client.";
      if (!hasTeacherSubjects) return "Ce professeur n'a pas encore de matière configurée par le service client.";
      if (!form.levelName) return `Veuillez sélectionner : ${categoryCopy.levelLabel.toLowerCase()}.`;
      if (schoolContext) {
        const educationValidation = validateEducationSelection({
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
        if (!form.commune) return "Veuillez sélectionner votre commune.";
        if (!form.quartier.trim()) return "Veuillez indiquer votre quartier.";
        if (!form.addressHint.trim()) return "Veuillez indiquer un repère ou une adresse approximative pour le cours à domicile.";
      }
      if (!form.startDate) {
        return "Veuillez sélectionner la date souhaitée pour commencer les séances.";
      }
      if (form.startDate < todayIso) {
        return "La date souhaitée ne peut pas être dans le passé. Choisissez aujourd'hui ou une date ultérieure.";
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
      if (hasScheduleDayMismatch) {
        return `La date choisie tombe un ${selectedStartDayLabel.toLowerCase()}. Sélectionnez un créneau du ${selectedStartDayLabel.toLowerCase()} ou modifiez la date.`;
      }
      if (!hasMinimumBookingNotice) {
        return paymentScheduleWarning;
      }
    }
    if (s === 4) {
      if (pricing.isQuoteOnly) return null;
      if (!isScheduleReadyForPayment) return paymentScheduleWarning || "Veuillez compléter le planning avant paiement.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const err = [0, 1, 2, 3, 4].map(validateStep).find(Boolean);
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
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
          courseCategory: form.courseCategory,
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
          startDate: form.startDate || undefined,
          sessionsCount: PACK_OPTIONS.find((p) => p.value === form.packType)?.count ?? 1,
          packType: form.packType,
          message: form.message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la réservation");
        return;
      }
      if (data.booking?.isQuoteOnly) {
        toast.success("Demande transmise. Le service client vous proposera un devis.");
        router.push(`/client/reservations/${data.booking.id}`);
      } else if (data.payment?.checkoutUrl) {
        toast.success("Redirection vers PayDunya...");
        window.location.assign(data.payment.checkoutUrl);
      } else {
        toast.warning(data.payment?.error || "Réservation créée. PayDunya doit être configuré pour encaisser le paiement.");
        router.push(`/client/reservations/${data.booking.id}?payment=pending`);
      }
    } catch (e: any) {
      toast.error("Erreur réseau, veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  const isFinalStep = step === STEPS.length - 1;
  const primaryActionLabel = isFinalStep
    ? pricing.isQuoteOnly
      ? "Envoyer la demande"
      : "Payer via PayDunya"
    : "Continuer";
  const primaryActionDisabled = submitting || (isFinalStep && !isScheduleReadyForPayment);
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

          <div className="client-booking-total-card rounded-lg border border-[#111B4D] bg-[#111B4D] p-3 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#DDE6F7]">{pricing.isQuoteOnly ? "Estimation" : "Total actuel"}</p>
                <p className="mt-1 text-2xl font-semibold leading-tight text-white">{pricing.isQuoteOnly ? "Sur devis" : formatFCFA(totalPrice)}</p>
              </div>
              <WalletCards className="mt-1 h-5 w-5 text-white" />
            </div>
            <p className="mt-2 text-xs font-medium leading-5 text-white">
              {pricing.isQuoteOnly
                ? "Le montant final sera validé par le service client avant paiement."
                : pricing.transportFee > 0
                  ? `Déplacement inclus : ${formatFCFA(pricing.transportFee)}`
                  : "Aucun frais de déplacement ajouté pour le moment."}
            </p>
          </div>
        </div>

        <div className="client-booking-progress border-t border-[#E6EAF3] px-3 py-3 sm:px-5 sm:py-4">
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
          <div
            className="client-booking-progress-grid mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden"
            aria-label="Progression mobile"
          >
            {STEPS.map((stepLabel, index) => {
              const complete = index < step;
              const active = index === step;
              const reachable = index <= step;
              const compactStepLabel = stepLabel === "Disponibilité"
                ? "Date"
                : stepLabel === "Récapitulatif"
                  ? "Récap."
                  : stepLabel === "Paiement"
                    ? "Payer"
                  : stepLabel;
              return (
                <button
                  key={stepLabel}
                  type="button"
                  disabled={!reachable}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Étape ${index + 1}: ${stepLabel}`}
                  onClick={() => {
                    if (reachable) setStep(index);
                  }}
                  className={`min-h-11 min-w-[6.65rem] rounded-lg border px-2 text-center text-[11px] font-semibold leading-3 transition-colors ${
                    active
                      ? "border-[#111B4D] bg-[#111B4D] text-white"
                      : complete
                        ? "border-[#111B4D] bg-white text-[#111B4D]"
                        : "cursor-default border-[#E3E8F2] bg-white text-[#64748B]"
                  }`}
                >
                  <span className="block uppercase tracking-wide">
                    {index + 1}
                    {complete ? <CheckCircle2 className="ml-1 inline h-3 w-3" /> : null}
                  </span>
                  <span className="mt-0.5 block truncate">{compactStepLabel}</span>
                </button>
              );
            })}
          </div>
          <div className="client-booking-progress-grid mt-3 hidden grid-cols-5 gap-2 lg:grid">
            {STEPS.map((stepLabel, index) => {
              const complete = index < step;
              const active = index === step;
              return (
                <button
                  key={stepLabel}
                  type="button"
                  disabled={index > step}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Étape ${index + 1}: ${stepLabel}`}
                  onClick={() => {
                    if (index <= step) setStep(index);
                  }}
                  className={`min-h-10 rounded-lg border px-3 text-center text-xs font-semibold transition-colors ${
                    active
                      ? "border-[#111B4D] bg-[#111B4D] text-white"
                      : complete
                        ? "border-[#111B4D] bg-white text-[#111B4D]"
                        : "cursor-default border-[#E6EAF3] bg-white text-[#64748B] disabled:pointer-events-none"
                  }`}
                >
                  {complete ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : null}
                  {index + 1}. {stepLabel}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="client-booking-workspace grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="client-booking-step-card client-booking-step-panel min-w-0 overflow-hidden rounded-lg border-[#DDE6F7] bg-white">
          <CardContent className="p-4 sm:p-6">
            <ImportantActionNotice
              title={reservationFormNotice.title}
              description={reservationFormNotice.description}
              className="mb-4"
            />

            {/* Step 1 — Besoin */}
            {step === 0 && (
            <div className="space-y-5">
              <StepIntro step="Étape 1" title="Besoin du cours" description={categoryCopy.intro} />
              <div className="grid gap-4 min-[720px]:grid-cols-2">
                <div>
                  <Label htmlFor="clientType">Type de client *</Label>
                  <select
                    id="clientType"
                    value={form.clientType}
                    onChange={(e) => handleClientTypeChange(e.target.value)}
                    className={FIELD_CLASS}
                  >
                    {CLIENT_TYPES.map((clientType) => (
                      <option key={clientType} value={clientType}>{clientType}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="courseCategory">Catégorie du besoin *</Label>
                  <select
                    id="courseCategory"
                    value={form.courseCategory}
                    onChange={(e) => handleCourseCategoryChange(e.target.value)}
                    className={FIELD_CLASS}
                  >
                    {COURSE_CATEGORIES.map((category) => (
                      <option key={category.code} value={category.code}>{category.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="levelName">{categoryCopy.levelLabel} *</Label>
                  <SearchableCatalogSelect
                    id="levelName"
                    name="levelName"
                    value={form.levelName}
                    onValueChange={(value) => setForm((current) => ({
                      ...current,
                      levelName: value,
                      preciseLevel: isSchoolContext(current.courseCategory) && isLyceeLevel(value) ? current.preciseLevel : "",
                    }))}
                    placeholder={`Rechercher ${categoryCopy.levelLabel.toLowerCase()}`}
                    searchPlaceholder="Tapez le niveau, profil, diplôme ou concours..."
                    emptyLabel="Aucun niveau configuré pour ce professeur."
                    allLabel="Aucun niveau choisi"
                    groups={levelSelectionGroups}
                    triggerClassName="mt-1.5 min-h-12 rounded-lg"
                  />
                  {teacher.levels.length > 0 ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[#64748B]">
                      Niveaux couverts : {teacher.levels.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-[#111B4D]">
                      Aucun niveau n'est configuré pour ce professeur. Le service client doit compléter sa fiche.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="subjectName">{categoryCopy.subjectLabel} *</Label>
                  <SearchableCatalogSelect
                    id="subjectName"
                    name="subjectName"
                    value={form.subjectName}
                    onValueChange={(value) => update("subjectName", value)}
                    placeholder={`Rechercher ${categoryCopy.subjectLabel.toLowerCase()}`}
                    searchPlaceholder="Tapez une matière, compétence ou module..."
                    emptyLabel="Aucune matière configurée pour ce professeur."
                    allLabel="Aucune matière choisie"
                    groups={subjectSelectionGroups}
                    triggerClassName="mt-1.5 min-h-12 rounded-lg"
                  />
                  {hasTeacherSubjects ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[#64748B]">
                      Matières enseignées par {displayName}.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-[#111B4D]">
                      Aucune matière n'est configurée pour ce professeur. Le service client doit compléter sa fiche.
                    </p>
                  )}
                </div>
                {isLyceeSelection && (
                  <div className="min-[720px]:col-span-2 rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <div className="grid gap-4 min-[720px]:grid-cols-2">
                      <div>
                        <Label htmlFor="schoolSystem">Système scolaire lycée *</Label>
                        <select
                          id="schoolSystem"
                          value={form.schoolSystem}
                          onChange={(e) => setForm((current) => ({ ...current, schoolSystem: e.target.value, preciseLevel: "", courseCatalogId: "" }))}
                          className={FIELD_CLASS}
                        >
                          <option value="">Sélectionner le système...</option>
                          {SCHOOL_SYSTEMS.map((system) => (
                            <option key={system.value} value={system.value}>{system.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="preciseLevel">Classe, série ou voie *</Label>
                        <select
                          id="preciseLevel"
                          value={form.preciseLevel}
                          onChange={(e) => setForm((current) => ({ ...current, preciseLevel: e.target.value, courseCatalogId: "" }))}
                          className={FIELD_CLASS}
                        >
                          <option value="">Sélectionner...</option>
                          {preciseLevelOptions.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-medium text-[#6B7280]">
                      Le système scolaire est obligatoire au lycée pour ne pas mélanger les séries ivoiriennes, le lycée français et les programmes internationaux.
                    </p>
                  </div>
                )}
                <div className="min-[720px]:col-span-2">
                  <Label htmlFor="courseCatalogId">Cours catalogue conseillé</Label>
                  <SearchableCatalogSelect
                    id="courseCatalogId"
                    value={safeCourseCatalogId}
                    onValueChange={(value) => update("courseCatalogId", value)}
                    name="courseCatalogId"
                    placeholder="Rechercher un cours compatible"
                    searchPlaceholder="Tapez une matière, un niveau ou un mot-clé..."
                    emptyLabel="Aucun cours catalogue compatible avec ce professeur."
                    allLabel="Aucun cours précis"
                    groups={selectedCategoryCourseGroups}
                    triggerClassName="mt-1.5 min-h-12 rounded-lg"
                  />
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
                    Optionnel : seuls les cours cohérents avec {displayName} et ses matières sont proposés.
                    {selectedCategoryCourses.length > 0 ? ` ${selectedCategoryCourses.length} option${selectedCategoryCourses.length > 1 ? "s" : ""} disponible${selectedCategoryCourses.length > 1 ? "s" : ""}.` : ""}
                  </p>
                </div>
                {selectedCatalogCourse && (
                  <div className="min-[720px]:col-span-2 rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <p className="text-sm font-semibold text-[#111827]">{selectedCatalogCourse.nom}</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">{selectedCatalogCourse.objectif}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#111827]">
                      <span className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1">
                        {pricing.isQuoteOnly ? "Tarif : sur devis du service client" : `Palier calculé ${formatFCFA(pricing.unitSessionAmount)} / séance`}
                      </span>
                      <span className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1">
                        {pricing.isQuoteOnly ? "Montant final validé par le service client" : `Total actuel ${formatFCFA(pricing.totalClientPays)}`}
                      </span>
                      <span className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1">{selectedCatalogCourse.public_cible}</span>
                    </div>
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
              <div>
                <Label htmlFor="objective">Objectif *</Label>
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
              <div className="grid gap-4 min-[720px]:grid-cols-2">
                <div className="min-[720px]:col-span-2">
                  <Label htmlFor="schoolProgram">{categoryCopy.programLabel}</Label>
                  <Input
                    id="schoolProgram"
                    value={form.schoolProgram}
                    onChange={(e) => update("schoolProgram", e.target.value)}
                    placeholder={categoryCopy.programPlaceholder}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-xs text-[#64748B]">Le résumé transmis au service client inclura le profil, la catégorie, le niveau et cette précision.</p>
                </div>
              </div>
              <div>
                <Label htmlFor="needDescription">{categoryCopy.descriptionLabel} (optionnel)</Label>
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
              <div>
                <Label>Type de cours *</Label>
                <RadioGroup
                  value={form.groupType}
                  onValueChange={(v) => {
                    if (v === "SMALL_GROUP" && !teacher.offersGroup) return;
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
                  } ${!teacher.offersGroup ? "cursor-not-allowed border-[#E3E8F2] text-[#9CA3AF]" : ""}`}>
                    <RadioGroupItem value="SMALL_GROUP" disabled={!teacher.offersGroup} />
                    <Users className="h-5 w-5 text-[#64748B]" />
                    <div>
                      <p className="text-sm font-medium text-[#111827]">Petit groupe</p>
                      <p className="text-xs text-[#64748B]">
                        {teacher.offersGroup ? "Plusieurs élèves. +50% du montant de base par participant supplémentaire." : "Non proposé par ce professeur."}
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

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

              {(form.courseCategory === "apprentissage_metier" || form.courseCategory === "formation_professionnelle") && (
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
              <StepIntro step="Étape 3" title="Lieu et disponibilité" description="Choisissez une date, un lieu et un créneau de 2h compatible avec le professeur." />

              {form.courseFormat === "HOME" ? (
                <div className="grid gap-4 min-[720px]:grid-cols-2">
                  <div>
                    <Label htmlFor="commune">Commune *</Label>
                    <SearchableCatalogSelect
                      id="commune"
                      name="commune"
                      value={form.commune}
                      onValueChange={(value) => update("commune", value)}
                      placeholder="Rechercher la commune"
                      searchPlaceholder="Tapez Cocody, Yopougon, Marcory..."
                      emptyLabel="Aucune commune disponible."
                      allLabel="Aucune commune choisie"
                      groups={communeSelectionGroups}
                      triggerClassName="mt-1.5 min-h-12 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quartier">Quartier *</Label>
                    <Input
                      id="quartier"
                      value={form.quartier}
                      onChange={(e) => update("quartier", e.target.value)}
                      placeholder="Ex: Riviera Palmeraie"
                    />
                  </div>
                  <div className="min-[720px]:col-span-2">
                    <Label htmlFor="addressHint">Repère / adresse approximative *</Label>
                    <Textarea
                      id="addressHint"
                      value={form.addressHint}
                      onChange={(e) => update("addressHint", e.target.value)}
                      placeholder="Ex : près de la pharmacie, immeuble blanc, entrée principale... L'adresse exacte peut être confirmée après validation."
                      rows={2}
                    />
                    <p className="mt-1 text-xs text-[#64748B]">
                      Un repère clair aide le service client et le professeur à confirmer rapidement la faisabilité du déplacement.
                    </p>
                  </div>
                  <div className="min-[720px]:col-span-2 rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <p className="text-sm font-semibold text-[#111827]">Déplacement calculé automatiquement</p>
                    <div className="mt-3 grid gap-2 min-[760px]:grid-cols-3">
                      <InfoMini label="Base professeur" value={teacher.commune ?? "À confirmer"} />
                      <InfoMini label="Commune client" value={form.commune || "À sélectionner"} />
                      <InfoMini
                        label="Frais estimés"
                        value={!form.commune ? "En attente" : pricing.isQuoteOnly ? "Sur devis" : formatFCFA(pricing.transportFee)}
                      />
                    </div>
                    <p className="mt-2 text-xs font-medium text-[#6B7280]">
                      {form.commune
                        ? `${pricing.transportRouteLabel ?? "Trajet"} - ${formatSentencePart(pricing.transportRuleLabel ?? "règle Grand Abidjan")}. Ces frais vont entièrement au professeur.`
                        : "Choisissez la commune du client pour que la plateforme applique la matrice Grand Abidjan."}
                    </p>
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

              <div>
                <Label>Créneaux disponibles du professeur *</Label>
                <p className="mt-1 text-sm text-[#64748B]">
                  Sélectionnez un ou plusieurs créneaux exacts. Chaque séance dure 2 heures.
                  {selectedStartDayLabel ? ` Pour la date choisie, seuls les créneaux du ${selectedStartDayLabel.toLowerCase()} sont activés.` : " Choisissez d'abord la date souhaitée."}
                </p>
                <div className="mt-3 space-y-3 md:hidden">
                  {mobileAvailabilityDays.length === 0 && (
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
                      <p className="font-semibold text-[#111B4D]">Choisissez d'abord une date</p>
                      <p className="mt-1 text-sm leading-6 text-[#64748B]">
                        Les créneaux mobiles s'affichent ensuite uniquement pour le jour correspondant, afin de garder la réservation claire et rapide.
                      </p>
                    </div>
                  )}
                  {mobileAvailabilityDays.map((day) => {
                    const matchesSelectedDate = !selectedStartDayKey || day.key === selectedStartDayKey;
                    const availableSlots = TWO_HOUR_SLOTS.filter((slot) => matchesSelectedDate && !!teacherAvailability[day.key]?.[slot.key]);
                    return (
                      <div key={day.key} className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[#111B4D]">{day.label}</p>
                          <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]">
                            {availableSlots.length} créneau{availableSlots.length > 1 ? "x" : ""}
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
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
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
                                      : "border-[#E3E8F2] bg-white text-[#111B4D] hover:border-[#DDE6F7] hover:bg-white"
                                  }`}
                                >
                                  {slot.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 hidden rounded-lg border border-[#E3E8F2] bg-white p-3 md:block">
                  <div className="grid grid-cols-[92px_repeat(7,minmax(0,1fr))] gap-1.5 text-xs lg:grid-cols-[112px_repeat(7,minmax(0,1fr))] lg:gap-2 lg:text-xs">
                    <div className="font-semibold text-[#64748B]">Jour</div>
                    {TWO_HOUR_SLOTS.map((slot) => (
                      <div key={slot.key} className="text-center font-semibold text-[#64748B]">{slot.shortLabel}</div>
                    ))}
                    {WEEK_DAYS.map((day) => (
                      <div key={day.key} className="contents">
                        <div className="flex items-center rounded-lg bg-white px-2 py-2 font-semibold text-[#111B4D] lg:px-3">
                          {day.label}
                        </div>
                        {TWO_HOUR_SLOTS.map((slot) => {
                          const key = `${day.key}|${slot.key}`;
                          const matchesSelectedDate = !selectedStartDayKey || day.key === selectedStartDayKey;
                          const available = matchesSelectedDate && !!teacherAvailability[day.key]?.[slot.key];
                          const checked = form.selectedTimeSlots.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={!available}
                              onClick={() => {
                                if (!available) return;
                                update(
                                  "selectedTimeSlots",
                                  checked
                                    ? form.selectedTimeSlots.filter((item) => item !== key)
                                    : [...form.selectedTimeSlots, key],
                                );
                              }}
                              className={`min-h-11 rounded-lg border px-1.5 py-2 text-center text-xs font-semibold transition lg:px-2 ${
                                checked
                                  ? "border-[#111B4D] bg-[#111B4D] text-white"
                                  : available
                                    ? "border-[#E3E8F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
                                    : "cursor-not-allowed border-[#E3E8F2] bg-white text-[#94A3B8]"
                              }`}
                              title={!matchesSelectedDate && selectedStartDayLabel ? `Indisponible pour la date choisie (${selectedStartDayLabel})` : undefined}
                            >
                              {available ? "Disponible" : "Indispo."}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
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
                        <p className="text-sm font-semibold text-[#111827]">Plan prévisionnel des séances de 2h</p>
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

              <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                <Label>Votre préférence horaire personnalisée</Label>
                <p className="mt-1 text-sm text-[#64748B]">
                  Si les créneaux proposés ne conviennent pas parfaitement, indiquez le jour et l'heure souhaités.
                  Le service client vérifiera avec le professeur avant confirmation.
                </p>
                <div className="mt-3 grid gap-3 min-[720px]:grid-cols-[1fr_180px]">
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
                      value={form.customStartTime}
                      onChange={(event) => update("customStartTime", event.target.value)}
                      className="mt-1.5 h-11 rounded-lg"
                    />
                  </div>
                  <div className="min-[720px]:col-span-2">
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
                {form.customDay && customTimeRange && (
                  <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <div className="grid gap-3 min-[720px]:grid-cols-[1fr_auto] min-[640px]:items-center">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">Demande client prévisualisée</p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {dayLabel(form.customDay)} {customTimeRange}. Cette demande représente une séance de 2h à confirmer avec {displayName}.
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
                  Le prix affiché reste celui de la formule choisie pour des séances de 2h. Si une demande sort du cadre normal, le service client valide l'ajustement avant confirmation.
                </p>
              </div>

              <div>
                <Label>Formule *</Label>
                <RadioGroup
                  value={form.packType}
                  onValueChange={(v) => update("packType", v as PackType)}
                  className="mt-2 grid gap-2 min-[720px]:grid-cols-2 lg:grid-cols-3"
                >
                  {PACK_OPTIONS.map((p) => {
                    const optionPricing = calculateBookingPricing({
                      category: form.courseCategory,
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
                      teacherCommune: canResolveTransport ? teacher.commune : undefined,
                      teacherZoneNames: canResolveTransport ? teacher.zones : undefined,
                      clientCommune: canResolveTransport ? form.commune : undefined,
                    });
                    const count = optionPricing.numberOfSessions ?? 0;
                    const average = count > 0 ? Math.round(optionPricing.courseAmount / count) : 0;
                    return (
                      <label
                        key={p.value}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors ${
                          form.packType === p.value ? "border-[#111B4D] bg-white text-[#111B4D]" : "border-[#E3E8F2] bg-white hover:border-[#111B4D] hover:bg-white"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <RadioGroupItem value={p.value} />
                          <span>
                            <span className="block font-medium text-[#111827]">{p.label}</span>
                            <span className="block text-xs text-[#64748B]">
                              {optionPricing.isQuoteOnly
                                ? "Sur devis par le service client"
                                : `${formatFCFA(optionPricing.totalClientPays)} · ${formatCount(count, "séance")} de 2h · env. ${formatFCFA(average)}/séance`}
                            </span>
                            {optionPricing.discountAmount > 0 && (
                              <span className="mt-0.5 block text-xs font-semibold text-[#111B4D]">
                                Remise pack {formatFCFA(optionPricing.discountAmount)} déjà intégrée
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="message">Message complémentaire (optionnel)</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="Précisez vos attentes, le chapitre à traiter, etc."
                  rows={3}
                />
              </div>
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
              <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
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
                  <Row label="Tarif appliqué" value={pricing.isQuoteOnly ? "Sur devis" : pricing.priceTierLabel} />
                  {form.courseFormat === "HOME" ? (
                    <>
                      <Row label="Commune" value={form.commune || "—"} />
                      <Row label="Quartier" value={form.quartier || "—"} />
                      {form.addressHint && <Row label="Adresse" value={form.addressHint} />}
                      <Row label="Trajet" value={pricing.transportRouteLabel ?? "À confirmer"} />
                      <Row label="Déplacement" value={pricing.isQuoteOnly ? "À confirmer par le service client" : formatFCFA(pricing.transportFee)} />
                    </>
                  ) : (
                    form.onlineLink && <Row label="Lien" value={form.onlineLink} />
                  )}
                  {(form.courseCategory === "apprentissage_metier" || form.courseCategory === "formation_professionnelle") && (
                    <Row label="Matériel" value="Obligatoire côté apprenant, non fourni ni facturé par Compétence" />
                  )}
                  <Row label="Date souhaitée" value={selectedStartDateLabel || "—"} />
                  <Row label="Validation planning" value={isScheduleReadyForPayment ? "Date et créneau prêts pour paiement" : paymentScheduleWarning || "Planning à compléter"} />
                  <Row label="Créneaux / préférence" value={preferredTimeSummary.join(" ; ") || "—"} />
                  <Row label="Formule" value={PACK_OPTIONS.find((p) => p.value === form.packType)?.label ?? form.packType} />
                </dl>
              </div>

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
                  courseAmount={pricing.courseAmount}
                  transportFee={pricing.transportFee}
                  transportFeeLabel={pricing.transportFeeLabel}
                  transportRouteLabel={pricing.transportRouteLabel}
                  transportRuleLabel={pricing.transportRuleLabel}
                  materialFee={pricing.materialFee}
                  discountAmount={pricing.discountAmount}
                  paymentServiceFeeAmount={pricing.paymentServiceFeeAmount}
                  paymentServiceFeeLabel={pricing.paymentServiceFeeLabel}
                  totalBeforePaymentServiceFee={pricing.totalBeforePaymentServiceFee}
                  isQuoteOnly={pricing.isQuoteOnly}
                />
                {sessionPreview.length > 0 && (
                  <div className="rounded-lg border border-[#DDE6F7] bg-white p-3">
                    <div className="flex flex-col gap-1 min-[460px]:flex-row min-[460px]:items-end min-[460px]:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Séances prévues</p>
                        <p className="mt-0.5 text-xs font-medium leading-5 text-[#64748B]">
                          Une séance dure 2h. La première date est celle choisie par le client.
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
                )}
                <div className="flex items-start gap-2 rounded-lg border border-[#DDE6F7] bg-white p-3 text-xs font-medium leading-5 text-[#64748B]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                  <span>
                    {pricing.isQuoteOnly
                      ? "Aucun paiement n'est demandé maintenant. Le service client vous proposera un montant final clair."
                      : "Le paiement sera finalisé sur PayDunya, confirmé côté serveur, puis gardé sécurisé jusqu'à votre confirmation après le cours."}
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
                title={pricing.isQuoteOnly ? "Demande de devis" : "Paiement sécurisé"}
                description={pricing.isQuoteOnly
                  ? "Contrôlez le dossier. Le service client vous confirmera un devis précis avant paiement."
                  : "Contrôlez le dossier. Le moyen de paiement et les informations de paiement seront gérés uniquement sur PayDunya."}
              />

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <ProfessorImage photoUrl={teacher.photoUrl} name={displayName} size="md" shape="circle" verified={teacher.badgeVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#111827]">{displayName}</p>
                      <p className="mt-0.5 text-sm text-[#6B7280]">{form.subjectName} · {form.levelName}</p>
                    </div>
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
                  unitPrice={pricing.unitSessionAmount}
                  totalPrice={totalPrice}
                  sessionsCount={selectedPackSessions}
                  participantsCount={participantsCount}
                  groupType={form.groupType}
                  packType={form.packType}
                  priceTierKey={pricing.priceTierKey}
                  courseAmount={pricing.courseAmount}
                  transportFee={pricing.transportFee}
                  transportFeeLabel={pricing.transportFeeLabel}
                  transportRouteLabel={pricing.transportRouteLabel}
                  transportRuleLabel={pricing.transportRuleLabel}
                  materialFee={pricing.materialFee}
                  discountAmount={pricing.discountAmount}
                  paymentServiceFeeAmount={pricing.paymentServiceFeeAmount}
                  paymentServiceFeeLabel={pricing.paymentServiceFeeLabel}
                  totalBeforePaymentServiceFee={pricing.totalBeforePaymentServiceFee}
                  isQuoteOnly={pricing.isQuoteOnly}
                />
              </div>

              {pricing.isQuoteOnly ? (
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                  <p className="text-sm font-semibold text-[#111827]">Validation service client requise</p>
                  <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                    {pricing.quoteReason ?? "Ce dossier nécessite une estimation manuelle."} Aucun paiement ne sera encaissé à cette étape.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
                    <InfoMini label="Palier" value={pricing.priceTierLabel} />
                    <InfoMini label="Formule" value={pricing.packLabel} />
                    <InfoMini label="Transport" value={form.courseFormat === "HOME" ? (pricing.isQuoteOnly ? "À confirmer" : formatFCFA(pricing.transportFee)) : formatFCFA(0)} />
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[#E3E8F2] bg-white">
                  <div className="grid gap-4 border-b border-[#E5E7EB] bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Paiement externalisé</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <PayDunyaMark />
                        <span className="inline-flex min-h-8 items-center rounded-lg border border-[#CAD7F2] bg-white px-3 text-xs font-semibold text-[#111B4D]">
                          Confirmation sécurisée
                        </span>
                      </div>
                      <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#64748B]">
                        Compétence ne collecte aucune information Mobile Money et ne vous fait plus choisir le moyen de paiement ici.
                        PayDunya affichera les options disponibles, collectera les informations nécessaires et confirmera automatiquement le paiement à la plateforme.
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#DDE6F7] bg-white px-4 py-3 text-right">
                      <p className="text-xs font-semibold uppercase tracking-normal text-[#64748B]">Montant PayDunya</p>
                      <p className="mt-1 text-2xl font-semibold text-[#111B4D]">{formatFCFA(totalPrice)}</p>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-sm font-semibold text-[#111827]">Moyens disponibles sur PayDunya Côte d'Ivoire</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-4">
                      {PAYMENT_METHODS.map((m) => (
                        <div key={m.value} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-[#E3E8F2] bg-white p-2.5 text-center">
                          <PaymentMethodLogo method={m.value} className="h-10 w-full min-w-0" />
                          <span className="text-xs font-semibold text-[#111827]">{m.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 flex gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#111B4D]">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      Le bouton final ouvre PayDunya. La réservation ne sera marquée payée qu'après confirmation serveur PayDunya.
                    </p>
                  </div>
                </div>
              )}
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
              <Button type="button" onClick={submit} disabled={submitting || !isScheduleReadyForPayment} className="min-h-11 w-full min-w-44 rounded-lg min-[640px]:w-auto">
                {submitting ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-[#9AAAD0]" /> Traitement...</>
                ) : (
                  pricing.isQuoteOnly ? (
                    <>Envoyer la demande de devis</>
                  ) : (
                    <><ExternalLink className="mr-2 h-4 w-4" /> Payer via PayDunya</>
                  )
                )}
              </Button>
            )}
          </div>
        </CardContent>
        </Card>

        <aside className="client-booking-side-summary hidden space-y-4 xl:block xl:self-start">
          <div className="rounded-lg border border-[#DDE6F7] bg-white p-4">
            <div className="flex items-center gap-3">
              <ProfessorImage photoUrl={teacher.photoUrl} name={displayName} size="md" shape="circle" verified={teacher.badgeVerified} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#111827]">{displayName}</p>
                <p className="truncate text-xs font-medium text-[#64748B]">{primarySubjectLabel} · {teacher.commune ?? "Abidjan"}</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#DDE6F7] bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Résumé instantané</p>
              <div className="mt-3 space-y-2">
                <SummaryLine icon={<ClipboardList className="h-4 w-4" />} label="Besoin" value={primarySubjectLabel} />
                <SummaryLine icon={<CalendarDays className="h-4 w-4" />} label="Date" value={selectedStartDateLabel || "À choisir"} />
                <SummaryLine icon={<Clock3 className="h-4 w-4" />} label="Créneau" value={preferredTimeSummary.join(" ; ") || "À choisir"} />
                <SummaryLine icon={<Users className="h-4 w-4" />} label="Participants" value={`${participantsCount}`} />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#111B4D] bg-[#111B4D] p-3 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#DDE6F7]">Montant client</p>
                  <p className="mt-1 text-2xl font-semibold leading-tight text-white">{pricing.isQuoteOnly ? "Sur devis" : formatFCFA(totalPrice)}</p>
                </div>
                <Lock className="mt-1 h-5 w-5 text-white" />
              </div>
              <p className="mt-2 text-xs font-medium leading-5 text-white">
                Le client ne voit que le montant à payer. Les répartitions internes restent côté service client.
              </p>
            </div>

            <div className="mt-4 space-y-2 text-xs font-medium leading-5 text-[#64748B]">
              <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" /> Réservation rattachée au professeur choisi.</p>
              <p className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" /> Date et créneau transmis au suivi service client.</p>
            </div>
          </div>
        </aside>
      </div>

      <div
        className="client-booking-mobile-action fixed inset-x-2 z-40 rounded-lg border border-[#DDE6F7] bg-white p-2.5 min-[390px]:inset-x-3 min-[720px]:hidden"
        style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-2 space-y-1.5 px-1">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-semibold text-[#111827]">
              Étape {step + 1}/{STEPS.length} · {currentStepDetail.title}
            </span>
            <span className="shrink-0 text-xs font-semibold text-[#111B4D]">
              {pricing.isQuoteOnly ? "Sur devis" : formatFCFA(totalPrice)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#E5E7EB]" aria-hidden="true">
            <div
              className="h-full rounded-full bg-[#111B4D] transition-[width] duration-150"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[11px] font-semibold leading-4 text-[#64748B]">
            <span className="min-w-0 truncate">{displayName}</span>
            <span className="max-w-[9.5rem] truncate text-right text-[#111827]">
              {selectedStartDateLabel || "Date à choisir"}
            </span>
            <span className="col-span-2 min-w-0 truncate text-[#64748B]">
              {preferredTimeSummary.join(" ; ") || "Créneau de 2h à choisir"}
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
            {!submitting && isFinalStep && !pricing.isQuoteOnly && <ExternalLink className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
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

function SummaryLine({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border border-[#E6EAF3] bg-white px-3 py-2">
      <span className="mt-0.5 shrink-0 text-[#111B4D]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold leading-snug text-[#111827]">{value}</p>
      </div>
    </div>
  );
}

function PayDunyaMark() {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3" aria-label="PayDunya Checkout">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111B4D] text-[11px] font-semibold text-white">
        PD
      </span>
      <span className="text-sm font-semibold tracking-normal text-[#111827]">
        PayDunya
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
