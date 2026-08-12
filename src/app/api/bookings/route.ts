import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTeacherJourney, teacherSupportsJourney } from "@/lib/teacher-journeys";
import { filterLevelsForJourney, subjectNameMatchesJourney } from "@/lib/catalog-journey";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateReference } from "@/lib/format";
import {
  PackType,
  CourseFormat,
  GroupType,
  type PaymentMethod,
  type PaymentProvider,
} from "@prisma/client";
import {
  MIN_BOOKING_NOTICE_HOURS,
  availabilitySelectionLabel,
  WEEK_DAYS,
  getEarliestCourseStartDateTime,
  parseAvailability,
  parseAvailabilitySelection,
  respectsMinimumBookingNotice,
  unavailableSelections,
} from "@/lib/scheduling";
import {
  buildNeighborhoodAliasMap,
  calculateBookingPricing,
  parsePricingSnapshot,
  pricingSnapshotToJson,
} from "@/lib/pricing";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import {
  CLIENT_TYPES,
  COURSE_CATEGORIES,
  buildSchoolProgramSummary,
  findCourseCatalogItem,
  isCourseCatalogItemCompatible,
  resolveBookingCourseCategory,
  resolveCourseCatalogSchoolSystem,
  validateEducationSelection,
} from "@/lib/course-catalog";
import { buildBookingSessionRows } from "@/lib/booking-sessions";
import { createJekoBookingCheckout } from "@/lib/payment-provider";
import { JEKO_PAYMENT_METHODS, type JekoPaymentMethod } from "@/lib/jeko-utils";
import { absoluteAppUrl } from "@/lib/public-url";
import {
  confirmablePricing,
  createPricingConfirmationFingerprint,
  expectedPricingMatches,
  publicAuthoritativePricing,
} from "@/lib/pricing-confirmation";
import { bookingDraftMatchesExpected } from "@/lib/booking-draft-consistency";
import { hasVerifiedClientPayment } from "@/lib/payment-security";
import {
  attachPartnerReferralLeadReferralInTransaction,
  buildPartnerReferralCreateData,
  claimPartnerReferralLeadInTransaction,
  getActivePartnerReferralLeadSource,
} from "@/lib/partner-referrals";

const COURSE_FORMATS: CourseFormat[] = ["HOME", "ONLINE"];
const GROUP_TYPES: GroupType[] = ["INDIVIDUAL", "SMALL_GROUP"];
const PACK_TYPES: PackType[] = ["SINGLE", "PACK_4", "PACK_8", "PACK_12", "EXAM_PREP", "CUSTOM"];
const JEKO_PLATFORM_PAYMENT_METHODS: Record<JekoPaymentMethod, PaymentMethod> = {
  wave: "WAVE",
  orange: "ORANGE_MONEY",
  mtn: "MTN_MONEY",
  moov: "MOOV_MONEY",
  djamo: "DJAMO",
};

function normalizeLabel(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isCourseFormat(value: unknown): value is CourseFormat {
  return typeof value === "string" && COURSE_FORMATS.includes(value as CourseFormat);
}

function isGroupType(value: unknown): value is GroupType {
  return typeof value === "string" && GROUP_TYPES.includes(value as GroupType);
}

function isPackType(value: unknown): value is PackType {
  return typeof value === "string" && PACK_TYPES.includes(value as PackType);
}

function isJekoPaymentMethod(value: unknown): value is JekoPaymentMethod {
  return typeof value === "string" && JEKO_PAYMENT_METHODS.includes(value as JekoPaymentMethod);
}

function normalizeClientCreationKey(value: unknown) {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return key.length >= 16 && key.length <= 140 && /^[A-Za-z0-9._:-]+$/.test(key) ? key : null;
}

function parsePreferredDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const validDays = new Set<string>(WEEK_DAYS.map((day) => day.key));
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
    .filter((item) => validDays.has(item)),
  ));
}

function parseDateInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateFr(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTimeFr(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const DATE_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function dayKeyFromDate(date: Date) {
  return DATE_DAY_KEYS[date.getDay()];
}

function requiresSpecificNeed(subjectName: string) {
  return /autre|sp[ée]cifique|besoin/i.test(subjectName);
}

function publicBookingPayload(b: any) {
  const pricingSnapshot = parsePricingSnapshot(b.pricingSnapshot);
  const unitSessionAmount = pricingSnapshot?.unitSessionAmount ?? b.unitPrice;
  const courseAmount = pricingSnapshot?.courseAmount ?? b.courseAmount;
  const totalClientPays = pricingSnapshot?.totalClientPays ?? b.totalClientPays ?? b.totalPrice;
  const verifiedClientPayment = hasVerifiedClientPayment(b);
  const teacher = b.teacher
    ? {
        ...b.teacher,
        phone: verifiedClientPayment ? b.teacher.phone ?? null : null,
        email: verifiedClientPayment ? b.teacher.email ?? null : null,
      }
    : null;
  return {
    id: b.id,
    reference: b.reference,
    subjectName: b.subjectName,
    levelName: b.levelName,
    objective: b.objective,
    clientType: b.clientType,
    courseCategory: b.courseCategory,
    schoolSystem: b.schoolSystem,
    preciseLevel: b.preciseLevel,
    courseCatalogId: b.courseCatalogId,
    courseCatalogName: b.courseCatalogName,
    schoolProgram: b.schoolProgram,
    courseFormat: b.courseFormat,
    groupType: b.groupType,
    participantsCount: b.participantsCount,
    commune: b.commune,
    quartier: b.quartier,
    onlineLink: b.onlineLink,
    preferredDays: b.preferredDays ? JSON.parse(b.preferredDays) : [],
    preferredTime: b.preferredTime,
    startDate: b.startDate,
    scheduledDate: b.scheduledDate,
    scheduledTime: b.scheduledTime,
    sessionsCount: b.sessionsCount,
    packType: b.packType,
    message: b.message,
    unitPrice: unitSessionAmount,
    totalPrice: totalClientPays,
    priceTierKey: b.priceTierKey,
    courseAmount,
    transportFee: pricingSnapshot?.transportFee ?? b.transportFee,
    transportFeeKey: b.transportFeeKey,
    transportFeeLabel: pricingSnapshot?.transportFeeLabel ?? null,
    transportRouteLabel: pricingSnapshot?.transportRouteLabel ?? null,
    transportRuleLabel: pricingSnapshot?.transportRuleLabel ?? null,
    materialFee: pricingSnapshot?.materialFee ?? b.materialFee,
    discountAmount: pricingSnapshot?.discountAmount ?? b.discountAmount,
    paymentServiceFeeRate: pricingSnapshot?.paymentServiceFeeRate ?? b.paymentServiceFeeRate ?? 0,
    paymentServiceFeeAmount: pricingSnapshot?.paymentServiceFeeAmount ?? b.paymentServiceFeeAmount ?? 0,
    paymentServiceFeeLabel: pricingSnapshot?.paymentServiceFeeLabel ?? b.paymentServiceFeeLabel ?? null,
    totalBeforePaymentServiceFee: pricingSnapshot?.totalBeforePaymentServiceFee
      ?? Math.max(0, totalClientPays - (pricingSnapshot?.paymentServiceFeeAmount ?? b.paymentServiceFeeAmount ?? 0)),
    totalClientPays,
    isQuoteOnly: b.isQuoteOnly,
    status: b.status,
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod,
    paymentProvider: b.paymentProvider,
    providerPaymentStatus: b.providerPaymentStatus,
    paymentVerifiedAt: b.paymentVerifiedAt,
    createdAt: b.createdAt,
    confirmedAt: b.confirmedAt,
    courseDoneAt: b.courseDoneAt,
    clientValidatedAt: b.clientValidatedAt,
    teacherPaidAt: b.teacherPaidAt,
    teacher,
    hasReview: Array.isArray(b.reviews) ? b.reviews.length > 0 : false,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  if (role !== "CLIENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "Accès réservé aux clients et à l'équipe Compétence." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(50, Number(searchParams.get("limit")) || 50);

  const where: any = {};
  if (role === "CLIENT") where.clientId = userId;
  if (status) where.status = status;

  const bookings = await db.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      teacher: {
        select: {
          id: true, fullName: true, professionalName: true, photoUrl: true,
          jobTitle: true, commune: true, phone: true,
        },
      },
      transactions: { orderBy: { createdAt: "desc" } },
      reviews: { where: { clientId: userId }, take: 1 },
    },
  });

  const items = role === "CLIENT"
    ? bookings.map(publicBookingPayload)
    : bookings.map((b) => ({
        ...b,
        preferredDays: b.preferredDays ? JSON.parse(b.preferredDays) : [],
        hasReview: b.reviews.length > 0,
      }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Réservé aux clients" }, { status: 403 });
  }

  const body = await req.json();
  const {
    teacherId, subjectName, levelName, objective, schoolProgram, needDescription,
    clientType, courseCategory, schoolSystem, preciseLevel, courseCatalogId,
    courseFormat, groupType, commune, quartier, addressHint, onlineLink,
    preferredDays, selectedTimeSlots, preferredTime, customStartTime, startDate, packType, message, participantsCount,
    clientCreationKey: rawClientCreationKey, paymentMethod: rawPaymentMethod,
    expectedPricing, confirmedPricingFingerprint,
    partnerReferralCode: rawPartnerReferralCode,
    partnerReferralName: rawPartnerReferralName,
    partnerReferralPhone: rawPartnerReferralPhone,
  } = body;

  const clientCreationKey = normalizeClientCreationKey(rawClientCreationKey);
  const paymentMethod = isJekoPaymentMethod(rawPaymentMethod) ? rawPaymentMethod : null;

  if (!teacherId || !subjectName || !levelName || !courseFormat || !packType || !clientType || !courseCategory) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }
  if (!clientCreationKey) {
    return NextResponse.json({ error: "Clé de création de réservation invalide. Rechargez la page puis réessayez." }, { status: 400 });
  }
  if (!paymentMethod) {
    return NextResponse.json({ error: "Choisissez un moyen de paiement Jèko valide." }, { status: 400 });
  }
  if (!CLIENT_TYPES.includes(clientType)) {
    return NextResponse.json({ error: "Type de client invalide." }, { status: 400 });
  }
  if (!COURSE_CATEGORIES.some((category) => category.code === courseCategory)) {
    return NextResponse.json({ error: "Catégorie de cours invalide." }, { status: 400 });
  }
  if (!isCourseFormat(courseFormat)) {
    return NextResponse.json({ error: "Format de cours invalide." }, { status: 400 });
  }
  if (!isPackType(packType)) {
    return NextResponse.json({ error: "Formule de réservation invalide." }, { status: 400 });
  }
  const normalizedGroupType = isGroupType(groupType) ? groupType : "INDIVIDUAL";

  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
    },
  });
  if (!teacher || teacher.status !== "ACTIVE" || !teacher.photoUrl) {
    return NextResponse.json({ error: "Professeur introuvable ou inactif" }, { status: 404 });
  }
  const teacherSubject = teacher.subjects.find((item) => normalizeLabel(item.subject.name) === normalizeLabel(subjectName));
  const teacherLevel = teacher.levels.find((item) => normalizeLabel(item.level.name) === normalizeLabel(levelName));
  if (!teacherSubject) {
    return NextResponse.json({ error: "Ce professeur ne propose pas cette matière. Choisissez un autre profil compatible." }, { status: 400 });
  }
  if (!teacherLevel) {
    return NextResponse.json({ error: "Ce professeur ne prend pas ce niveau. Choisissez un autre profil compatible." }, { status: 400 });
  }
  const canonicalSubjectName = teacherSubject.subject.name;
  const canonicalLevelName = teacherLevel.level.name;
  const catalogCourse = courseCatalogId ? findCourseCatalogItem(courseCatalogId) : null;
  if (courseCatalogId && !catalogCourse) {
    return NextResponse.json({ error: "Cours catalogue invalide." }, { status: 400 });
  }
  const canonicalCourseCategory = resolveBookingCourseCategory({
    requestedCategory: courseCategory,
    levelName: canonicalLevelName,
    preciseLevel,
    subjectName: canonicalSubjectName,
    catalogItem: catalogCourse,
  }).category;
  const schoolSystemResolution = resolveCourseCatalogSchoolSystem({
    item: catalogCourse,
    requestedSchoolSystem: schoolSystem,
  });
  if (!schoolSystemResolution.ok) {
    return NextResponse.json({ error: schoolSystemResolution.error }, { status: 400 });
  }
  const canonicalSchoolSystem = schoolSystemResolution.schoolSystem;
  const bookingJourney = resolveTeacherJourney({
    courseCategory: canonicalCourseCategory,
    schoolSystem: canonicalSchoolSystem,
  });
  if (!bookingJourney || !teacherSupportsJourney(teacher, bookingJourney)) {
    return NextResponse.json({
      error: "Ce professeur ne propose pas ce parcours. Choisissez un autre profil compatible.",
    }, { status: 400 });
  }
  const subjectMatchesJourney = subjectNameMatchesJourney(canonicalSubjectName, bookingJourney);
  const levelMatchesJourney = filterLevelsForJourney([{
    name: canonicalLevelName,
    order: teacherLevel.level.order,
  }], bookingJourney).length === 1;
  if (!subjectMatchesJourney || !levelMatchesJourney) {
    return NextResponse.json({
      error: "La matière ou le niveau ne correspond pas au système choisi. Revenez au parcours sélectionné.",
    }, { status: 400 });
  }
  const educationValidation = validateEducationSelection({
    category: canonicalCourseCategory,
    levelName: canonicalLevelName,
    schoolSystem: canonicalSchoolSystem,
    preciseLevel,
  });
  if (!educationValidation.ok) {
    return NextResponse.json({ error: educationValidation.error }, { status: 400 });
  }
  if (catalogCourse && !isCourseCatalogItemCompatible({
    item: catalogCourse,
    category: canonicalCourseCategory,
    schoolSystem: canonicalSchoolSystem,
    preciseLevel,
    selectedLevel: canonicalLevelName,
    teacherLevels: teacher.levels.map((item) => item.level.name),
    teacherSubjects: teacher.subjects.map((item) => item.subject.name),
    selectedSubject: canonicalSubjectName,
  })) {
    return NextResponse.json({
      error: "Cette formation ne correspond pas aux matières, niveaux et parcours validés pour ce professeur. Choisissez un autre profil compatible.",
    }, { status: 400 });
  }
  const normalizedSchoolProgram = buildSchoolProgramSummary({
    clientType,
    category: canonicalCourseCategory,
    schoolSystem: canonicalSchoolSystem,
    preciseLevel,
    courseCatalogId,
    freeProgram: typeof schoolProgram === "string" ? schoolProgram.trim() : "",
  });
  const normalizedNeedDescription = typeof needDescription === "string" ? needDescription.trim() : "";
  if (requiresSpecificNeed(canonicalSubjectName) && normalizedNeedDescription.length < 12) {
    return NextResponse.json({
      error: "Précisez clairement la matière ou le besoin spécifique pour cette réservation.",
    }, { status: 400 });
  }
  if (courseFormat === "HOME" && !teacher.offersHome) {
    return NextResponse.json({ error: "Ce professeur ne propose pas les cours à domicile" }, { status: 400 });
  }
  if (courseFormat === "ONLINE" && !teacher.offersOnline) {
    return NextResponse.json({ error: "Ce professeur ne propose pas les cours en ligne" }, { status: 400 });
  }
  if (courseFormat === "HOME" && (!commune || !quartier || !addressHint)) {
    return NextResponse.json({
      error: "Pour un cours à domicile, indiquez la commune, le quartier et un repère/adresse précis.",
    }, { status: 400 });
  }

  const normalizedSelectedSlots = parseAvailabilitySelection(selectedTimeSlots);
  const customTimeRequest = typeof preferredTime === "string"
    ? preferredTime.split(";").find((part) => part.trim().toLowerCase().startsWith("demande client"))?.trim() ?? ""
    : "";
  const requestedPreferredDays = parsePreferredDays(preferredDays);
  if (normalizedSelectedSlots.length === 0 && !customTimeRequest) {
    return NextResponse.json({ error: "Sélectionnez un créneau disponible ou indiquez votre horaire souhaité." }, { status: 400 });
  }
  if (normalizedSelectedSlots.length === 0 && customTimeRequest && requestedPreferredDays.length === 0) {
    return NextResponse.json({ error: "Indiquez le jour souhaité pour votre demande horaire personnalisée." }, { status: 400 });
  }
  const teacherAvailability = parseAvailability(teacher.availability);
  const unavailable = unavailableSelections(teacherAvailability, normalizedSelectedSlots);
  if (unavailable.length > 0) {
    return NextResponse.json({
      error: `Créneau indisponible pour ce professeur : ${availabilitySelectionLabel(unavailable[0])}.`,
    }, { status: 400 });
  }

  if (normalizedGroupType === "SMALL_GROUP" && !teacher.offersGroup) {
    return NextResponse.json({ error: "Ce professeur ne propose pas les cours en petit groupe" }, { status: 400 });
  }
  if (normalizedGroupType === "INDIVIDUAL" && Number(participantsCount) > 1) {
    return NextResponse.json({ error: "Choisissez Petit groupe pour réserver avec plusieurs participants." }, { status: 400 });
  }
  const parsedParticipants = Number(participantsCount);
  if (normalizedGroupType === "SMALL_GROUP" && (!Number.isInteger(parsedParticipants) || parsedParticipants < 2 || parsedParticipants > 12)) {
    return NextResponse.json({ error: "Un petit groupe doit contenir entre 2 et 12 participants." }, { status: 400 });
  }
  const normalizedParticipants = normalizedGroupType === "SMALL_GROUP" ? parsedParticipants : 1;
  const parsedStartDate = parseDateInput(startDate);
  if (!parsedStartDate) {
    return NextResponse.json({ error: "Veuillez sélectionner la date souhaitée pour commencer les séances." }, { status: 400 });
  }
  if (parsedStartDate < startOfDay(new Date())) {
    return NextResponse.json({ error: "La date souhaitée ne peut pas être dans le passé. Choisissez aujourd'hui ou une date ultérieure." }, { status: 400 });
  }
  const requestedScheduleDays = Array.from(new Set([
    ...normalizedSelectedSlots.map((slot) => slot.split("|")[0]),
    ...requestedPreferredDays,
  ]));
  const startDateDayKey = dayKeyFromDate(parsedStartDate);
  if (requestedScheduleDays.length > 0 && !requestedScheduleDays.includes(startDateDayKey)) {
    return NextResponse.json({
      error: `La date souhaitée (${formatDateFr(parsedStartDate)}) ne correspond pas au jour du créneau sélectionné. Choisissez une date du même jour ou modifiez le créneau.`,
    }, { status: 400 });
  }
  const earliestCourseStartAt = getEarliestCourseStartDateTime({
    dateInput: parsedStartDate,
    selectedTimeSlots: normalizedSelectedSlots,
    customStartTime: typeof customStartTime === "string" ? customStartTime : null,
  });
  const minimumBookingDeadline = new Date(Date.now() + MIN_BOOKING_NOTICE_HOURS * 60 * 60 * 1000);
  if (!respectsMinimumBookingNotice(earliestCourseStartAt, new Date(), MIN_BOOKING_NOTICE_HOURS)) {
    return NextResponse.json({
      error: `La réservation doit être faite au moins ${MIN_BOOKING_NOTICE_HOURS}h avant le début du cours. Choisissez un créneau à partir du ${formatDateTimeFr(minimumBookingDeadline)}.`,
    }, { status: 400 });
  }
  const pricingCommuneNames = Array.from(new Set(
    [teacher.commune, typeof commune === "string" ? commune : null]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  ));
  const [platformSettings, clientLocation, grandAbidjanCommunes, neighborhoodAliasRows] = await Promise.all([
    getPlatformRuntimeSettings(),
    courseFormat === "HOME" && typeof commune === "string" && commune.trim()
      ? db.commune.findFirst({
          where: { name: { equals: commune.trim(), mode: "insensitive" }, isActive: true },
          select: { transportFeeOverride: true },
        })
      : null,
    db.commune.findMany({
      where: { transportClass: "GRAND_ABIDJAN", isActive: true },
      select: { name: true },
    }),
    courseFormat === "HOME" && pricingCommuneNames.length > 0
      ? db.communeQuarter.findMany({
          where: {
            isActive: true,
            commune: {
              isActive: true,
              OR: pricingCommuneNames.map((name) => ({
                name: { equals: name, mode: "insensitive" as const },
              })),
            },
          },
          select: {
            id: true,
            name: true,
            aliases: true,
            commune: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const appliedCommissionPercent = Number.isFinite(teacher.commissionRate)
    ? Math.max(0, Math.min(60, Math.round(teacher.commissionRate)))
    : platformSettings.commissionPercent;
  const pricing = calculateBookingPricing({
    category: canonicalCourseCategory,
    schoolSystem: canonicalSchoolSystem,
    levelName: canonicalLevelName,
    preciseLevel,
    subjectName: canonicalSubjectName,
    courseCatalogName: catalogCourse?.nom,
    objective,
    deliveryMode: courseFormat === "ONLINE" ? "en_ligne" : "domicile",
    requiresMaterial: false,
    packType,
    participantsCount: normalizedParticipants,
    teacherPricePerSession: teacher.pricePerSession,
    teacherCommune: courseFormat === "HOME" ? teacher.commune : undefined,
    teacherQuartier: courseFormat === "HOME" ? teacher.quartier : undefined,
    teacherZoneNames: courseFormat === "HOME" ? teacher.zones.map((zone) => zone.commune.name) : undefined,
    clientCommune: courseFormat === "HOME" ? commune : undefined,
    clientQuartier: courseFormat === "HOME" ? quartier : undefined,
    platformCommissionPercent: appliedCommissionPercent,
    transportFeeAmounts: platformSettings.transportFees,
    grandAbidjanCommuneNames: grandAbidjanCommunes.map((item) => item.name),
    clientCommuneTransportFeeOverride: clientLocation?.transportFeeOverride,
    neighborhoodAliases: buildNeighborhoodAliasMap(
      neighborhoodAliasRows.map((quarter) => ({
        id: quarter.id,
        communeId: quarter.commune.id,
        name: quarter.name,
        aliases: quarter.aliases,
        communeName: quarter.commune.name,
      })),
    ),
  });
  const canonicalConfirmablePricing = confirmablePricing(pricing);
  const canonicalPricingFingerprint = createPricingConfirmationFingerprint(
    canonicalConfirmablePricing,
    clientCreationKey,
  );
  const hasConfirmedCurrentServerPrice = typeof confirmedPricingFingerprint === "string"
    && confirmedPricingFingerprint === canonicalPricingFingerprint;
  if (!expectedPricingMatches(expectedPricing, canonicalConfirmablePricing) && !hasConfirmedCurrentServerPrice) {
    return NextResponse.json({
      code: "PRICE_CHANGED",
      error: "Le tarif a été recalculé. Vérifiez le nouveau détail puis confirmez-le avant d'ouvrir Jèko.",
      requiresPriceConfirmation: true,
      pricingFingerprint: canonicalPricingFingerprint,
      pricing: publicAuthoritativePricing(pricing),
    }, { status: 409 });
  }
  const basePrice = pricing.numberOfSessions ? pricing.unitSessionAmount * pricing.numberOfSessions : 0;
  const unitPrice = pricing.unitSessionAmount;
  const normalizedSessionsCount = pricing.numberOfSessions ?? 0;
  const totalPrice = pricing.totalClientPays;
  const averageSessionPrice = normalizedSessionsCount > 0 ? Math.round(pricing.courseAmount / normalizedSessionsCount) : 0;
  const extraParticipantCount = Math.max(0, normalizedParticipants - 1);
  const groupSurchargeAmount = Math.max(0, pricing.rawCourseAmount - basePrice);
  const packDiscountLine = pricing.discountAmount > 0
    ? ` - remise pack ${pricing.discountAmount.toLocaleString("fr-FR")} FCFA`
    : "";
  const groupPricingLine = normalizedGroupType === "SMALL_GROUP"
    ? `Petit groupe: ${normalizedParticipants} participants, base brute ${basePrice.toLocaleString("fr-FR")} FCFA + majoration groupe brute ${groupSurchargeAmount.toLocaleString("fr-FR")} FCFA (${extraParticipantCount} x 50 % de la base)${packDiscountLine} = ${pricing.courseAmount.toLocaleString("fr-FR")} FCFA hors déplacement.`
    : pricing.discountAmount > 0
      ? `Cours individuel: base brute ${basePrice.toLocaleString("fr-FR")} FCFA${packDiscountLine} = ${pricing.courseAmount.toLocaleString("fr-FR")} FCFA hors déplacement.`
      : `Cours individuel: ${pricing.courseAmount.toLocaleString("fr-FR")} FCFA hors déplacement.`;
  const paymentServiceLine = `Frais de service Compétence: ${pricing.paymentServiceFeeAmount.toLocaleString("fr-FR")} FCFA (${pricing.paymentServiceFeeLabel}).`;
  const sessionPricingLine = `Formule: ${normalizedSessionsCount} séance(s) de 2h, moyenne ${averageSessionPrice.toLocaleString("fr-FR")} FCFA/séance.`;
  const commissionRate = Math.round(pricing.platformCommissionRate * 100);
  const teacherRate = 100 - commissionRate;
  const commissionAmount = pricing.platformCommissionAmount;
  const teacherNetAmount = pricing.totalTeacherReceives;
  const teacherCoursePayoutAmount = pricing.teacherPayoutAmount;
  const normalizedPreferredDays = requestedScheduleDays;
  const normalizedPreferredTime = [
    ...normalizedSelectedSlots.map(availabilitySelectionLabel),
    ...(customTimeRequest ? [customTimeRequest] : []),
  ].join(" ; ");
  const initialScheduledTime = normalizedSelectedSlots.length > 0
    ? availabilitySelectionLabel(normalizedSelectedSlots[0])
    : customTimeRequest || null;
  const serializedPricingSnapshot = pricingSnapshotToJson(pricing);
  const bookingPaymentMethod: PaymentMethod = JEKO_PLATFORM_PAYMENT_METHODS[paymentMethod];
  const bookingPaymentProvider: PaymentProvider = "JEKO";
  const expectedDraftFields = {
    teacherId,
    subjectName: canonicalSubjectName,
    levelName: canonicalLevelName,
    objective: nullableTrimmedText(objective),
    clientType,
    courseCategory: canonicalCourseCategory,
    schoolSystem: canonicalSchoolSystem,
    preciseLevel: nullableTrimmedText(preciseLevel),
    courseCatalogId: catalogCourse?.id ?? null,
    courseCatalogName: catalogCourse?.nom ?? null,
    schoolProgram: normalizedSchoolProgram || null,
    needDescription: normalizedNeedDescription || null,
    courseFormat,
    groupType: normalizedGroupType,
    participantsCount: normalizedParticipants,
    commune: courseFormat === "HOME" ? nullableTrimmedText(commune) : null,
    quartier: courseFormat === "HOME" ? nullableTrimmedText(quartier) : null,
    addressHint: courseFormat === "HOME" ? nullableTrimmedText(addressHint) : null,
    onlineLink: courseFormat === "ONLINE" ? nullableTrimmedText(onlineLink) : null,
    preferredDays: JSON.stringify(normalizedPreferredDays),
    preferredTime: normalizedPreferredTime,
    startDate: parsedStartDate,
    scheduledDate: parsedStartDate,
    scheduledTime: initialScheduledTime,
    sessionsCount: normalizedSessionsCount,
    packType,
    message: nullableTrimmedText(message),
    unitPrice,
    totalPrice,
    priceTierKey: pricing.priceTierKey,
    courseAmount: pricing.courseAmount,
    commissionRate,
    commissionAmount,
    teacherRate,
    teacherPayoutAmount: teacherCoursePayoutAmount,
    transportFee: pricing.transportFee,
    transportFeeKey: pricing.transportFeeKey,
    materialFee: pricing.materialFee,
    discountAmount: pricing.discountAmount,
    paymentServiceFeeRate: pricing.paymentServiceFeeRate,
    paymentServiceFeeAmount: pricing.paymentServiceFeeAmount,
    paymentServiceFeeLabel: pricing.paymentServiceFeeLabel,
    totalClientPays: pricing.totalClientPays,
    totalTeacherReceives: pricing.totalTeacherReceives,
    isQuoteOnly: false,
    pricingSnapshot: serializedPricingSnapshot,
    teacherNetAmount,
    paymentMethod: bookingPaymentMethod,
    paymentProvider: bookingPaymentProvider,
  };

  const client = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });

  const clientName = client?.name ?? "Un client";
  const profName = teacher.professionalName || teacher.fullName;
  const scheduleLine = normalizedPreferredTime
    ? `Créneaux demandés: ${normalizedPreferredTime}.`
    : "Créneaux demandés: à confirmer avec le client.";
  const now = new Date();
  const partnerReferralLeadSource = rawPartnerReferralCode
    ? await getActivePartnerReferralLeadSource(rawPartnerReferralCode, now)
    : null;
  if (rawPartnerReferralCode && !partnerReferralLeadSource) {
    return NextResponse.json({ error: "Lien apporteur invalide, déjà utilisé ou expiré. Demandez un nouveau lien à l'apporteur." }, { status: 409 });
  }
  const startDateLine = `Date souhaitée: ${formatDateFr(parsedStartDate)}.`;
  const partnerReferralCreateData = buildPartnerReferralCreateData({
    booking: {
      id: "",
      clientId: userId,
      teacherId,
      courseAmount: pricing.courseAmount,
    },
    promoterName: partnerReferralLeadSource?.promoterName ?? rawPartnerReferralName,
    promoterPhone: partnerReferralLeadSource?.promoterPhone ?? rawPartnerReferralPhone,
    promotionCode: partnerReferralLeadSource?.code ?? rawPartnerReferralCode,
    now,
  });

  let booking = await db.booking.findUnique({ where: { clientCreationKey } });
  let bookingCreatedNow = false;
  if (booking && booking.clientId !== userId) {
    return NextResponse.json({ error: "Cette clé de création appartient à un autre compte." }, { status: 409 });
  }

  if (!booking) {
    try {
      booking = await db.$transaction(async (tx) => {
    const createdBooking = await tx.booking.create({
      data: {
        reference: generateReference("MP"),
        clientCreationKey,
        clientId: userId,
        ...expectedDraftFields,
        status: "PENDING_PAYMENT",
        paymentStatus: "FAILED",
        providerPaymentStatus: "PENDING",
      },
    });
    await tx.bookingSession.createMany({
      data: buildBookingSessionRows({
        bookingId: createdBooking.id,
        teacherId,
        sessionsCount: normalizedSessionsCount,
        startDate: parsedStartDate,
        selectedTimeSlots: normalizedSelectedSlots,
        fallbackTime: initialScheduledTime,
        courseAmount: pricing.courseAmount,
        commissionAmount,
        teacherPayoutAmount: teacherCoursePayoutAmount,
        transportFee: pricing.transportFee,
      }),
    });
    if (partnerReferralCreateData) {
      if (partnerReferralLeadSource) {
        const claimed = await claimPartnerReferralLeadInTransaction(tx, {
          leadId: partnerReferralLeadSource.id,
          bookingId: createdBooking.id,
          now,
        });
        if (!claimed) throw new Error("PARTNER_REFERRAL_LEAD_ALREADY_USED");
      }
      const createdReferral = await tx.partnerReferral.create({
        data: {
          ...partnerReferralCreateData,
          bookingId: createdBooking.id,
        },
      });
      if (partnerReferralLeadSource) {
        await attachPartnerReferralLeadReferralInTransaction(tx, {
          leadId: partnerReferralLeadSource.id,
          referralId: createdReferral.id,
        });
      }
    }
    await tx.notification.create({
      data: {
        userId,
        title: "Brouillon de réservation - paiement requis",
        message: `Votre brouillon de réservation pour le cours de ${canonicalSubjectName} avec ${profName} est créé, mais il n'est pas actif tant que Jèko n'a pas confirmé le paiement côté serveur. ${startDateLine} ${sessionPricingLine} ${groupPricingLine} Déplacement: ${pricing.transportFee.toLocaleString("fr-FR")} FCFA. ${paymentServiceLine} Total à payer: ${totalPrice.toLocaleString("fr-FR")} FCFA. Le paiement est finalisé sur la page sécurisée Jèko et validé uniquement après confirmation serveur.`,
        type: "PAYMENT_PENDING",
        recipientType: "CLIENT",
        recipientName: clientName,
        channel: "INTERNAL",
        status: "SENT",
        priority: "NORMAL",
        bookingId: createdBooking.id,
        teacherId,
        clientId: userId,
        sentAt: now,
        link: `/client/reservations/${createdBooking.id}`,
        actionLabel: "Voir réservation",
      },
    });
    await tx.teacher.update({
      where: { id: teacherId },
      data: { lastActivityAt: now },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: null,
        action: "Réservation client rattachée au professeur",
        entityType: "Teacher",
        entityId: teacherId,
        detail: `${clientName} a créé ${createdBooking.reference}. Paiement Jèko en attente. ${startDateLine} ${scheduleLine} ${sessionPricingLine} ${groupPricingLine} Total Jèko: ${totalPrice.toLocaleString("fr-FR")} FCFA. Net professeur prévu après paiement: ${teacherNetAmount.toLocaleString("fr-FR")} FCFA.`,
        oldStatus: "NO_BOOKING",
        newStatus: "JEKO_PAYMENT_PENDING",
      },
    });

        return createdBooking;
      });
      bookingCreatedNow = true;
    } catch (error) {
      if (error instanceof Error && error.message === "PARTNER_REFERRAL_LEAD_ALREADY_USED") {
        return NextResponse.json({ error: "Ce lien apporteur vient d'être utilisé. Demandez un nouveau lien à l'apporteur." }, { status: 409 });
      }
      if (!isUniqueConstraintError(error)) throw error;
      booking = await db.booking.findUnique({ where: { clientCreationKey } });
      if (!booking || booking.clientId !== userId) throw error;
    }
  }

  if (!booking) {
    return NextResponse.json({ error: "Impossible de retrouver le brouillon de réservation." }, { status: 500 });
  }

  if (!bookingDraftMatchesExpected(booking, expectedDraftFields)) {
    return NextResponse.json({
      error: "Ce brouillon a déjà été créé avec un autre calcul. Ouvrez-le depuis vos paiements ou rechargez la page pour créer un nouveau dossier.",
      bookingId: booking.id,
    }, { status: 409 });
  }

  let jeko: Awaited<ReturnType<typeof createJekoBookingCheckout>> | null = null;
  let paymentError: string | null = null;
  try {
    jeko = await createJekoBookingCheckout({
      bookingId: booking.id,
      // La méthode ne fait volontairement pas partie de la clé : deux clics
      // concurrents Wave/Orange doivent viser une seule demande, jamais deux débits.
      idempotencyKey: `BOOKING:${clientCreationKey}`,
      paymentMethod,
      expectedAmountXof: booking.totalClientPays > 0 ? booking.totalClientPays : booking.totalPrice,
      expectedPricingSnapshot: booking.pricingSnapshot,
      successUrl: absoluteAppUrl(`/client/reservations/${booking.id}?jeko=return`, req),
      errorUrl: absoluteAppUrl(`/client/reservations/${booking.id}?jeko=cancelled`, req),
    });
  } catch (error: unknown) {
    paymentError = error instanceof Error ? error.message : "Jèko est temporairement indisponible.";
    console.error("[booking:jeko_create_failed]", {
      bookingId: booking.id,
      bookingReference: booking.reference,
      reason: paymentError,
    });
  }

  return NextResponse.json({
    booking: publicBookingPayload({
      ...booking,
      teacher: {
        id: teacher.id,
        fullName: teacher.fullName,
        professionalName: teacher.professionalName,
        photoUrl: teacher.photoUrl,
        jobTitle: teacher.jobTitle,
        commune: teacher.commune,
        phone: teacher.phone,
      },
      reviews: [],
    }),
    payment: jeko
      ? {
          provider: "JEKO",
          configured: true,
          status: jeko.status,
          attemptId: jeko.attemptId,
          reference: jeko.reference,
          amount: jeko.amountXof,
          checkoutUrl: jeko.checkoutUrl,
          error: null,
        }
      : {
          provider: "JEKO",
          configured: false,
          status: "failed",
          checkoutUrl: null,
          error: paymentError,
        },
  }, { status: bookingCreatedNow ? 201 : 200 });
}

function nullableTrimmedText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "P2002";
}
