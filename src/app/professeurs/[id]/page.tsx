import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
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
  Sparkles,
  Star,
  TrendingUp,
  Video,
  Wallet,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Money } from "@/components/shared/money";
import { db } from "@/lib/db";
import { formatFCFA, formatDate, avatarFromName } from "@/lib/format";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DAYS = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

const SLOTS = [
  { key: "morning", label: "Matin", time: "08h – 12h" },
  { key: "afternoon", label: "Après-midi", time: "12h – 17h" },
  { key: "evening", label: "Soir", time: "17h – 21h" },
];

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const teacher = await db.teacher.findUnique({
    where: { id },
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

  if (!teacher || teacher.status !== "ACTIVE") {
    notFound();
  }

  const displayName = teacher.professionalName || teacher.fullName;
  const primarySubject =
    teacher.subjects.find((s) => s.isPrimary)?.subject.name ??
    teacher.subjects[0]?.subject.name ??
    "—";

  // Parse availability
  let availability: Record<string, Record<string, boolean>> | null = null;
  if (teacher.availability) {
    try {
      availability = JSON.parse(teacher.availability);
    } catch {
      availability = null;
    }
  }

  // Compute rating distribution
  const ratingBuckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: teacher.reviews.filter((r) => r.rating === star).length,
  }));
  const totalReviews = teacher.reviews.length || teacher.ratingCount;

  const reserveHref = session?.user
    ? `/client/reserver?teacherId=${teacher.id}`
    : `/connexion?from=${encodeURIComponent(`/client/reserver?teacherId=${teacher.id}`)}`;

  return (
    <PublicLayout>
      {/* Breadcrumb */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Accueil</Link>
            <span>/</span>
            <Link href="/professeurs" className="hover:text-foreground">Professeurs</Link>
            <span>/</span>
            <span className="text-foreground">{displayName}</span>
          </nav>
        </div>
      </div>

      {/* HEADER */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/professeurs"
            className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </Link>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-muted sm:h-32 sm:w-32">
              {teacher.photoUrl ? (
                <Image
                  src={teacher.photoUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  sizes="128px"
                />
              ) : (
                <img
                  src={avatarFromName(displayName)}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              )}
              {teacher.badgeVerified && (
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white ring-4 ring-white">
                  <BadgeCheck className="h-5 w-5" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {displayName}
                </h1>
                {teacher.badgeRecommended && (
                  <Badge icon={<Sparkles className="h-3 w-3" />} color="primary">
                    Recommandé
                  </Badge>
                )}
                {teacher.badgePopular && (
                  <Badge icon={<TrendingUp className="h-3 w-3" />} color="accent">
                    Très demandé
                  </Badge>
                )}
                {teacher.badgePremium && (
                  <Badge icon={<Award className="h-3 w-3" />} color="primary">
                    Premium
                  </Badge>
                )}
                {teacher.badgeNew && (
                  <Badge color="muted">Nouveau</Badge>
                )}
              </div>
              <p className="mt-1.5 text-sm font-medium text-foreground sm:text-base">
                {teacher.jobTitle}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
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
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i <= Math.round(teacher.rating)
                            ? "fill-amber-400 text-amber-400"
                            : "fill-muted text-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {teacher.rating.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({teacher.ratingCount} avis)
                  </span>
                </div>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">
                  {teacher._count.bookings} réservations effectuées
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {teacher.offersHome && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/70">
                    <HomeIcon className="h-3 w-3" /> Cours à domicile
                  </span>
                )}
                {teacher.offersOnline && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/70">
                    <Video className="h-3 w-3" /> Cours en ligne
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENU */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* COLONNE PRINCIPALE */}
            <div className="space-y-6">
              {/* À propos */}
              <Card>
                <CardTitle icon={<BookOpen className="h-4 w-4" />}>
                  À propos de {displayName}
                </CardTitle>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
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
                      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        s.isPrimary
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-foreground/80"
                      }`}
                    >
                      {s.subject.name}
                      {s.isPrimary && (
                        <span className="text-[10px] uppercase tracking-wide">Principale</span>
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
                      className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80"
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
                    {teacher.zones.map((z) => (
                      <span
                        key={z.commune.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground/80"
                      >
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {z.commune.name}
                        {z.commune.zone && (
                          <span className="text-muted-foreground">· {z.commune.zone}</span>
                        )}
                      </span>
                    ))}
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
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[520px] border-separate border-spacing-1 text-sm">
                      <thead>
                        <tr>
                          <th className="w-32 text-left text-xs font-medium text-muted-foreground">
                            Créneau
                          </th>
                          {DAYS.map((d) => (
                            <th
                              key={d.key}
                              className="px-1 py-1.5 text-center text-xs font-medium text-muted-foreground"
                            >
                              {d.label.slice(0, 3)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SLOTS.map((slot) => (
                          <tr key={slot.key}>
                            <td className="py-1.5">
                              <div className="text-xs font-medium text-foreground">
                                {slot.label}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {slot.time}
                              </div>
                            </td>
                            {DAYS.map((d) => {
                              const available = availability?.[d.key]?.[slot.key];
                              return (
                                <td key={d.key} className="text-center">
                                  <div
                                    className={`mx-auto h-7 w-7 rounded-md ${
                                      available
                                        ? "bg-primary/15 text-primary"
                                        : "bg-muted text-muted-foreground/40"
                                    }`}
                                    title={`${d.label} ${slot.label} — ${available ? "Disponible" : "Indisponible"}`}
                                  >
                                    {available ? (
                                      <CheckCircle2 className="mx-auto h-7 w-7 p-1.5" />
                                    ) : (
                                      <span className="block pt-1.5 text-xs">—</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Ces disponibilités sont indicatives. Les créneaux exacts
                      sont confirmés lors de la réservation.
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
                    label="1 séance"
                    price={teacher.pricePerSession}
                    sub="Plein tarif"
                    highlight
                  />
                  <PriceTile
                    label="Pack 4 séances"
                    price={teacher.pricePack4}
                    sub={`${formatFCFA(Math.round(teacher.pricePack4 / 4))} / séance`}
                  />
                  <PriceTile
                    label="Pack 8 séances"
                    price={teacher.pricePack8}
                    sub={`${formatFCFA(Math.round(teacher.pricePack8 / 8))} / séance`}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Les packs permettent un suivi régulier à prix réduit. La
                  commission de la plateforme (20%) est incluse dans le prix
                  affiché.
                </p>
              </Card>

              {/* Avis clients */}
              <Card>
                <CardTitle icon={<Star className="h-4 w-4" />}>
                  Avis clients ({teacher.reviews.length})
                </CardTitle>

                {/* Répartition des notes */}
                {totalReviews > 0 && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
                    <div className="flex flex-col items-center justify-center rounded-xl bg-muted/50 p-4 text-center">
                      <div className="text-4xl font-bold text-foreground">
                        {teacher.rating.toFixed(1)}
                      </div>
                      <div className="mt-1 flex items-center">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i <= Math.round(teacher.rating)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {totalReviews} avis vérifiés
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {ratingBuckets.map((b) => {
                        const pct = totalReviews > 0 ? (b.count / totalReviews) * 100 : 0;
                        return (
                          <div key={b.star} className="flex items-center gap-2 text-xs">
                            <span className="flex w-12 items-center gap-0.5 text-muted-foreground">
                              {b.star}
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-amber-400"
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
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
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
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i <= r.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-muted text-muted"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {r.comment && (
                          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                            {r.comment}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Ce professeur n'a pas encore d'avis publié. Soyez le
                    premier à réserver et à laisser un avis après votre cours.
                  </p>
                )}
              </Card>
            </div>

            {/* COLONNE LATERALE — RÉCAP + RÉSERVER */}
            <aside className="lg:sticky lg:top-20 lg:h-fit">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tarif à partir de
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    <Money amount={teacher.pricePerSession} />
                  </span>
                  <span className="text-sm text-muted-foreground">/ séance</span>
                </div>

                <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  <Row label="Pack 4 séances" value={<Money amount={teacher.pricePack4} />} />
                  <Row label="Pack 8 séances" value={<Money amount={teacher.pricePack8} />} />
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
                            <Video className="h-3 w-3" /> Ligne
                          </span>
                        )}
                      </span>
                    }
                  />
                  <Row label="Commune" value={teacher.commune ?? "Abidjan"} />
                </div>

                <Link
                  href={reserveHref}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
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
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong className="text-foreground">Paiement sécurisé.</strong>{" "}
                      Fonds bloqués jusqu'à confirmation du cours.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong className="text-foreground">Professeur vérifié</strong> par
                      notre équipe (identité, diplômes).
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong className="text-foreground">Annulation</strong> possible
                      jusqu'à 24h avant le cours.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Luggage className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
      <span className="text-primary">{icon}</span>
      {children}
    </h2>
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
  price,
  sub,
  highlight,
}: {
  label: string;
  price: number;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        highlight
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/40"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">
        <Money amount={price} />
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Badge({
  icon,
  children,
  color,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  color: "primary" | "accent" | "muted";
}) {
  const cls =
    color === "primary"
      ? "bg-primary/10 text-primary"
      : color === "accent"
      ? "bg-orange-50 text-orange-700"
      : "bg-muted text-foreground/70";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {icon}
      {children}
    </span>
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
