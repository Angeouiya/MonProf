import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { parseAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import { calculateGrandAbidjanTransportFee } from "@/lib/pricing";

const ACTIVE_BOOKING_STATUSES = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"] as const;
const RECENT_ISSUE_DAYS = 90;

function includesNormalized(values: string[], target?: string | null) {
  if (!target) return false;
  const normalizedTarget = target.trim().toLocaleLowerCase("fr-FR");
  return values.some((value) => typeof value === "string" && value.trim().toLocaleLowerCase("fr-FR") === normalizedTarget);
}

function parsePreferredDays(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function dayKeyFromLabel(value: string) {
  const normalized = value.trim().toLocaleLowerCase("fr-FR");
  const day = WEEK_DAYS.find((item) => item.key === normalized || item.label.toLocaleLowerCase("fr-FR") === normalized);
  return day?.key ?? "";
}

function dayKeyFromDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const indexToKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return indexToKey[parsed.getDay()] ?? "";
}

function slotKeyFromTime(value?: string | null) {
  if (!value) return "";
  const hourMatch = value.match(/(\d{1,2})(?:h|:)/i);
  if (!hourMatch) return "";
  const hour = Number(hourMatch[1]);
  if (!Number.isFinite(hour)) return "";
  return TWO_HOUR_SLOTS.find((slot) => {
    const [start, end] = slot.key.split("-").map(Number);
    return hour >= start && hour < end;
  })?.key ?? "";
}

function dateKey(value?: Date | string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function hasActiveConflict(teacherBookings: { status: string; scheduledDate: Date | null; scheduledTime: string | null; preferredTime: string | null }[], booking: { scheduledDate: Date | null; scheduledTime: string | null; preferredTime: string }) {
  const bookingDate = dateKey(booking.scheduledDate);
  const bookingTime = booking.scheduledTime || booking.preferredTime;
  if (!bookingDate || !bookingTime) return false;
  return teacherBookings.some((item) => (
    ACTIVE_BOOKING_STATUSES.includes(item.status as (typeof ACTIVE_BOOKING_STATUSES)[number]) &&
    dateKey(item.scheduledDate) === bookingDate &&
    Boolean((item.scheduledTime || item.preferredTime || "").trim()) &&
    (item.scheduledTime || item.preferredTime) === bookingTime
  ));
}

function isAvailabilityCompatible(rawAvailability: string | null, booking: { preferredDays: string; scheduledDate: Date | null; scheduledTime: string | null }) {
  const availability = parseAvailability(rawAvailability);
  const requestedDays = Array.from(new Set([
    ...parsePreferredDays(booking.preferredDays).map(dayKeyFromLabel),
    dayKeyFromDate(booking.scheduledDate),
  ].filter(Boolean)));
  if (requestedDays.length === 0) return true;

  const scheduledSlot = slotKeyFromTime(booking.scheduledTime);
  if (scheduledSlot) {
    return requestedDays.some((day) => Boolean(availability[day]?.[scheduledSlot]));
  }

  return requestedDays.some((day) => TWO_HOUR_SLOTS.some((slot) => Boolean(availability[day]?.[slot.key])));
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  if (!bookingId) return NextResponse.json({ error: "bookingId requis" }, { status: 400 });

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      teacher: true,
      client: { select: { name: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });

  const teachers = await db.teacher.findMany({
    where: {
      id: { not: booking.teacherId },
      status: "ACTIVE",
      AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }],
      ...(booking.courseFormat === "HOME" ? { offersHome: true } : { offersOnline: true }),
    },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
      warnings: { orderBy: { createdAt: "desc" }, take: 5 },
      sanctions: { orderBy: { createdAt: "desc" }, take: 5 },
      oldReplacements: { orderBy: { createdAt: "desc" }, take: 5 },
      bookings: {
        where: {
          OR: [
            { status: { in: [...ACTIVE_BOOKING_STATUSES] as any } },
            { disputes: { some: { createdAt: { gte: new Date(Date.now() - RECENT_ISSUE_DAYS * 24 * 60 * 60 * 1000) } } } },
          ],
        },
        select: {
          status: true,
          scheduledDate: true,
          scheduledTime: true,
          preferredTime: true,
          disputes: {
            where: { createdAt: { gte: new Date(Date.now() - RECENT_ISSUE_DAYS * 24 * 60 * 60 * 1000) } },
            select: { id: true },
          },
        },
        take: 30,
      },
      _count: { select: { bookings: true, reviews: true } },
    },
    take: 80,
  });

  const suggestions = teachers
    .map((teacher) => {
      const subjectNames = teacher.subjects.map((item) => item.subject.name);
      const levelNames = teacher.levels.map((item) => item.level.name);
      const zoneNames = teacher.zones
        .map((item) => item.commune?.name)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      const sameSubject = includesNormalized(subjectNames, booking.subjectName);
      const sameLevel = includesNormalized(levelNames, booking.levelName);
      const sameCommune = includesNormalized(zoneNames, booking.commune) || teacher.commune === booking.commune;
      const transport = booking.courseFormat === "HOME"
        ? calculateGrandAbidjanTransportFee({
            teacherCommune: teacher.commune,
            teacherZoneNames: zoneNames,
            clientCommune: booking.commune,
          })
        : null;
      const formatCompatible = booking.courseFormat === "HOME" ? teacher.offersHome : teacher.offersOnline;
      const availabilityCompatible = isAvailabilityCompatible(teacher.availability, booking);
      const activeConflict = hasActiveConflict(teacher.bookings, booking);
      const recentDisputeCount = teacher.bookings.reduce((sum, item) => sum + item.disputes.length, 0);
      const priceDiff = teacher.pricePerSession - booking.unitPrice;
      const priceCompatible = Math.abs(priceDiff) <= Math.max(2500, Math.round(booking.unitPrice * 0.25));
      const noRecentIssue = teacher.warnings.length === 0 && teacher.sanctions.length === 0 && recentDisputeCount === 0;
      const matchReasons = [
        sameSubject ? "Même matière" : "",
        sameLevel ? "Même niveau" : "",
        sameCommune ? "Même commune/zone" : "",
        formatCompatible ? "Format compatible" : "",
        availabilityCompatible ? "Disponibilité compatible" : "",
        priceCompatible ? "Tarif compatible" : "",
        teacher.qualityScore >= 75 ? "Bon score qualité" : "",
        noRecentIssue ? "Aucun incident récent" : "",
        !activeConflict ? "Aucun conflit actif évident" : "",
      ].filter(Boolean);
      const riskFlags = [
        !sameSubject ? "Matière différente" : "",
        !sameLevel ? "Niveau différent" : "",
        !sameCommune ? "Commune différente" : "",
        !availabilityCompatible ? "Disponibilité à vérifier" : "",
        activeConflict ? "Conflit de planning possible" : "",
        !priceCompatible ? "Écart tarifaire à valider" : "",
        recentDisputeCount > 0 ? "Litige récent" : "",
        teacher.warnings.length > 0 || teacher.sanctions.length > 0 ? "Historique récent à vérifier" : "",
        transport?.isQuoteOnly ? "Déplacement sur devis" : "",
      ].filter(Boolean);
      const rawScore = [
        sameSubject ? 30 : 0,
        sameLevel ? 20 : 0,
        sameCommune ? 15 : 0,
        formatCompatible ? 10 : 0,
        availabilityCompatible ? 10 : -20,
        priceCompatible ? 10 : 0,
        Math.min(10, Math.round((teacher.qualityScore || 0) / 10)),
        teacher.rating >= 4.5 ? 5 : teacher.rating >= 4 ? 3 : 0,
        noRecentIssue ? 5 : 0,
        activeConflict ? -25 : 0,
        recentDisputeCount > 0 ? -20 : 0,
      ].reduce((sum, value) => sum + value, 0);
      const score = Math.max(0, Math.min(100, rawScore));

      const teacherCourseShare = booking.teacherPayoutAmount || Math.max(0, booking.teacherNetAmount - booking.transportFee);
      const transportFee = transport?.amount ?? 0;
      const netAmount = teacherCourseShare + transportFee;
      return {
        id: teacher.id,
        fullName: teacher.fullName,
        professionalName: teacher.professionalName,
        jobTitle: teacher.jobTitle,
        photoUrl: teacher.photoUrl,
        commune: teacher.commune,
        quartier: teacher.quartier,
        rating: teacher.rating,
        ratingCount: teacher.ratingCount,
        qualityScore: teacher.qualityScore,
        pricePerSession: teacher.pricePerSession,
        commissionRate: booking.commissionRate,
        teacherCourseShare,
        transportFee,
        transportRouteLabel: transport?.routeLabel ?? null,
        transportRuleLabel: transport?.ruleLabel ?? null,
        netAmount,
        financialImpact: netAmount - booking.teacherNetAmount,
        subjects: subjectNames,
        levels: levelNames,
        zones: zoneNames,
        badges: {
          verified: teacher.badgeVerified,
          recommended: teacher.badgeRecommended,
          premium: teacher.badgePremium,
        },
        matchReasons,
        riskFlags,
        compatibility: {
          score,
          sameSubject,
          sameLevel,
          sameCommune,
          formatCompatible,
          availabilityCompatible,
          priceCompatible,
          noRecentIssue,
          activeConflict,
          recentDisputeCount,
          transportQuoteOnly: transport?.isQuoteOnly ?? false,
          bookingsCount: teacher._count.bookings,
          reviewsCount: teacher._count.reviews,
        },
      };
    })
    .filter((teacher) => (
      teacher.compatibility.sameSubject &&
      teacher.compatibility.sameLevel &&
      teacher.compatibility.formatCompatible &&
      teacher.compatibility.availabilityCompatible &&
      !teacher.compatibility.activeConflict &&
      teacher.compatibility.recentDisputeCount === 0 &&
      !teacher.compatibility.transportQuoteOnly &&
      teacher.photoUrl
    ))
    .sort((a, b) => b.compatibility.score - a.compatibility.score || b.qualityScore - a.qualityScore || b.rating - a.rating)
    .slice(0, 12);

  return NextResponse.json({
    booking: {
      id: booking.id,
      reference: booking.reference,
      subjectName: booking.subjectName,
      levelName: booking.levelName,
      courseFormat: booking.courseFormat,
      commune: booking.commune,
      unitPrice: booking.unitPrice,
      totalPrice: booking.totalPrice,
      currentTeacherNetAmount: booking.teacherNetAmount,
      currentTeacher: {
        id: booking.teacher.id,
        name: booking.teacher.professionalName || booking.teacher.fullName,
        photoUrl: booking.teacher.photoUrl,
      },
    },
    items: suggestions,
  });
}
