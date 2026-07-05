import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Home as HomeIcon,
  Luggage,
  MapPin,
  ShieldCheck,
  Video,
  Wallet,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ProfessorTrustBadges } from "@/components/shared/professor-trust-badges";
import { TeacherMiniCv } from "@/components/shared/teacher-mini-cv";
import { db } from "@/lib/db";
import { formatFCFA, formatDate } from "@/lib/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const teacher = await db.teacher.findFirst({
    where: { id, status: "ACTIVE", AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
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
  });

  if (!teacher) {
    notFound();
  }

  const displayName = teacher.professionalName || teacher.fullName;
  const primarySubject =
    teacher.subjects.find((s) => s.isPrimary)?.subject.name ??
    teacher.subjects[0]?.subject.name ??
    "—";

  const availability = parseAvailability(teacher.availability);

  // Compute numeric review distribution.
  const ratingBuckets = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: teacher.reviews.filter((r) => r.rating === rating).length,
  }));
  const totalReviews = teacher.reviews.length || teacher.ratingCount;
  const displayRating = totalReviews > 0
    ? teacher.rating
    : teacher.adminRatingPublic && teacher.adminRating > 0
      ? teacher.adminRating
      : teacher.rating;
  const displayRatingLabel = totalReviews > 0 ? "Avis" : "Note plateforme";
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
  const subjectsPreview = teacher.subjects.slice(0, 4).map((s) => s.subject.name).join(", ");
  const levelsPreview = teacher.levels.slice(0, 5).map((l) => l.level.name).join(", ");
  const zonesPreview = teacher.zones.slice(0, 4).map((z) => z.commune.name).join(", ");
  const sessionPriceLabel = formatFCFA(teacher.pricePerSession || teacher.pricePerHour || 0);

  const reserveHref = session?.user
    ? `/client/reserver?teacherId=${teacher.id}`
    : `/connexion?from=${encodeURIComponent(`/client/reserver?teacherId=${teacher.id}`)}`;

  return (
    <PublicLayout>
      {/* Breadcrumb */}
      <div className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto hidden max-w-7xl px-4 py-3 sm:block sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#64748B]">
            <Link href="/" className="inline-flex min-h-10 items-center rounded-xl px-1 hover:text-[#111B4D]">Accueil</Link>
            <span>/</span>
            <Link href="/professeurs" className="inline-flex min-h-10 items-center rounded-xl px-1 hover:text-[#111B4D]">Professeurs</Link>
            <span>/</span>
            <span className="text-[#111827]">{displayName}</span>
          </nav>
        </div>
      </div>

      {/* HEADER */}
      <section className="relative overflow-hidden border-b border-[#E3E8F2] bg-white">
        <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
          <Link
            href="/professeurs"
            className="mb-6 hidden min-h-11 items-center gap-1 rounded-2xl border border-[#E3E8F2] bg-white px-4 py-2 text-sm font-semibold text-[#64748B] transition hover:border-[#111B4D] hover:text-[#111B4D] sm:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </Link>

          <div className="rounded-xl border border-[#E3E8F2] bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <ProfessorImage
              photoUrl={teacher.photoUrl}
              name={displayName}
              size={152}
              shape="rounded"
              priority
              verified={teacher.badgeVerified}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-[#111827] sm:text-4xl">
                  {displayName}
                </h1>
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
              <p className="mt-2 text-sm font-semibold text-[#111B4D] sm:text-base">
                {teacher.jobTitle}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-[#64748B]">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {primarySubject}
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  {teacher.experienceYears} ans d'expérience
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {teacher.commune ?? "Abidjan"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-[#111B4D]">
                  {displayRatingLabel} {displayRating.toFixed(1)}/5
                </span>
                <span className="hidden text-[#CBD5E1] sm:inline">·</span>
                <span className="text-sm font-medium text-[#64748B]">
                  {teacher._count.bookings} réservations effectuées
                </span>
                <span className="hidden text-[#CBD5E1] sm:inline">·</span>
                <span className="font-semibold text-[#111827]">
                  {sessionPriceLabel} / séance
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#111B4D]">
                {teacher.offersHome && (
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <HomeIcon className="h-3 w-3" /> Cours à domicile
                  </span>
                )}
                {teacher.offersOnline && (
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Video className="h-3 w-3" /> Cours en ligne
                  </span>
                )}
              </div>
              <div className="mt-5 grid gap-2 sm:hidden">
                <Link
                  href={reserveHref}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260]"
                >
                  <Calendar className="h-4 w-4" />
                  Réserver ce professeur
                </Link>
                <a
                  href="#disponibilites"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[#C8D2E3] bg-white px-4 text-sm font-semibold text-[#111B4D]"
                >
                  Voir les créneaux disponibles
                </a>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-t border-[#E3E8F2] pt-5 sm:grid-cols-3">
            <MiniStat label="Cours attribués" value={teacher._count.bookings} />
            <MiniStat label="Avis vérifiés" value={totalReviews} />
            <MiniStat label="Prix indicatif" value={<Money amount={teacher.pricePerSession || teacher.pricePerHour || 0} />} />
          </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
            <div className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Dossier de décision</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#111827]">
                    Réserver {displayName} sans zone d'ombre.
                  </h2>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
                  Professeur suivi par l'administration
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DecisionPoint
                  icon={<BookOpen className="h-4 w-4" />}
                  label="Matières"
                  value={subjectsPreview || primarySubject}
                />
                <DecisionPoint
                  icon={<GraduationCap className="h-4 w-4" />}
                  label="Niveaux"
                  value={levelsPreview || "À confirmer"}
                />
                <DecisionPoint
                  icon={<Calendar className="h-4 w-4" />}
                  label="Disponibilités"
                  value={availabilitySummary}
                />
                <DecisionPoint
                  icon={<MapPin className="h-4 w-4" />}
                  label="Zone"
                  value={zonesPreview || teacher.commune || "Abidjan"}
                />
              </div>
              <p className="mt-4 text-sm font-medium leading-6 text-[#64748B]">
                Le client choisit une date, un créneau de 2h et son besoin. Le prix final est affiché avant paiement, puis la réservation est rattachée à ce professeur dans le suivi client et admin.
              </p>
            </div>

            <div className="hidden rounded-xl border border-[#111B4D] bg-white p-4 sm:p-5 lg:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Action recommandée</p>
              <h2 className="mt-1 text-xl font-semibold text-[#111B4D]">Démarrer la réservation guidée</h2>
              <div className="mt-3 space-y-2 text-sm text-[#111B4D]">
                <TrustLine icon={<ShieldCheck className="h-4 w-4" />} text="Paiement sécurisé, fonds bloqués jusqu'à confirmation." />
                <TrustLine icon={<Wallet className="h-4 w-4" />} text="Montant total affiché avant paiement, sans information interne." />
                <TrustLine icon={<Clock className="h-4 w-4" />} text="Annulation et support encadrés par l'administration." />
              </div>
              <Link
                href={reserveHref}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#182260]"
              >
                <Calendar className="h-4 w-4" />
                Réserver ce professeur
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENU */}
      <section className="bg-white pb-24 sm:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* COLONNE PRINCIPALE */}
            <div className="min-w-0 space-y-6">
              {/* À propos */}
              <Card>
                <CardTitle icon={<BookOpen className="h-4 w-4" />}>
                  À propos de {displayName}
                </CardTitle>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#111827]">
                  {teacher.bio}
                </p>
              </Card>

              {/* Expérience & diplômes */}
              <Card>
                <CardTitle icon={<Award className="h-4 w-4" />}>
                  Expérience & diplômes
                </CardTitle>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Années d'expérience
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                      {teacher.experienceYears} ans
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Diplôme principal
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                      {teacher.diploma || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Type de profil
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                      {formatProfileType(teacher.profileType)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Réservations effectuées
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                      {teacher._count.bookings} cours
                    </p>
                  </div>
                </div>
              </Card>

              {/* Mini CV professionnel */}
              <Card>
                <CardTitle icon={<BriefcaseBusiness className="h-4 w-4" />}>
                  Mini CV professionnel
                </CardTitle>
                <div className="mt-4">
                  <TeacherMiniCv
                    careerSummary={teacher.careerSummary}
                    skills={teacher.skills}
                    workHistory={teacher.workHistory}
                    certifications={teacher.certifications || teacher.diploma}
                    teachingAchievements={teacher.teachingAchievements}
                    learnersCoached={teacher.learnersCoached}
                  />
                </div>
              </Card>

              {/* Matières & Niveaux */}
              <Card>
                <CardTitle icon={<GraduationCap className="h-4 w-4" />}>
                  Matières enseignées
                </CardTitle>
                <div className="mt-3 flex flex-wrap gap-2">
                  {teacher.subjects.map((s) => (
                    <span
                      key={s.subject.id}
                      className={`inline-flex items-center gap-1 rounded-2xl border px-3 py-1.5 text-sm font-semibold ${
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
                <h3 className="mt-6 mb-3 text-sm font-semibold text-[#111827]">
                  Niveaux enseignés
                </h3>
                <div className="flex flex-wrap gap-2">
                  {teacher.levels.map((l) => (
                    <span
                      key={l.level.id}
                      className="inline-flex items-center rounded-2xl border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]"
                    >
                      {l.level.name}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Zones d'intervention */}
              <Card>
                <CardTitle icon={<MapPin className="h-4 w-4" />}>
                  Zones d'intervention
                </CardTitle>
                <p className="mt-2 text-xs font-medium leading-5 text-[#64748B]">
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
                        className="inline-flex items-center gap-1 rounded-2xl border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111827]"
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
              </Card>

              {/* Disponibilités */}
              <Card id="disponibilites">
                <CardTitle icon={<Calendar className="h-4 w-4" />}>
                  Disponibilités
                </CardTitle>
                {availability ? (
                  <div className="mt-4">
                    <div className="space-y-3 xl:hidden">
                      {WEEK_DAYS.map((day) => {
                        const availableSlots = TWO_HOUR_SLOTS.filter((slot) => availability?.[day.key]?.[slot.key]);
                        return (
                          <div key={day.key} className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-3">
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
                                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#111B4D] bg-white px-2 py-2 text-center text-xs font-semibold text-[#111B4D]"
                                  >
                                    {slot.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-medium text-[#64748B]">
                                Aucun créneau enregistré ce jour.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden xl:grid xl:gap-2">
                      <div className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1.5 text-xs">
                        <div className="flex items-center rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 font-semibold text-[#64748B]">
                          Jour
                        </div>
                        {TWO_HOUR_SLOTS.map((slot) => (
                          <div
                            key={slot.key}
                             className="flex min-h-10 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white px-1 text-center font-semibold text-[#64748B]"
                          >
                            {slot.shortLabel}
                          </div>
                        ))}
                        {WEEK_DAYS.map((day) => (
                          <div key={day.key} className="contents">
                            <div className="flex min-h-11 items-center rounded-2xl border border-[#111B4D] bg-white px-3 text-sm font-semibold text-[#111B4D]">
                              {day.label}
                            </div>
                            {TWO_HOUR_SLOTS.map((slot) => {
                              const available = availability?.[day.key]?.[slot.key];
                              return (
                                <div
                                  key={slot.key}
                                  className={`flex min-h-11 items-center justify-center rounded-2xl border text-center text-xs font-semibold ${
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
                ) : (
                  <p className="mt-3 text-sm font-medium text-[#64748B]">
                    Disponibilités à confirmer lors de la réservation.
                  </p>
                )}
              </Card>

              {/* Tarifs */}
              <Card>
                <CardTitle icon={<Wallet className="h-4 w-4" />}>
                  Tarifs
                </CardTitle>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <PriceTile
                    label="Prix indicatif"
                    value={<Money amount={teacher.pricePerSession || teacher.pricePerHour || 0} />}
                    sub="Séance de 2h"
                    highlight
                  />
                  <PriceTile
                    label="Packs"
                    value="4, 8 ou 12"
                    sub="Séances de 2h"
                  />
                  <PriceTile
                    label="Déplacement"
                    value="Séparé"
                    sub="À domicile uniquement"
                  />
                </div>
                <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
                  Le prix final est confirmé pendant la réservation selon le niveau, le format, le nombre de participants et les frais de déplacement éventuels.
                  Le client voit toujours le total avant paiement.
                </p>
              </Card>

              {/* Avis clients */}
              <Card>
                <CardTitle icon={<BadgeCheck className="h-4 w-4" />}>
                  Avis clients ({teacher.reviews.length})
                </CardTitle>

                {/* Répartition des notes */}
                {displayRating > 0 && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
                    <div className="flex flex-col items-center justify-center rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4 text-center">
                      <div className="text-4xl font-semibold text-[#111827]">
                        {displayRating.toFixed(1)}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#111B4D]">
                        Note moyenne
                      </div>
                      <p className="mt-1 text-xs font-medium text-[#64748B]">
                        {totalReviews > 0 ? `${totalReviews} avis vérifiés` : "Note validée par l'administration"}
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
                  <p className="mt-4 rounded-2xl border border-[#E3E8F2] bg-white px-4 py-3 text-sm font-medium leading-6 text-[#64748B]">
                    Ce professeur n'a pas encore d'avis publié. Soyez le
                    premier à réserver et à laisser un avis après votre cours.
                  </p>
                )}
              </Card>
            </div>

            {/* COLONNE LATERALE — RÉCAP + RÉSERVER */}
            <aside className="min-w-0 lg:sticky lg:top-20 lg:h-fit">
              <div className="rounded-xl border border-[#E3E8F2] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Prix indicatif</p>
                <div className="mt-1">
                  <span className="text-2xl font-semibold tracking-tight text-[#111827]">
                    <Money amount={teacher.pricePerSession || teacher.pricePerHour || 0} />
                  </span>
                  <p className="mt-1 text-sm font-medium text-[#64748B]">Séance de 2h, total confirmé avant paiement.</p>
                </div>

                <div className="mt-4 space-y-2 border-t border-[#E3E8F2] pt-4 text-sm">
                  <Row label="Packs" value="1, 4, 8 ou 12 séances" />
                  <Row label="Devis" value="Cas spéciaux" />
                  <Row
                    label="Format"
                    value={
                      <span className="flex items-center justify-end gap-1.5">
                        {teacher.offersHome && (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <HomeIcon className="h-3 w-3" /> Domicile
                          </span>
                        )}
                        {teacher.offersOnline && (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Video className="h-3 w-3" /> En ligne
                          </span>
                        )}
                      </span>
                    }
                  />
                  <Row label="Commune" value={teacher.commune ?? "Abidjan"} />
                </div>

                <Link
                  href={reserveHref}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#1E2A78]"
                >
                  <Calendar className="h-4 w-4" />
                  Réserver ce professeur
                </Link>

                {!session?.user && (
                  <p className="mt-2 text-center text-xs font-medium leading-5 text-[#64748B]">
                    Vous devrez créer un compte ou vous connecter pour finaliser
                    la réservation.
                  </p>
                )}

                <div className="mt-5 space-y-2.5 border-t border-[#E3E8F2] pt-4">
                  <div className="flex items-start gap-2 text-xs font-medium leading-5 text-[#64748B]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>
                      <strong className="text-[#111827]">Paiement sécurisé.</strong>{" "}
                      Fonds bloqués jusqu'à confirmation du cours.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs font-medium leading-5 text-[#64748B]">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>
                      <strong className="text-[#111827]">Professeur vérifié</strong> par
                      notre équipe (identité, diplômes).
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs font-medium leading-5 text-[#64748B]">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>
                      <strong className="text-[#111827]">Annulation</strong> possible
                      jusqu'à 24h avant le cours.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs font-medium leading-5 text-[#64748B]">
                    <Luggage className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>
                      <strong className="text-[#111827]">Litige</strong> traité par notre
                      support sous 48h.
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
      <div className="fixed inset-x-3 z-40 rounded-xl border border-[#DDE6F7] bg-white p-2 sm:hidden" style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0 px-2">
            <p className="truncate text-sm font-semibold text-[#111827]">{displayName}</p>
            <p className="truncate text-xs font-semibold text-[#64748B]">{sessionPriceLabel} / séance 2h</p>
          </div>
          <Link
            href={reserveHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#111B4D] px-4 text-sm font-semibold text-white"
          >
            Réserver
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="min-w-0 scroll-mt-24 rounded-xl border border-[#E3E8F2] bg-white p-5 sm:p-6">
      {children}
    </div>
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

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E3E8F2] bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#111827]">{value}</p>
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
    <div className="min-w-0 rounded-2xl border border-[#E3E8F2] bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        <span className="text-[#111B4D]">{icon}</span>
        {label}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-[#111827]">{value}</p>
    </div>
  );
}

function TrustLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
      <span className="mt-0.5 shrink-0 text-[#111B4D]">{icon}</span>
      <span className="leading-5">{text}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-[#64748B]">{label}</span>
      <span className="font-semibold text-[#111827]">{value}</span>
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
      className={`rounded-xl border p-4 text-center ${
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

function formatProfileType(p: string): string {
  const map: Record<string, string> = {
    ENSEIGNANT: "Enseignant",
    ETUDIANT: "Étudiant",
    REPETITEUR: "Répétiteur",
    FORMATEUR: "Formateur",
    PROFESSIONNEL: "Professionnel",
  };
  return map[p] || p;
}
