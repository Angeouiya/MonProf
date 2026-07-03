import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ProfessorTrustBadges } from "@/components/shared/professor-trust-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  MessageSquare, BookOpen, ClipboardCheck, Eye, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { ReviewDialog } from "./review-dialog";
import { REVIEWABLE_BOOKING_STATUSES } from "@/lib/review-policy";

export const dynamic = "force-dynamic";

export default async function AvisPage() {
  const user = await getSessionUser();
  if (!user) return null;

  // Réservations validées par le client, sans avis
  const bookingsToReview = await db.booking.findMany({
    where: {
      clientId: user.id,
      status: { in: [...REVIEWABLE_BOOKING_STATUSES] },
      reviews: { none: { clientId: user.id } },
    },
    orderBy: [{ clientValidatedAt: "desc" }, { teacherPaidAt: "desc" }, { updatedAt: "desc" }],
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          professionalName: true,
          photoUrl: true,
          jobTitle: true,
          badgeVerified: true,
          badgeRecommended: true,
          badgePremium: true,
          badgePopular: true,
          badgeNew: true,
        },
      },
    },
  });

  // Avis déjà laissés
  const myReviews = await db.review.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          professionalName: true,
          photoUrl: true,
          jobTitle: true,
          badgeVerified: true,
          badgeRecommended: true,
          badgePremium: true,
          badgePopular: true,
          badgeNew: true,
        },
      },
      booking: { select: { id: true, reference: true, subjectName: true, levelName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes avis"
        description="Évaluez vos cours terminés et gardez un historique clair de vos retours qualité."
      />

      <section className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 min-[520px]:grid-cols-3">
          <ReviewCompactMetric icon={ClipboardCheck} label="À donner" value={bookingsToReview.length} active={bookingsToReview.length > 0} />
          <ReviewCompactMetric icon={MessageSquare} label="Envoyés" value={myReviews.length} />
          <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Qualité</p>
              <p className="mt-0.5 truncate text-sm font-black text-[#111827]">Suivi admin</p>
            </div>
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#111B4D]" />
          </div>
        </div>
      </section>

      {/* Avis à laisser */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black tracking-tight text-[#111827]">Avis à laisser</h2>
          <Badge variant="outline" className="border-[#E3E8F2] bg-white text-[#111B4D]">{bookingsToReview.length}</Badge>
        </div>
        {bookingsToReview.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Aucun avis en attente"
            description="Lorsque vous terminez un cours, vous pouvez laisser un avis au professeur."
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {bookingsToReview.map((b) => {
              const name = b.teacher.professionalName || b.teacher.fullName;
              return (
                <Card key={b.id} className="overflow-hidden rounded-[1.35rem]">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <ProfessorImage photoUrl={b.teacher.photoUrl} name={name} size={56} shape="circle" verified={b.teacher.badgeVerified} />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-black text-[#111827]">{name}</p>
                        <p className="break-words text-xs text-[#64748B]">
                          {b.subjectName} • {b.levelName}
                        </p>
                        <p className="break-words text-xs text-[#64748B]">Réf. {b.reference}</p>
                        <ProfessorTrustBadges
                          verified={b.teacher.badgeVerified}
                          recommended={b.teacher.badgeRecommended}
                          premium={b.teacher.badgePremium}
                          popular={b.teacher.badgePopular}
                          isNew={b.teacher.badgeNew}
                          size="sm"
                          maxSecondary={1}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 min-[460px]:grid-cols-2">
                      <Button asChild size="sm" variant="outline" className="min-h-11 rounded-2xl">
                        <Link href={`/professeurs/${b.teacher.id}`}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Profil
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="min-h-11 rounded-2xl">
                        <Link href={`/client/reservations/${b.id}`}>Réservation</Link>
                      </Button>
                    </div>
                    <ReviewDialog bookingId={b.id} teacherName={name} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Mes avis */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black tracking-tight text-[#111827]">Mes avis</h2>
          <Badge variant="outline" className="border-[#E3E8F2] bg-white text-[#111B4D]">{myReviews.length}</Badge>
        </div>
        {myReviews.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Aucun avis publié"
            description="Vos avis apparaîtront ici une fois publiés."
          />
        ) : (
          <div className="space-y-3">
            {myReviews.map((r) => {
              const name = r.teacher.professionalName || r.teacher.fullName;
              return (
                <Card key={r.id} className="rounded-[1.35rem]">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <ProfessorImage photoUrl={r.teacher.photoUrl} name={name} size="md" shape="circle" verified={r.teacher.badgeVerified} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                          <p className="break-words text-sm font-black text-[#111827]">{name}</p>
                          <span className="text-xs font-semibold text-[#64748B]">{formatDate(r.createdAt)}</span>
                        </div>
                        <p className="break-words text-xs text-[#64748B]">
                          {r.booking.subjectName} • {r.booking.levelName}
                        </p>
                        <ProfessorTrustBadges
                          verified={r.teacher.badgeVerified}
                          recommended={r.teacher.badgeRecommended}
                          premium={r.teacher.badgePremium}
                          popular={r.teacher.badgePopular}
                          isNew={r.teacher.badgeNew}
                          size="sm"
                          maxSecondary={1}
                          className="mt-2"
                        />
                        <Badge variant="outline" className="mt-2 border-[#111B4D] bg-white text-[#111B4D]">
                          Évaluation {r.rating}/5
                        </Badge>
                        {r.comment && (
                          <p className="mt-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-sm leading-6 text-[#111827]">{r.comment}</p>
                        )}
                        <div className="mt-3 grid gap-2 min-[460px]:grid-cols-2">
                          <Button asChild size="sm" variant="outline" className="min-h-11 rounded-2xl">
                            <Link href={`/professeurs/${r.teacher.id}`}>Profil professeur</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="min-h-11 rounded-2xl">
                            <Link href={`/client/reservations/${r.booking.id}`}>Dossier cours</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewCompactMetric({
  icon: Icon,
  label,
  value,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className={active ? "mt-0.5 text-lg font-black text-[#111B4D]" : "mt-0.5 text-lg font-black text-[#111827]"}>{value}</p>
      </div>
      <Icon className="h-4 w-4 shrink-0 text-[#111B4D]" />
    </div>
  );
}
