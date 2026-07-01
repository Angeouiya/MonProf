import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, avatarFromName } from "@/lib/format";
import { Star, BookOpen } from "lucide-react";
import { ReviewDialog } from "./review-dialog";

export const dynamic = "force-dynamic";

export default async function AvisPage() {
  const user = await getSessionUser();
  if (!user) return null;

  // Réservations TEACHER_PAID sans avis
  const bookingsToReview = await db.booking.findMany({
    where: {
      clientId: user.id,
      status: "TEACHER_PAID",
      reviews: { none: { clientId: user.id } },
    },
    orderBy: { teacherPaidAt: "desc" },
    include: {
      teacher: {
        select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true },
      },
    },
  });

  // Avis déjà laissés
  const myReviews = await db.review.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: {
        select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true },
      },
      booking: { select: { id: true, reference: true, subjectName: true, levelName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes avis"
        description="Partagez votre expérience et consultez les avis que vous avez laissés."
      />

      {/* Avis à laisser */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Avis à laisser ({bookingsToReview.length})</h2>
        {bookingsToReview.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Aucun avis en attente"
            description="Lorsque vous terminez un cours, vous pouvez laisser un avis au professeur."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bookingsToReview.map((b) => {
              const name = b.teacher.professionalName || b.teacher.fullName;
              return (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                        {b.teacher.photoUrl ? (
                          <Image src={b.teacher.photoUrl} alt={name} fill className="object-cover" />
                        ) : (
                          <img src={avatarFromName(name)} alt={name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.subjectName} • {b.levelName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">Réf. {b.reference}</p>
                      </div>
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
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Mes avis ({myReviews.length})</h2>
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
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                        {r.teacher.photoUrl ? (
                          <Image src={r.teacher.photoUrl} alt={name} fill className="object-cover" />
                        ) : (
                          <img src={avatarFromName(name)} alt={name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.booking.subjectName} • {r.booking.levelName}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                        {r.comment && (
                          <p className="mt-2 text-sm text-foreground">{r.comment}</p>
                        )}
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
