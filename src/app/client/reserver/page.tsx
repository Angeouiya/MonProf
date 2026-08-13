import { db } from "@/lib/db";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import { notFound, redirect } from "next/navigation";
import { ReserverForm } from "./reserver-form";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import {
  parseTeacherJourney,
} from "@/lib/teacher-journeys";
import { teacherCatalogEligibleJourneys } from "@/lib/teacher-journey-validation";
import { getActivePartnerReferralLeadSource } from "@/lib/partner-referrals";
import { verifiedClientPaymentBookingWhere } from "@/lib/payment-security";
import {
  SCHEDULE_BLOCKING_BOOKING_STATUSES,
  SCHEDULE_BLOCKING_PAYMENT_STATUSES,
  SCHEDULE_BLOCKING_SESSION_STATUSES,
} from "@/lib/teacher-schedule-conflicts";

export const dynamic = "force-dynamic";

export default async function ReserverPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string; journey?: string; ref?: string; partnerRef?: string }>;
}) {
  const { teacherId, journey: requestedJourney, ref, partnerRef } = await searchParams;
  if (!teacherId) redirect("/client/rechercher");
  const initialJourney = parseTeacherJourney(requestedJourney) ?? undefined;

  const teacher = await db.teacher.findFirst({
    where: { id: teacherId, status: "ACTIVE", AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
    },
  });
  if (!teacher) notFound();
  const teacherCatalogSubjects = teacher.subjects.map((item) => ({
    name: item.subject.name,
    icon: item.subject.icon,
  }));
  const teacherCatalogLevels = teacher.levels.map((item) => ({
    name: item.level.name,
    order: item.level.order,
  }));
  const eligibleJourneys = teacherCatalogEligibleJourneys({
    eligibility: teacher,
    subjects: teacherCatalogSubjects,
    levels: teacherCatalogLevels,
  });
  if (eligibleJourneys.length === 0) notFound();
  if (initialJourney && !eligibleJourneys.includes(initialJourney)) notFound();

  const [{ communes }, platformSettings, partnerReferral, occupiedSlots] = await Promise.all([
    getCachedTeacherSearchCatalog(),
    getPlatformRuntimeSettings(),
    getActivePartnerReferralLeadSource(ref || partnerRef),
    getTeacherOccupiedSlots(teacher.id),
  ]);

  const teacherSubjects = teacher.subjects.map((s) => ({
    id: s.subject.id,
    name: s.subject.name,
    slug: s.subject.slug,
    isPrimary: s.isPrimary,
  }));
  const teacherLevels = teacher.levels.map((l) => ({ id: l.level.id, name: l.level.name, slug: l.level.slug }));
  const teacherZones = teacher.zones.map((zone) => zone.commune.name);

  return (
    <div>
      <ReserverForm
        initialJourney={initialJourney}
        eligibleJourneys={eligibleJourneys}
        teacher={{
          id: teacher.id,
          fullName: teacher.fullName,
          professionalName: teacher.professionalName,
          photoUrl: teacher.photoUrl,
          jobTitle: teacher.jobTitle,
          commune: teacher.commune,
          quartier: teacher.quartier,
          rating: teacher.rating,
          ratingCount: teacher.ratingCount,
          pricePerSession: teacher.pricePerSession,
          commissionRate: teacher.commissionRate,
          badgeVerified: teacher.badgeVerified,
          badgeRecommended: teacher.badgeRecommended,
          badgePremium: teacher.badgePremium,
          badgePopular: teacher.badgePopular,
          badgeNew: teacher.badgeNew,
          offersHome: teacher.offersHome,
          offersOnline: teacher.offersOnline,
          offersGroup: teacher.offersGroup,
          availability: teacher.availability,
          zones: teacherZones,
          subjects: teacherSubjects,
          levels: teacherLevels.map((level) => level.name),
        }}
        subjects={teacherSubjects.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        levels={teacherLevels.map((l) => ({ id: l.id, name: l.name, slug: l.slug }))}
        communes={communes}
        pricingConfig={{
          commissionPercent: teacher.commissionRate,
          transportFees: platformSettings.transportFees,
        }}
        initialPartnerReferral={partnerReferral ? {
          code: partnerReferral.code,
          promoterName: partnerReferral.promoterName,
          promoterPhone: partnerReferral.promoterPhone ?? "",
        } : undefined}
        occupiedSlots={occupiedSlots}
      />
    </div>
  );
}

async function getTeacherOccupiedSlots(teacherId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 370);
  const blockingBookingWhere = verifiedClientPaymentBookingWhere({
    status: { in: [...SCHEDULE_BLOCKING_BOOKING_STATUSES] },
    paymentStatus: { in: [...SCHEDULE_BLOCKING_PAYMENT_STATUSES] },
  });

  const [sessions, legacyBookings] = await Promise.all([
    db.bookingSession.findMany({
      where: {
        teacherId,
        scheduledDate: { gte: today, lt: horizon },
        scheduledTime: { not: null },
        status: { in: [...SCHEDULE_BLOCKING_SESSION_STATUSES] },
        booking: blockingBookingWhere,
      },
      select: {
        sequence: true,
        scheduledDate: true,
        scheduledTime: true,
        durationMinutes: true,
        booking: { select: { reference: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { sequence: "asc" }],
      take: 500,
    }),
    db.booking.findMany({
      where: {
        teacherId,
        sessions: { none: {} },
        scheduledDate: { gte: today, lt: horizon },
        ...blockingBookingWhere,
      },
      select: {
        reference: true,
        scheduledDate: true,
        scheduledTime: true,
        preferredTime: true,
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      take: 250,
    }),
  ]);

  return [
    ...sessions
      .filter((session) => session.scheduledDate && session.scheduledTime)
      .map((session) => ({
        date: toIsoDateKey(session.scheduledDate!),
        time: session.scheduledTime!,
        durationMinutes: session.durationMinutes,
        bookingReference: session.booking.reference,
        sequence: session.sequence,
      })),
    ...legacyBookings
      .filter((booking) => booking.scheduledDate && (booking.scheduledTime || booking.preferredTime))
      .map((booking) => ({
        date: toIsoDateKey(booking.scheduledDate!),
        time: (booking.scheduledTime || booking.preferredTime)!,
        durationMinutes: 120,
        bookingReference: booking.reference,
        sequence: null,
      })),
  ];
}

function toIsoDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
