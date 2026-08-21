import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Home as HomeIcon,
  MapPin,
  ShieldCheck,
  Video,
  Wallet,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { JourneySwitcher } from "@/components/shared/journey-switcher";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ProfessorTrustBadges } from "@/components/shared/professor-trust-badges";
import { TeacherMiniCv } from "@/components/shared/teacher-mini-cv";
import { TeacherProfileLink } from "@/components/shared/teacher-profile-link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";
import {
  parseTeacherJourney,
  teacherJourneyWhere,
  TEACHER_JOURNEY_CONFIG,
} from "@/lib/teacher-journeys";
import { filterLevelsForJourney, filterSubjectsForJourney } from "@/lib/catalog-journey";
import { resolveTeacherCover } from "@/lib/teacher-cover";
import { teacherJourneyPriceLabel } from "@/lib/teacher-profile-pricing";
import { hasTeacherCvContent } from "@/lib/teacher-profile";
import { teacherCatalogEligibleJourneys } from "@/lib/teacher-journey-validation";
import { normalizePartnerReferralCode } from "@/lib/partner-referrals";
import { teacherPublicProfilePath, teacherPublicSharePath } from "@/lib/teacher-public-link";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const teacher = await db.teacher.findFirst({
    where: {
      id,
      status: "ACTIVE",
      AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }],
    },
    select: {
      id: true,
      fullName: true,
      professionalName: true,
      jobTitle: true,
      photoUrl: true,
      coverUrl: true,
    },
  });

  if (!teacher) {
    return {
      title: "Profil professeur | Compétence.CI",
      description: "Découvrez les professeurs vérifiés disponibles sur Compétence.CI.",
    };
  }

  const teacherName = teacher.professionalName || teacher.fullName;
  const description = `${teacherName}, ${teacher.jobTitle}. Découvrez son profil vérifié et réservez votre cours sur Compétence.CI.`;
  const socialImage = teacher.photoUrl || resolveTeacherCover({ teacherId: teacher.id, coverUrl: teacher.coverUrl }).url;

  return {
    title: `${teacherName} | Professeur Compétence.CI`,
    description,
    alternates: { canonical: teacherPublicProfilePath(teacher.id) },
    openGraph: {
      type: "profile",
      title: `${teacherName} sur Compétence.CI`,
      description,
      url: teacherPublicSharePath(teacher.id),
      siteName: "Compétence.CI",
      images: [{ url: socialImage, alt: `Profil de ${teacherName}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${teacherName} sur Compétence.CI`,
      description,
      images: [socialImage],
    },
  };
}

export default async function TeacherDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ journey?: string; ref?: string; partnerRef?: string }>;
}) {
  const { id } = await params;
  const { journey: requestedJourney, ref, partnerRef } = await searchParams;
  const journey = parseTeacherJourney(requestedJourney) ?? "";
  const referralCode = normalizePartnerReferralCode(ref || partnerRef);
  const [session, teacher] = await Promise.all([
    getServerSession(authOptions),
    db.teacher.findFirst({
    where: {
      id,
      status: "ACTIVE",
      ...(journey ? teacherJourneyWhere(journey) : {}),
      AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }],
    },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true }, orderBy: { level: { order: "asc" } } },
      zones: { include: { commune: true } },
      reviews: {
        where: { published: true },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { reviews: true, bookings: true } },
    },
    }),
  ]);

  if (!teacher) {
    notFound();
  }

  const displayName = teacher.professionalName || teacher.fullName;
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
  if (eligibleJourneys.length === 0 || (journey && !eligibleJourneys.includes(journey))) {
    notFound();
  }
  const activeJourney = journey || eligibleJourneys[0]!;
  const journeyConfig = TEACHER_JOURNEY_CONFIG[activeJourney];
  const journeySubjects = filterSubjectsForJourney(teacher.subjects.map((item) => ({
    ...item,
    name: item.subject.name,
    icon: item.subject.icon,
  })), activeJourney);
  const journeyLevels = filterLevelsForJourney(teacher.levels.map((item) => ({
    ...item,
    name: item.level.name,
    order: item.level.order,
  })), activeJourney);
  if (journey && (journeySubjects.length === 0 || journeyLevels.length === 0)) {
    notFound();
  }
  const primarySubject =
    journeySubjects.find((item) => item.isPrimary)?.subject.name ??
    journeySubjects[0]?.subject.name ??
    (activeJourney === "professionnel" ? "Compétence professionnelle" : "Accompagnement scolaire");

  const availability = parseAvailability(teacher.availability);
  const ratingBuckets = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: teacher.reviews.filter((review) => review.rating === rating).length,
  }));

  const totalReviews = teacher.reviews.length || teacher.ratingCount;
  const displayRating = totalReviews > 0
    ? teacher.rating
    : teacher.adminRatingPublic && teacher.adminRating > 0
      ? teacher.adminRating
      : teacher.rating;
  const displayRatingLabel = totalReviews > 0 ? "Avis" : "Note service client";
  const availableSlotCount = WEEK_DAYS.reduce(
    (total, day) => total + TWO_HOUR_SLOTS.filter((slot) => availability?.[day.key]?.[slot.key]).length,
    0,
  );
  const availableDayCount = WEEK_DAYS.filter((day) =>
    TWO_HOUR_SLOTS.some((slot) => availability?.[day.key]?.[slot.key]),
  ).length;
  const availabilitySummary = availableSlotCount > 0
    ? `${availableDayCount} jour${availableDayCount > 1 ? "s" : ""} · ${availableSlotCount} créneau${availableSlotCount > 1 ? "x" : ""} de 2h`
    : "Disponibilités à confirmer";
  const subjectsPreview = journeySubjects.slice(0, 4).map((item) => item.subject.name).join(", ");
  const levelsPreview = journeyLevels.slice(0, 5).map((item) => item.level.name).join(", ");
  const zonesPreview = teacher.zones.slice(0, 4).map((z) => z.commune.name).join(", ");
  const sessionPriceLabel = teacherJourneyPriceLabel(
    activeJourney,
    journeyLevels.map((item) => item.level.name),
  );
  const resolvedCover = resolveTeacherCover({ teacherId: teacher.id, coverUrl: teacher.coverUrl });
  const canBookActiveJourney = journeySubjects.length > 0 && journeyLevels.length > 0;
  const formatLabel = teacher.offersHome && teacher.offersOnline
    ? "Domicile ou en ligne"
    : teacher.offersHome
      ? "Cours à domicile"
      : "Cours en ligne";
  const hasProfessionalDossier = hasTeacherCvContent({
    careerSummary: teacher.careerSummary,
    skills: teacher.skills,
    workHistory: teacher.workHistory,
    certifications: teacher.certifications,
    teachingAchievements: teacher.teachingAchievements,
    diploma: teacher.diploma,
    experienceYears: teacher.experienceYears,
    learnersCoached: teacher.learnersCoached,
  });
  const profileBio = teacher.bio?.trim() || `${displayName} accompagne les apprenants avec un suivi encadré par Compétence.`;
  const compactBio = compactTeacherBio(profileBio);
  const hasLongBio = compactBio !== profileBio;

  const teachersHref = buildTeachersHref(activeJourney, referralCode);
  let bookingDestination = `/client/reserver?teacherId=${teacher.id}&journey=${activeJourney}`;
  if (referralCode) bookingDestination = `${bookingDestination}&ref=${encodeURIComponent(referralCode)}`;
  const reserveHref = session?.user
    ? bookingDestination
    : `/connexion?from=${encodeURIComponent(bookingDestination)}`;
  const journeyHrefs = Object.fromEntries(
    eligibleJourneys.map((value) => [value, buildTeacherJourneyHref(teacher.id, value, referralCode)]),
  );

  const tariffsHref = `/tarifs?journey=${activeJourney}`;

  return (
    <PublicLayout backFallbackHref={teachersHref} activeJourney={activeJourney}>
      <section className="relative overflow-hidden border-b border-[#E3E8F2] bg-white">
        <div className="relative mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <nav
            className="mb-5 max-w-3xl"
            aria-label="Parcours proposés par ce professeur"
            data-public-teacher-journey-tabs
          >
            <JourneySwitcher
              activeJourney={activeJourney}
              hrefs={journeyHrefs}
              journeys={eligibleJourneys}
              size="compact"
            />
          </nav>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
            <div className="overflow-hidden rounded-[1.75rem] border border-[#DDE3EE] bg-white shadow-[0_24px_65px_rgba(17,24,39,0.09)]" data-public-teacher-hero>
              <div className="relative aspect-[3/1] w-full overflow-hidden bg-[#F4F6F8]" data-public-teacher-cover>
                <Image
                  src={resolvedCover.url}
                  alt={`Couverture pédagogique de ${displayName}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 850px"
                  className="object-contain"
                  priority
                />
              </div>

              <div className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-3 border-t border-[#E3E8F2] px-4 pb-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5 sm:px-6 sm:pb-5" data-public-teacher-photo-layout>
                <div
                  className="relative z-10 w-fit rounded-full bg-white p-[3px] shadow-[0_12px_30px_rgba(17,24,39,0.14)]"
                  style={{ transform: "translateY(-50%)" }}
                >
                  <ProfessorImage
                    photoUrl={teacher.photoUrl}
                    name={displayName}
                    size={96}
                    shape="circle"
                    priority
                    verified={teacher.badgeVerified}
                  />
                </div>

                <div className="min-w-0 pt-4 text-left sm:pt-5">
                  <h1 className="break-words text-xl font-semibold leading-tight tracking-[-0.025em] text-[#111827] sm:text-4xl">
                    {displayName}
                  </h1>
                  <div className="mt-2 flex justify-start">
                    <ProfessorTrustBadges
                      verified={teacher.badgeVerified}
                      recommended={teacher.badgeRecommended}
                      premium={teacher.badgePremium}
                      popular={teacher.badgePopular}
                      isNew={teacher.badgeNew}
                      size="sm"
                      maxSecondary={1}
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[#111B4D] sm:text-base">
                    {teacher.jobTitle}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-start gap-x-3 gap-y-1.5 text-xs font-medium text-[#64748B] sm:text-sm">
                    <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{primarySubject}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{teacher.commune ?? "Abidjan"}</span>
                    {displayRating > 0 && <span className="font-semibold text-[#111B4D]">{displayRatingLabel} {displayRating.toFixed(1)}/5</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap justify-start gap-2 text-[11px] font-semibold text-[#111B4D] sm:text-xs">
                    {teacher.offersHome && <span className="inline-flex items-center gap-1"><HomeIcon className="h-3 w-3" />Domicile</span>}
                    {teacher.offersOnline && <span className="inline-flex items-center gap-1"><Video className="h-3 w-3" />En ligne</span>}
                  </div>
                  <div className="mt-3">
                    <TeacherProfileLink teacherId={teacher.id} teacherName={displayName} />
                  </div>
                </div>
              </div>

              <div className="mx-4 grid grid-cols-3 divide-x divide-[#E3E8F2] border-t border-[#E3E8F2] pb-4 pt-3 sm:mx-6 sm:pb-5">
                <HeroFact icon={<CheckCircle2 className="h-4 w-4" />} label="Contrôle" value="Vérifié" />
                <HeroFact icon={<GraduationCap className="h-4 w-4" />} label="Expérience" value={`${teacher.experienceYears} ans`} />
                <HeroFact icon={<Calendar className="h-4 w-4" />} label="Créneaux" value={availableDayCount > 0 ? `${availableDayCount} jours` : "À confirmer"} />
              </div>
            </div>

            <aside className="hidden rounded-[1.5rem] border border-[#DDE3EE] bg-white p-6 shadow-[0_18px_45px_rgba(17,24,39,0.06)] lg:flex lg:flex-col" data-public-teacher-primary-action>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{journeyConfig.label}</p>
              <h2 className="mt-1 text-xl font-semibold text-[#111B4D]">{sessionPriceLabel}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                Le total exact s'affiche avant Jèko. Pas de prix caché.
              </p>
              <div className="mt-4 space-y-3 text-sm font-semibold text-[#111827]">
                <span className="flex items-center gap-2"><HomeIcon className="h-4 w-4 text-[#111B4D]" />{formatLabel}</span>
                <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[#111B4D]" />{availabilitySummary}</span>
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-[#111B4D]" />Total affiché avant paiement</span>
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#111B4D]" />Fonds protégés jusqu'au cours</span>
              </div>
              {canBookActiveJourney ? (
                <Link
                  href={reserveHref}
                  className="mt-auto inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260]"
                >
                  <Calendar className="h-4 w-4" />
                  Réserver maintenant
                </Link>
              ) : (
                <div className="mt-auto space-y-3">
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                    Ce professeur n'a pas de matière et de niveau compatibles avec ce parcours. Choisissez un autre profil.
                  </p>
                  <Link href={teachersHref} className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-[#111B4D] px-4 text-sm font-semibold text-[#111B4D]">
                    Choisir un autre professeur
                  </Link>
                </div>
              )}
            </aside>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-[#DDE3EE] bg-white p-4 sm:p-5" data-public-teacher-decision-summary>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-public-teacher-decision-cashier>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Prix officiel</p>
                <h2 className="mt-0.5 text-2xl font-black leading-tight tracking-[-0.035em] text-[#111827] sm:text-3xl">{sessionPriceLabel}</h2>
                <p className="mt-1 line-clamp-1 text-sm font-semibold text-[#64748B]">
                  {formatLabel} · total exact avant paiement
                </p>
              </div>
              {canBookActiveJourney ? (
                <Link
                  href={reserveHref}
                  className="hidden min-h-12 items-center justify-center rounded-xl bg-[#111B4D] px-5 text-sm font-semibold text-white sm:inline-flex lg:hidden"
                  data-public-teacher-tablet-action
                >
                  Réserver
                </Link>
              ) : (
                <Link
                  href={teachersHref}
                  className="hidden min-h-12 items-center justify-center rounded-xl border border-[#111B4D] bg-white px-5 text-sm font-semibold text-[#111B4D] sm:inline-flex lg:hidden"
                  data-public-teacher-tablet-action
                >
                  Autre professeur
                </Link>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <DecisionPoint icon={<BookOpen className="h-4 w-4" />} label="Matières" value={subjectsPreview || primarySubject} />
              <DecisionPoint icon={<GraduationCap className="h-4 w-4" />} label="Niveaux" value={levelsPreview || "À confirmer"} />
              <DecisionPoint icon={<Calendar className="h-4 w-4" />} label="Disponibilités" value={availabilitySummary} />
              <DecisionPoint icon={<MapPin className="h-4 w-4" />} label="Zone" value={zonesPreview || teacher.commune || "Abidjan"} />
            </div>
          </div>
        </div>
      </section>

      {/* CONTENU */}
      <section className="bg-white pb-24 sm:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="min-w-0">
            {/* COLONNE PRINCIPALE */}
            <div className="min-w-0 space-y-3 sm:space-y-4">
              {/* Portrait court, bio complète à la demande. */}
              <Card>
                <CardTitle icon={<BookOpen className="h-4 w-4" />}>
                  Portrait
                </CardTitle>
                <p className="mt-3 text-sm font-medium leading-6 text-[#111827]" data-public-teacher-compact-bio>
                  {compactBio}
                </p>
                {hasLongBio && (
                  <details className="mt-3 rounded-xl border border-[#DDE6F7] bg-white" data-public-teacher-about>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-[#111B4D] marker:hidden">
                      Lire le portrait complet
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </summary>
                    <p className="whitespace-pre-line border-t border-[#E3E8F2] px-3 py-3 text-sm leading-relaxed text-[#111827]">
                      {profileBio}
                    </p>
                  </details>
                )}
              </Card>

              {/* Expertise adaptée au système actif */}
              <DisclosureCard
                icon={<GraduationCap className="h-4 w-4" />}
                title={activeJourney === "professionnel" ? "Compétences et profils" : "Matières et niveaux"}
                summary={`${journeySubjects.length} ${journeyConfig.subjectLabel.toLowerCase()}${journeySubjects.length > 1 ? "s" : ""} · ${journeyLevels.length} ${journeyConfig.levelLabel.toLowerCase()}${journeyLevels.length > 1 ? "s" : ""}`}
              >
                {journeySubjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {journeySubjects.map((s) => (
                    <span
                      key={s.subject.id}
                      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                        s.isPrimary
                          ? "border-[#111B4D] bg-white text-[#111B4D]"
                          : "border-[#E3E8F2] bg-white text-[#111827]"
                      }`}
                    >
                      {s.subject.name}
                      {s.isPrimary && (
                        <span className="text-xs uppercase tracking-wide text-[#64748B]">· Principale</span>
                      )}
                    </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-6 text-[#64748B]">
                    Les matières de ce parcours seront précisées avec votre besoin.
                  </p>
                )}
                <h3 className="mt-6 mb-3 text-sm font-semibold text-[#111827]">
                  Niveaux enseignés
                </h3>
                {journeyLevels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {journeyLevels.map((l) => (
                    <span
                      key={l.level.id}
                      className="inline-flex items-center rounded-lg border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]"
                    >
                      {l.level.name}
                    </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-6 text-[#64748B]">
                    Le niveau exact sera choisi pendant la réservation.
                  </p>
                )}
              </DisclosureCard>

              {/* CV consolidé : aucune information répétée entre les rubriques. */}
              {hasProfessionalDossier && (
                <DisclosureCard
                  icon={<BriefcaseBusiness className="h-4 w-4" />}
                  title="Dossier professionnel"
                  summary={`${teacher.experienceYears} ans d'expérience${teacher.diploma ? ` · ${teacher.diploma}` : ""}`}
                >
                  <TeacherMiniCv
                    careerSummary={teacher.careerSummary}
                    skills={teacher.skills}
                    workHistory={teacher.workHistory}
                    certifications={teacher.certifications}
                    teachingAchievements={teacher.teachingAchievements}
                    learnersCoached={teacher.learnersCoached}
                    experienceYears={teacher.experienceYears}
                    diploma={teacher.diploma}
                  />
                </DisclosureCard>
              )}

              {/* Zones d'intervention */}
              <DisclosureCard
                icon={<MapPin className="h-4 w-4" />}
                title="Zones d'intervention"
                summary={teacher.offersHome ? (zonesPreview || teacher.commune || "Abidjan") : "Cours en ligne uniquement"}
              >
                <p className="text-xs font-medium leading-5 text-[#64748B]">
                  {teacher.offersHome
                    ? "Le professeur se déplace dans les communes suivantes pour les cours à domicile."
                    : "Cours en ligne uniquement — pas de déplacement à domicile."}
                </p>
                {teacher.zones.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {teacher.zones.map((z) => {
                      const commune = z.commune as any;
                      return (
                      <span
                        key={commune.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111827]"
                      >
                        <MapPin className="h-3 w-3 text-[#64748B]" />
                        {commune.name}
                        {commune.zone && (
                          <span className="text-[#64748B]">· {commune.zone}</span>
                        )}
                      </span>
                    )})}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-medium text-[#64748B]">
                    Aucune zone enregistrée.
                  </p>
                )}
              </DisclosureCard>

              {/* Disponibilités */}
              <Card id="disponibilites">
                <CardTitle icon={<Calendar className="h-4 w-4" />}>
                  Disponibilités
                </CardTitle>
                {availability ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-[#111B4D]">{availabilitySummary}</p>
                    <details className="mt-3 rounded-lg border border-[#DDE6F7] bg-white" data-public-teacher-availability>
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-[#111B4D] marker:hidden">
                        Voir le planning détaillé
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      </summary>
                      <div className="border-t border-[#E3E8F2] p-3 sm:p-4">
                    <div className="space-y-3 xl:hidden">
                      {WEEK_DAYS.map((day) => {
                        const availableSlots = TWO_HOUR_SLOTS.filter((slot) => availability?.[day.key]?.[slot.key]);
                        return (
                          <div key={day.key} className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[#111827]">{day.label}</p>
                                <p className="text-xs font-medium text-[#64748B]">Séances de 2 heures</p>
                              </div>
                              <span className="text-[11px] font-semibold text-[#111B4D]">
                                {availableSlots.length} dispo.
                              </span>
                            </div>
                            {availableSlots.length > 0 ? (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {availableSlots.map((slot) => (
                                  <span
                                    key={slot.key}
                                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#111B4D] bg-white px-2 py-2 text-center text-xs font-semibold text-[#111B4D]"
                                  >
                                    {slot.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-3 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-medium text-[#64748B]">
                                Aucun créneau enregistré ce jour.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden xl:grid xl:gap-2">
                      <div className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1.5 text-xs">
                        <div className="flex items-center rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 font-semibold text-[#64748B]">
                          Jour
                        </div>
                        {TWO_HOUR_SLOTS.map((slot) => (
                          <div
                            key={slot.key}
                             className="flex min-h-10 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white px-1 text-center font-semibold text-[#64748B]"
                          >
                            {slot.shortLabel}
                          </div>
                        ))}
                        {WEEK_DAYS.map((day) => (
                          <div key={day.key} className="contents">
                            <div className="flex min-h-11 items-center rounded-lg border border-[#111B4D] bg-white px-3 text-sm font-semibold text-[#111B4D]">
                              {day.label}
                            </div>
                            {TWO_HOUR_SLOTS.map((slot) => {
                              const available = availability?.[day.key]?.[slot.key];
                              return (
                                <div
                                  key={slot.key}
                                  className={`flex min-h-11 items-center justify-center rounded-lg border text-center text-xs font-semibold ${
                                    available
                                      ? "border-[#111B4D] bg-white text-[#111B4D]"
                                      : "border-[#E3E8F2] bg-white text-[#94A3B8]"
                                  }`}
                                  title={`${day.label} ${slot.label} - ${available ? "Disponible" : "Indisponible"}`}
                                >
                                  {available ? "Dispo." : "—"}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
                      Les créneaux affichés sont des séances de 2 heures. La réservation est rattachée directement à ce professeur.
                    </p>
                      </div>
                    </details>
                  </>
                ) : (
                  <p className="mt-3 text-sm font-medium text-[#64748B]">
                    Disponibilités à confirmer lors de la réservation.
                  </p>
                )}
              </Card>

              {/* Tarifs */}
              <DisclosureCard
                icon={<Wallet className="h-4 w-4" />}
                title="Prix et frais"
                summary={`${sessionPriceLabel} · total affiché avant Jèko`}
                marker="pricing"
              >
                <div className="mt-4 grid gap-3 min-[760px]:grid-cols-3">
                  <PriceTile
                    label="Tarif officiel"
                    value={sessionPriceLabel}
                    sub="Séance de 2h"
                    highlight
                  />
                  <PriceTile
                    label="Déplacement"
                    value="0 même quartier"
                    sub="Sinon calculé selon le trajet"
                  />
                  <PriceTile
                    label="Paiement"
                    value="Service 3 %"
                    sub="Frais opérateur séparés"
                  />
                </div>
                <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
                  Choisissez 1, 4, 8 ou 12 séances de 2h. Le moteur calcule le cours officiel, le déplacement éventuel et chaque frais séparément avant le paiement.
                </p>
                <Link href={tariffsHref} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#111B4D] underline-offset-4 hover:underline">
                  Voir la grille officielle
                </Link>
              </DisclosureCard>

              {/* Avis clients */}
              <Card>
                <CardTitle icon={<BadgeCheck className="h-4 w-4" />}>
                  Avis clients ({teacher.reviews.length})
                </CardTitle>

                {/* Répartition des notes */}
                {teacher.reviews.length > 0 && displayRating > 0 && (
                  <div className="mt-4 grid gap-4 min-[760px]:grid-cols-[200px_1fr]">
                    <div className="flex flex-col items-center justify-center rounded-lg border border-[#E3E8F2] bg-white p-4 text-center">
                      <div className="text-4xl font-semibold text-[#111827]">
                        {displayRating.toFixed(1)}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#111B4D]">
                        Note moyenne
                      </div>
                      <p className="mt-1 text-xs font-medium text-[#64748B]">
                        {totalReviews > 0 ? `${totalReviews} avis vérifiés` : "Note validée par le service client"}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {ratingBuckets.map((b) => {
                        const pct = totalReviews > 0 ? (b.count / totalReviews) * 100 : 0;
                        return (
                          <div key={b.rating} className="flex items-center gap-2 text-xs">
                            <span className="w-16 font-medium text-[#64748B]">Note {b.rating}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                              <div
                                className="h-full rounded-full bg-[#111B4D]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-right tabular-nums font-medium text-[#64748B]">
                              {b.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Liste des avis */}
                {teacher.reviews.length > 0 ? (
                  <ul className="mt-6 divide-y divide-[#E3E8F2]">
                    {teacher.reviews.map((r) => (
                      <li key={r.id} className="py-4 first:pt-2 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111B4D] text-sm font-semibold text-white">
                              {(r.client.name || "?")
                                .split(" ")
                                .slice(0, 2)
                                .map((p) => p[0]?.toUpperCase())
                                .join("")}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#111827]">
                                {r.client.name}
                              </p>
                              <p className="text-xs font-medium text-[#64748B]">
                                {formatDate(r.createdAt)}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-[#111B4D]">
                            Note {r.rating}/5
                          </span>
                        </div>
                        {r.comment && (
                          <p className="mt-2 text-sm leading-relaxed text-[#111827]">
                            {r.comment}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-lg border border-[#E3E8F2] bg-white px-4 py-3 text-sm font-medium leading-6 text-[#64748B]">
                    Aucun avis client publié pour le moment. {displayRating > 0 ? `${displayRatingLabel} : ${displayRating.toFixed(1)}/5.` : ""}
                  </p>
                )}
              </Card>
            </div>

          </div>
        </div>
      </section>
      <div className="fixed inset-x-3 z-40 rounded-lg border border-[#DDE6F7] bg-white p-2 sm:hidden" style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0 px-2">
            <p className="truncate text-sm font-semibold text-[#111827]">{displayName}</p>
            <p className="truncate text-xs font-semibold text-[#64748B]">{sessionPriceLabel}</p>
          </div>
          <Link
            href={canBookActiveJourney ? reserveHref : teachersHref}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold ${canBookActiveJourney ? "bg-[#111B4D] text-white" : "border border-[#111B4D] bg-white text-[#111B4D]"}`}
          >
            {canBookActiveJourney ? "Réserver" : "Autre professeur"}
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="min-w-0 scroll-mt-24 rounded-[1.35rem] border border-[#E3E8F2] bg-white p-5 sm:p-6">
      {children}
    </div>
  );
}

function DisclosureCard({
  children,
  icon,
  title,
  summary,
  marker,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
  summary: string;
  marker?: "pricing";
}) {
  return (
    <details
      className="group rounded-[1.35rem] border border-[#E3E8F2] bg-white"
      data-public-teacher-disclosure
      data-public-teacher-fees-disclosure={marker === "pricing" ? "true" : undefined}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden sm:px-5">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F4FF] text-[#111B4D]">{icon}</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#111827] sm:text-base">{title}</span>
            <span className="mt-0.5 block truncate text-xs font-medium text-[#64748B] sm:text-sm">{summary}</span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#111B4D] transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#E3E8F2] p-4 sm:p-5">{children}</div>
    </details>
  );
}

function CardTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
      <span className="text-[#111B4D]">{icon}</span>
      {children}
    </h2>
  );
}

function HeroFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 px-2 text-center sm:px-3">
      <span className="mx-auto flex h-6 items-center justify-center text-[#111B4D]">{icon}</span>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-[#111827] sm:text-sm">{value}</p>
    </div>
  );
}

function DecisionPoint({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E3E8F2] bg-white p-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        <span className="text-[#111B4D]">{icon}</span>
        {label}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-[#111827]">{value}</p>
    </div>
  );
}

function PriceTile({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 text-center ${
        highlight
          ? "border-[#111B4D] bg-white"
          : "border-[#E3E8F2] bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[#111827]">
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-[#64748B]">{sub}</p>
    </div>
  );
}

function compactTeacherBio(value: string, maxLength = 185) {
  const bio = value.trim().replace(/\s+/g, " ");
  if (bio.length <= maxLength) return bio;

  const head = bio.slice(0, maxLength);
  const naturalBreak = Math.max(
    head.lastIndexOf("."),
    head.lastIndexOf(";"),
    head.lastIndexOf(","),
    head.lastIndexOf(" "),
  );
  const cutAt = naturalBreak >= Math.floor(maxLength * 0.58) ? naturalBreak : maxLength;
  return `${head.slice(0, cutAt).trim().replace(/[.,;:!?]+$/u, "")}…`;
}

function buildTeachersHref(journey: string, referralCode: string) {
  const params = new URLSearchParams({ journey });
  if (referralCode) params.set("ref", referralCode);
  return `/professeurs?${params.toString()}`;
}

function buildTeacherJourneyHref(teacherId: string, journey: string, referralCode: string) {
  const params = new URLSearchParams({ journey });
  if (referralCode) params.set("ref", referralCode);
  return `/professeurs/${teacherId}?${params.toString()}`;
}
