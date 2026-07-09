import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateReference } from "@/lib/format";
import { PackType, CourseFormat, GroupType } from "@prisma/client";
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
  PLATFORM_COMMISSION_PERCENT,
  TEACHER_PERCENT,
  calculateBookingPricing,
  parsePricingSnapshot,
  pricingSnapshotToJson,
} from "@/lib/pricing";
import {
  CLIENT_TYPES,
  COURSE_CATEGORIES,
  buildSchoolProgramSummary,
  findCourseCatalogItem,
  validateEducationSelection,
} from "@/lib/course-catalog";
import { createPayDunyaCheckoutInvoice, getPayDunyaPublicBaseUrl } from "@/lib/paydunya";

const COURSE_FORMATS: CourseFormat[] = ["HOME", "ONLINE"];
const GROUP_TYPES: GroupType[] = ["INDIVIDUAL", "SMALL_GROUP"];
const PACK_TYPES: PackType[] = ["SINGLE", "PACK_4", "PACK_8", "PACK_12", "EXAM_PREP", "CUSTOM"];

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
    createdAt: b.createdAt,
    confirmedAt: b.confirmedAt,
    courseDoneAt: b.courseDoneAt,
    clientValidatedAt: b.clientValidatedAt,
    teacherPaidAt: b.teacherPaidAt,
    teacher: b.teacher,
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
  } = body;

  if (!teacherId || !subjectName || !levelName || !courseFormat || !packType || !clientType || !courseCategory) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
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
    return NextResponse.json({ error: "Cette matière n'est pas enseignée par ce professeur" }, { status: 400 });
  }
  if (!teacherLevel) {
    return NextResponse.json({ error: "Ce niveau n'est pas enseigné par ce professeur" }, { status: 400 });
  }
  const canonicalSubjectName = teacherSubject.subject.name;
  const canonicalLevelName = teacherLevel.level.name;
  const educationValidation = validateEducationSelection({
    levelName: canonicalLevelName,
    schoolSystem,
    preciseLevel,
  });
  if (!educationValidation.ok) {
    return NextResponse.json({ error: educationValidation.error }, { status: 400 });
  }
  const catalogCourse = courseCatalogId ? findCourseCatalogItem(courseCatalogId) : null;
  if (courseCatalogId && !catalogCourse) {
    return NextResponse.json({ error: "Cours catalogue invalide." }, { status: 400 });
  }
  if (catalogCourse && catalogCourse.categorie !== courseCategory) {
    return NextResponse.json({ error: "Le cours catalogue ne correspond pas à la catégorie choisie." }, { status: 400 });
  }
  const normalizedSchoolProgram = buildSchoolProgramSummary({
    clientType,
    category: courseCategory,
    schoolSystem,
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
  const pricing = calculateBookingPricing({
    category: courseCategory,
    schoolSystem,
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
    teacherZoneNames: courseFormat === "HOME" ? teacher.zones.map((zone) => zone.commune.name) : undefined,
    clientCommune: courseFormat === "HOME" ? commune : undefined,
  });
  const basePrice = pricing.numberOfSessions ? pricing.unitSessionAmount * pricing.numberOfSessions : 0;
  const unitPrice = pricing.unitSessionAmount;
  const normalizedSessionsCount = pricing.numberOfSessions ?? 0;
  const totalPrice = pricing.totalClientPays;
  const averageSessionPrice = normalizedSessionsCount > 0 ? Math.round(pricing.courseAmount / normalizedSessionsCount) : 0;
  const extraParticipantCount = Math.max(0, normalizedParticipants - 1);
  const groupSurchargeAmount = Math.max(0, pricing.rawCourseAmount - basePrice);
  const groupPricingLine = pricing.isQuoteOnly
    ? "Tarif à finaliser: validation du service client requise."
    : normalizedGroupType === "SMALL_GROUP"
      ? `Petit groupe: ${normalizedParticipants} participants, base ${basePrice.toLocaleString("fr-FR")} FCFA + ${extraParticipantCount} x 50% = ${pricing.courseAmount.toLocaleString("fr-FR")} FCFA hors déplacement.`
      : `Cours individuel: ${pricing.courseAmount.toLocaleString("fr-FR")} FCFA hors déplacement.`;
  const transportLine = courseFormat === "HOME"
    ? pricing.isQuoteOnly
      ? `Déplacement: ${pricing.transportRouteLabel ?? "trajet à confirmer"} - contrôle service client requis.`
      : `Déplacement: ${pricing.transportRouteLabel ?? "Côte d'Ivoire"} - ${pricing.transportFee.toLocaleString("fr-FR")} FCFA (${pricing.transportRuleLabel ?? "règle de déplacement"}).`
    : "Déplacement: aucun frais pour le cours en ligne.";
  const paymentServiceLine = pricing.isQuoteOnly
    ? "Frais de service paiement: calculés après validation du devis."
    : `Frais de service paiement: ${pricing.paymentServiceFeeAmount.toLocaleString("fr-FR")} FCFA (${pricing.paymentServiceFeeLabel}).`;
  const sessionPricingLine = pricing.isQuoteOnly
    ? `Formule: ${pricing.packLabel}, nombre de séances à confirmer.`
    : `Formule: ${normalizedSessionsCount} séance(s) de 2h, moyenne ${averageSessionPrice.toLocaleString("fr-FR")} FCFA/séance.`;
  const commissionRate = PLATFORM_COMMISSION_PERCENT;
  const commissionAmount = pricing.platformCommissionAmount;
  const teacherNetAmount = pricing.totalTeacherReceives;
  const teacherCoursePayoutAmount = pricing.teacherPayoutAmount;
  const normalizedPreferredDays = requestedScheduleDays;
  const normalizedPreferredTime = [
    ...normalizedSelectedSlots.map(availabilitySelectionLabel),
    ...(customTimeRequest ? [customTimeRequest] : []),
  ].join(" ; ");

  const client = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });

  const clientName = client?.name ?? "Un client";
  const profName = teacher.professionalName || teacher.fullName;
  const daysStr = normalizedPreferredDays.join(", ");
  const needLine = normalizedNeedDescription ? ` Besoin: ${normalizedNeedDescription.replace(/\s+/g, " ").slice(0, 220)}.` : "";
  const scheduleLine = normalizedPreferredTime
    ? `Créneaux demandés: ${normalizedPreferredTime}.`
    : "Créneaux demandés: à confirmer avec le client.";
  const now = new Date();
  const startDateLine = `Date souhaitée: ${formatDateFr(parsedStartDate)}.`;

  const booking = await db.$transaction(async (tx) => {
    const createdBooking = await tx.booking.create({
      data: {
        reference: generateReference("MP"),
        clientId: userId,
        teacherId,
        subjectName: canonicalSubjectName,
        levelName: canonicalLevelName,
        objective: objective || null,
        clientType,
        courseCategory,
        schoolSystem: typeof schoolSystem === "string" && schoolSystem ? schoolSystem : null,
        preciseLevel: typeof preciseLevel === "string" && preciseLevel ? preciseLevel : null,
        courseCatalogId: catalogCourse?.id ?? null,
        courseCatalogName: catalogCourse?.nom ?? null,
        schoolProgram: normalizedSchoolProgram || null,
        needDescription: normalizedNeedDescription || null,
        courseFormat,
        groupType: normalizedGroupType,
        participantsCount: normalizedParticipants,
        commune: courseFormat === "HOME" ? (commune || null) : null,
        quartier: courseFormat === "HOME" ? (quartier || null) : null,
        addressHint: courseFormat === "HOME" ? (addressHint || null) : null,
        onlineLink: courseFormat === "ONLINE" ? (onlineLink || null) : null,
        preferredDays: JSON.stringify(normalizedPreferredDays),
        preferredTime: normalizedPreferredTime,
        startDate: parsedStartDate,
        scheduledDate: parsedStartDate,
        sessionsCount: normalizedSessionsCount,
        packType,
        message: message || null,
        unitPrice,
        totalPrice,
        priceTierKey: pricing.priceTierKey,
        courseAmount: pricing.courseAmount,
        commissionRate,
        commissionAmount,
        teacherRate: TEACHER_PERCENT,
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
        isQuoteOnly: pricing.isQuoteOnly,
        pricingSnapshot: pricingSnapshotToJson(pricing),
        teacherNetAmount,
        status: pricing.isQuoteOnly ? "PENDING_ADMIN_VALIDATION" : "PENDING_PAYMENT",
        paymentStatus: "FAILED",
        paymentMethod: null,
      },
    });
    if (pricing.isQuoteOnly) {
      await tx.notification.create({
        data: {
          userId: null,
          title: "Nouvelle demande de devis",
          message: `${clientName} demande un devis pour ${profName} sur ${canonicalSubjectName} ${canonicalLevelName}${daysStr ? `, ${daysStr}` : ""}. ${startDateLine} ${scheduleLine} ${sessionPricingLine} ${groupPricingLine} ${transportLine}${needLine} Réservation rattachée au professeur ${profName}. Action requise : chiffrer le prix du cours et le déplacement si nécessaire. Le matériel reste à la charge de l'apprenant et n'est pas facturé par Compétence.`,
          type: "NEW_BOOKING",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "URGENT",
          bookingId: createdBooking.id,
          teacherId,
          clientId: userId,
          sentAt: now,
          link: `/admin/professeurs/${teacherId}?tab=cours&bookingId=${createdBooking.id}`,
          actionLabel: "Ouvrir la fiche professeur",
        },
      });
    }
    await tx.notification.create({
      data: {
        userId,
        title: pricing.isQuoteOnly ? "Demande enregistrée" : "Brouillon de réservation - paiement requis",
        message: pricing.isQuoteOnly
          ? `Votre demande pour le cours de ${canonicalSubjectName} avec ${profName} est enregistrée. ${startDateLine} Le service client vous proposera un devis clair avant tout paiement.`
          : `Votre brouillon de réservation pour le cours de ${canonicalSubjectName} avec ${profName} est créé, mais il n'est pas actif tant que PayDunya n'a pas confirmé le paiement côté serveur. ${startDateLine} ${sessionPricingLine} ${normalizedGroupType === "SMALL_GROUP" ? `Petit groupe: ${normalizedParticipants} participants, majoration ${groupSurchargeAmount.toLocaleString("fr-FR")} FCFA.` : "Cours individuel."} Prix cours: ${pricing.courseAmount.toLocaleString("fr-FR")} FCFA. Déplacement: ${pricing.transportFee.toLocaleString("fr-FR")} FCFA. ${paymentServiceLine} Total à payer: ${totalPrice.toLocaleString("fr-FR")} FCFA. PayDunya affichera Wave, Orange Money, MTN Money ou Moov Money sur sa page sécurisée. Aucun numéro n'est saisi sur Compétence.`,
        type: pricing.isQuoteOnly ? "QUOTE_REQUESTED" : "PAYMENT_PENDING",
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
        detail: pricing.isQuoteOnly
          ? `${clientName} a créé ${createdBooking.reference}. Prix à finaliser pour ${profName}. ${startDateLine} ${scheduleLine} ${sessionPricingLine} ${groupPricingLine}`
          : `${clientName} a créé ${createdBooking.reference}. Paiement PayDunya en attente. ${startDateLine} ${scheduleLine} ${sessionPricingLine} ${groupPricingLine} Total PayDunya: ${totalPrice.toLocaleString("fr-FR")} FCFA. Net professeur prévu après paiement: ${teacherNetAmount.toLocaleString("fr-FR")} FCFA.`,
        oldStatus: "NO_BOOKING",
        newStatus: pricing.isQuoteOnly ? "QUOTE_REQUESTED" : "PAYDUNYA_PAYMENT_PENDING",
      },
    });

    return createdBooking;
  });

  let paydunya: {
    configured: boolean;
    checkoutUrl: string | null;
    token: string | null;
    responseText?: string;
    raw?: Record<string, unknown>;
    error?: string;
  } | null = null;
  if (!booking.isQuoteOnly) {
    try {
      paydunya = await createPayDunyaCheckoutInvoice({
        origin: getPayDunyaPublicBaseUrl(req),
        booking: {
          id: booking.id,
          reference: booking.reference,
          subjectName: booking.subjectName,
          levelName: booking.levelName,
          sessionsCount: booking.sessionsCount,
          totalClientPays: booking.totalClientPays,
          courseAmount: booking.courseAmount,
          transportFee: booking.transportFee,
          paymentServiceFeeAmount: booking.paymentServiceFeeAmount,
          paymentServiceFeeLabel: booking.paymentServiceFeeLabel,
        },
        client: {
          id: userId,
          name: clientName,
          email: client?.email,
          phone: client?.phone,
        },
        teacher: {
          id: teacher.id,
          name: profName,
        },
      });
      await db.booking.update({
        where: { id: booking.id },
        data: {
          paydunyaToken: paydunya.token,
          paydunyaCheckoutUrl: paydunya.checkoutUrl,
          paydunyaStatus: paydunya.configured ? "PENDING" : "NOT_CONFIGURED",
          paydunyaFailureReason: paydunya.configured ? null : "PayDunya n'est pas configuré.",
          paydunyaLastCheckedAt: new Date(),
          paydunyaLastPayload: compactPayDunyaCreatePayload(paydunya.raw ?? paydunya.responseText),
        },
      });
    } catch (error: any) {
      const errorMessage = error?.message || "PayDunya indisponible.";
      console.error("[booking:paydunya_create_failed]", {
        bookingId: booking.id,
        bookingReference: booking.reference,
        reason: errorMessage,
      });
      paydunya = {
        configured: true,
        checkoutUrl: null,
        token: null,
        error: errorMessage,
      };
      await db.booking.update({
        where: { id: booking.id },
        data: {
          paydunyaStatus: "CREATE_FAILED",
          paydunyaFailureReason: errorMessage,
          paydunyaLastCheckedAt: new Date(),
          paydunyaLastPayload: errorMessage,
        },
      });
    }
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
    payment: paydunya
      ? {
          provider: "PAYDUNYA",
          configured: paydunya.configured,
          checkoutUrl: paydunya.checkoutUrl,
          error: paydunya.error,
        }
      : null,
  }, { status: 201 });
}

function compactPayDunyaCreatePayload(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.stringify(value).slice(0, 2000);
  } catch {
    return String(value).slice(0, 2000);
  }
}
