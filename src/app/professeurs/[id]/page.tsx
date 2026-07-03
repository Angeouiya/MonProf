import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
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

  const reserveHref = session?.user
    ? `/client/reserver?teacherId=${teacher.id}`
    : `/connexion?from=${encodeURIComponent(`/client/reserver?teacherId=${teacher.id}`)}`;

  return (
    <PublicLayout>
      {/* Breadcrumb */}
      <div className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="inline-flex min-h-10 items-center rounded-full px-1 hover:text-[#111B4D]">Accueil</Link>
            <span>/</span>
            <Link href="/professeurs" className="inline-flex min-h-10 items-center rounded-full px-1 hover:text-[#111B4D]">Professeurs</Link>
            <span>/</span>
            <span className="text-foreground">{displayName}</span>
          </nav>
        </div>
      </div>

      {/* HEADER */}
      <section className="relative overflow-hidden border-b border-[#E3E8F2] bg-white">
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <Link
            href="/professeurs"
            className="mb-6 inline-flex min-h-11 items-center gap-1 rounded-full border border-[#E3E8F2] bg-white px-4 py-2 text-sm font-semibold text-[#64748B] shadow-sm transition hover:border-[#111B4D] hover:text-[#111B4D]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </Link>

          <div className="rounded-[2rem] border border-[#E3E8F2] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <ProfessorImage
              photoUrl={teacher.photoUrl}
              name={displayName}
              size={190}
              shape="rounded"
              priority
              verified={teacher.badgeVerified}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  {displayName}
                </h1>
                <ProfessorTrustBadges
                  verified={teacher.badgeVerified}
                  recommended={teacher.badgeRecommended}
                  premium={teacher.badgePremium}
                  popular={teacher.badgePopular}
                  isNew={teacher.badgeNew}
                  size="lg"
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-[#111B4D] sm:text-base">
                {teacher.jobTitle}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
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
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[#111B4D] bg-white px-3 py-1 text-sm font-bold text-[#111B4D]">
                  Note {teacher.rating.toFixed(1)}/5
                </span>
                <span className="text-sm text-muted-foreground">
                  {teacher.ratingCount} avis
                </span>
                <span className="hidden text-muted-foreground sm:inline">·</span>
                <span className="text-sm text-muted-foreground">
                  {teacher._count.bookings} réservations effectuées
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {teacher.offersHome && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#E3E8F2] bg-white px-3 py-1.5 text-xs font-semibold text-[#111B4D]">
                    <HomeIcon className="h-3 w-3" /> Cours à domicile
                  </span>
                )}
                {teacher.offersOnline && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#E3E8F2] bg-white px-3 py-1.5 text-xs font-semibold text-[#111B4D]">
                    <Video className="h-3 w-3" /> Cours en ligne
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
            <MiniStat label="Cours attribués" value={teacher._count.bookings} />
            <MiniStat label="Avis vérifiés" value={totalReviews} />
            <MiniStat label="Tarif" value="Selon besoin" />
          </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
            <div className="rounded-[1.75rem] border border-[#E3E8F2] bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">Dossier de décision</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#111827]">
                    Réserver {displayName} sans zone d'ombre.
                  </h2>
                </div>
                <span className="inline-flex w-fit items-center rounded-full border border-[#111B4D] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">
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
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Le client choisit une date, un créneau de 2h et son besoin. Le prix final est affiché avant paiement, puis la réservation est rattachée à ce professeur dans le suivi client et admin.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-[#111B4D] bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">Action recommandée</p>
              <h2 className="mt-1 text-xl font-black text-[#111B4D]">Démarrer la réservation guidée</h2>
              <div className="mt-3 space-y-2 text-sm text-[#111B4D]">
                <TrustLine icon={<ShieldCheck className="h-4 w-4" />} text="Paiement sécurisé, fonds bloqués jusqu'à confirmation." />
                <TrustLine icon={<Wallet className="h-4 w-4" />} text="Montant total affiché avant paiement, sans information interne." />
                <TrustLine icon={<Clock className="h-4 w-4" />} text="Annulation et support encadrés par l'administration." />
              </div>
              <Link
                href={reserveHref}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#1E2A78]"
              >
                <Calendar className="h-4 w-4" />
                Réserver ce professeur
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENU */}
      <section className="bg-white">
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
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Années d'expérience
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {teacher.experienceYears} ans
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Diplôme principal
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {teacher.diploma || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Type de profil
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatProfileType(teacher.profileType)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Réservations effectuées
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {teacher._count.bookings} cours
                    </p>
                  </div>
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
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm ${
                        s.isPrimary
                          ? "border-[#111B4D] bg-white text-[#111B4D]"
                          : "border-[#E3E8F2] bg-white text-[#111827]"
                      }`}
                    >
                      {s.subject.name}
                      {s.isPrimary && (
                        <span className="rounded-full border border-[#E3E8F2] bg-white px-2 py-0.5 text-xs uppercase tracking-wide">Principale</span>
                      )}
                    </span>
                  ))}
                </div>
                <h3 className="mt-6 mb-3 text-sm font-semibold text-foreground">
                  Niveaux enseignés
                </h3>
                <div className="flex flex-wrap gap-2">
                  {teacher.levels.map((l) => (
                    <span
                      key={l.level.id}
                      className="inline-flex items-center rounded-full border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]"
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
                <p className="mt-2 text-xs text-muted-foreground">
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
                        className="inline-flex items-center gap-1 rounded-full border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] shadow-sm"
                      >
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {commune.name}
                        {commune.zone && (
                          <span className="text-muted-foreground">· {commune.zone}</span>
                        )}
                      </span>
                    )})}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Aucune zone enregistrée.
                  </p>
                )}
              </Card>

              {/* Disponibilités */}
              <Card>
                <CardTitle icon={<Calendar className="h-4 w-4" />}>
                  Disponibilités
                </CardTitle>
                {availability ? (
                  <div className="mt-4">
                    <div className="space-y-3 xl:hidden">
                      {WEEK_DAYS.map((day) => {
                        const availableSlots = TWO_HOUR_SLOTS.filter((slot) => availability?.[day.key]?.[slot.key]);
                        return (
                          <div key={day.key} className="rounded-3xl border border-[#E3E8F2] bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-foreground">{day.label}</p>
                                <p className="text-xs text-muted-foreground">Séances de 2 heures</p>
                              </div>
                              <span className="rounded-full border border-[#E3E8F2] bg-white px-2.5 py-1 text-[11px] font-bold text-[#111B4D]">
                                {availableSlots.length} dispo.
                              </span>
                            </div>
                            {availableSlots.length > 0 ? (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {availableSlots.map((slot) => (
                                  <span
                                    key={slot.key}
                                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#111B4D] bg-white px-2 py-2 text-center text-xs font-bold text-[#111B4D]"
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
                        <div className="flex items-center rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 font-bold text-[#64748B]">
                          Jour
                        </div>
                        {TWO_HOUR_SLOTS.map((slot) => (
                          <div
                            key={slot.key}
                             className="flex min-h-10 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white px-1 text-center font-bold text-[#64748B]"
                          >
                            {slot.shortLabel}
                          </div>
                        ))}
                        {WEEK_DAYS.map((day) => (
                          <div key={day.key} className="contents">
                            <div className="flex min-h-11 items-center rounded-2xl border border-[#111B4D] bg-white px-3 text-sm font-black text-[#111B4D]">
                              {day.label}
                            </div>
                            {TWO_HOUR_SLOTS.map((slot) => {
                              const available = availability?.[day.key]?.[slot.key];
                              return (
                                <div
                                  key={slot.key}
                                  className={`flex min-h-11 items-center justify-center rounded-2xl border text-center text-xs font-black shadow-sm ${
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
                    <p className="mt-3 text-xs text-muted-foreground">
                      Les créneaux affichés sont des séances de 2 heures. La réservation est rattachée directement à ce professeur.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
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
                    label="Prix"
                    value="Selon besoin"
                    sub="Catégorie, niveau, système scolaire"
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
                <p className="mt-3 text-xs text-muted-foreground">
                  Le tarif final est calculé pendant la réservation selon la grille officielle MonProf CI.
                  Le client voit le prix du cours, les frais de déplacement et le total avant paiement.
                </p>
              </Card>

              {/* Avis clients */}
              <Card>
                <CardTitle icon={<BadgeCheck className="h-4 w-4" />}>
                  Avis clients ({teacher.reviews.length})
                </CardTitle>

                {/* Répartition des notes */}
                {totalReviews > 0 && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-[#E3E8F2] bg-white p-4 text-center shadow-sm">
                      <div className="text-4xl font-bold text-foreground">
                        {teacher.rating.toFixed(1)}
                      </div>
                      <div className="mt-1 rounded-full border border-[#111B4D] bg-white px-3 py-1 text-sm font-bold text-[#111B4D]">
                        Note moyenne
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {totalReviews} avis vérifiés
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {ratingBuckets.map((b) => {
                        const pct = totalReviews > 0 ? (b.count / totalReviews) * 100 : 0;
                        return (
                          <div key={b.rating} className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-muted-foreground">Note {b.rating}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                              <div
                                className="h-full rounded-full bg-[#111B4D]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-right tabular-nums text-muted-foreground">
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
                  <ul className="mt-6 divide-y divide-border">
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
                              <p className="text-sm font-medium text-foreground">
                                {r.client.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(r.createdAt)}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full border border-[#111B4D] bg-white px-2.5 py-1 text-xs font-bold text-[#111B4D]">
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
                  <p className="mt-4 rounded-2xl border border-[#E3E8F2] bg-white px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    Ce professeur n'a pas encore d'avis publié. Soyez le
                    premier à réserver et à laisser un avis après votre cours.
                  </p>
                )}
              </Card>
            </div>

            {/* COLONNE LATERALE — RÉCAP + RÉSERVER */}
            <aside className="min-w-0 lg:sticky lg:top-20 lg:h-fit">
              <div className="rounded-[2rem] border border-[#E3E8F2] bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tarif</p>
                <div className="mt-1">
                  <span className="text-2xl font-bold tracking-tight text-foreground">Calculé selon le besoin</span>
                  <p className="mt-1 text-sm text-muted-foreground">Prix du cours + déplacement éventuel avant paiement.</p>
                </div>

                <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
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
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E2A78]"
                >
                  <Calendar className="h-4 w-4" />
                  Réserver ce professeur
                </Link>

                {!session?.user && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Vous devrez créer un compte ou vous connecter pour finaliser
                    la réservation.
                  </p>
                )}

                <div className="mt-5 space-y-2.5 border-t border-border pt-4">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>
                      <strong className="text-foreground">Paiement sécurisé.</strong>{" "}
                      Fonds bloqués jusqu'à confirmation du cours.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>
                      <strong className="text-foreground">Professeur vérifié</strong> par
                      notre équipe (identité, diplômes).
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>
                      <strong className="text-foreground">Annulation</strong> possible
                      jusqu'à 24h avant le cours.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Luggage className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>
                      <strong className="text-foreground">Litige</strong> traité par notre
                      support sous 48h.
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-3xl border border-[#E3E8F2] bg-white p-5 shadow-sm sm:p-6">
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
    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
      <span className="text-[#111B4D]">{icon}</span>
      {children}
    </h2>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E3E8F2] bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-extrabold text-foreground">{value}</p>
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
    <div className="min-w-0 rounded-2xl border border-[#E3E8F2] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#64748B]">
        <span className="text-[#111B4D]">{icon}</span>
        {label}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-extrabold leading-5 text-[#111827]">{value}</p>
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
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
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
