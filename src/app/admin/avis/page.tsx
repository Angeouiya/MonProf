import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EyeOff, MessageSquare, ShieldAlert, Users } from "lucide-react";
import { AvisClient } from "./client";
import { formatDate } from "@/lib/format";
import { ReviewOperationalActionsClient } from "@/components/admin/review-operational-actions-client";

export const dynamic = "force-dynamic";

const reviewAdminStatusLabel: Record<string, string> = {
  NEW: "Nouveau",
  TO_REVIEW: "À traiter",
  CONTACT_CLIENT: "Contacter client",
  CONTACT_TEACHER: "Contacter professeur",
  WARNING_SENT: "Avertissement envoyé",
  RESOLVED: "Résolu",
  ESCALATED: "Escaladé",
  DISMISSED: "Écarté",
};

const reviewAdminStatusClass: Record<string, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-800",
  TO_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  CONTACT_CLIENT: "border-violet-200 bg-violet-50 text-violet-800",
  CONTACT_TEACHER: "border-violet-200 bg-violet-50 text-violet-800",
  WARNING_SENT: "border-orange-200 bg-orange-50 text-orange-800",
  RESOLVED: "border-blue-200 bg-blue-50 text-blue-800",
  ESCALATED: "border-red-200 bg-red-50 text-red-800",
  DISMISSED: "border-slate-200 bg-slate-50 text-slate-700",
};

function reviewSeverity(rating: number) {
  if (rating <= 2) {
    return { label: "Critique", className: "border-red-200 bg-red-50 text-red-800" };
  }
  if (rating === 3) {
    return { label: "À surveiller", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  return null;
}

export default async function AdminAvisPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string; q?: string; status?: string }>;
}) {
  await requireAdmin("REVIEWS_MANAGE");
  const sp = await searchParams;
  const rating = sp.rating ? Number(sp.rating) : undefined;
  const q = sp.q?.trim();
  const status = sp.status;

  const where: any = {};
  if (rating && rating >= 1 && rating <= 5) where.rating = rating;
  if (status === "published") where.published = true;
  if (status === "hidden") where.published = false;
  if (status === "low") where.rating = { lte: 2 };
  if (status && reviewAdminStatusLabel[status]) where.adminStatus = status;
  if (q) {
    where.OR = [
      { comment: { contains: q } },
      { client: { name: { contains: q } } },
      { teacher: { OR: [{ fullName: { contains: q } }, { professionalName: { contains: q } }] } },
    ];
  }

  const reviews = await db.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
      booking: { select: { id: true, reference: true, subjectName: true, levelName: true } },
    },
    take: 200,
  });
  const lowReviews = reviews.filter((review) => review.rating <= 2).length;
  const hiddenReviews = reviews.filter((review) => !review.published).length;
  const publishedReviews = reviews.length - hiddenReviews;
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const impactedTeachers = new Set(reviews.filter((review) => review.rating <= 3).map((review) => review.teacher.id)).size;
  const reviewsToProcess = reviews.filter((review) => ["TO_REVIEW", "CONTACT_CLIENT", "CONTACT_TEACHER", "ESCALATED"].includes(review.adminStatus)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Avis & notes" description={`${reviews.length} avis`} rootPage />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ReviewSummaryCard label="Moyenne filtrée" value={reviews.length ? `${averageRating.toFixed(1)}/5` : "—"} detail={`${publishedReviews} publié(s)`} icon={MessageSquare} tone="blue" />
        <ReviewSummaryCard label="Avis critiques" value={`${lowReviews}`} detail="Notes 1/5 ou 2/5" icon={ShieldAlert} tone={lowReviews ? "red" : "blue"} />
        <ReviewSummaryCard label="Avis masqués" value={`${hiddenReviews}`} detail="À revoir ou modérer" icon={EyeOff} tone={hiddenReviews ? "amber" : "violet"} />
        <ReviewSummaryCard label="Profs impactés" value={`${impactedTeachers}`} detail="Notes 3/5 ou moins" icon={Users} tone={impactedTeachers ? "amber" : "blue"} />
        <ReviewSummaryCard label="À traiter" value={`${reviewsToProcess}`} detail="Suivi qualité ouvert" icon={MessageSquare} tone={reviewsToProcess ? "amber" : "violet"} />
      </div>

      <AvisClient filters={{ rating: rating ?? 0, q: q ?? "", status: status ?? "" }} />

      {reviews.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Aucun avis" description="Aucun avis ne correspond." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {reviews.map((r) => {
              const teacherName = r.teacher.professionalName || r.teacher.fullName;
              const severity = reviewSeverity(r.rating);
              return (
                <Card key={r.id} className="border-violet-100 bg-white">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProfessorImage
                          photoUrl={r.teacher.photoUrl}
                          name={teacherName}
                          size="sm"
                          shape="circle"
                          verified={r.teacher.badgeVerified}
                        />
                        <div className="min-w-0">
                          <Link href={`/admin/professeurs/${r.teacher.id}?tab=avis&bookingId=${r.booking.id}`} className="block truncate text-sm font-bold text-foreground">
                            {teacherName}
                          </Link>
                          <Link href={`/admin/clients/${r.client.id}`} className="block truncate text-xs text-muted-foreground">
                            Client : {r.client.name}
                          </Link>
                        </div>
                      </div>
                      <AvisClient review={{ id: r.id, published: r.published, adminStatus: r.adminStatus, adminNote: r.adminNote }} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                        Note {r.rating}/5
                      </Badge>
                      {severity && (
                        <Badge variant="outline" className={severity.className}>
                          {severity.label}
                        </Badge>
                      )}
                      {r.published ? (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Publié</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Masqué</Badge>
                      )}
                      <Badge variant="outline" className={reviewAdminStatusClass[r.adminStatus] ?? reviewAdminStatusClass.NEW}>
                        {reviewAdminStatusLabel[r.adminStatus] ?? r.adminStatus}
                      </Badge>
                    </div>

                    {r.comment ? (
                      <p className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-sm leading-relaxed text-foreground">
                        {r.comment}
                      </p>
                    ) : (
                      <p className="rounded-lg border border-dashed border-violet-100 bg-violet-50/30 p-3 text-sm text-muted-foreground">
                        Aucun commentaire laissé par le client.
                      </p>
                    )}

                    {r.adminNote && (
                      <div className="rounded-lg border border-blue-100 bg-blue-50/55 p-3 text-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-900/65">Note admin</p>
                        <p className="mt-1 leading-relaxed text-blue-950">{r.adminNote}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Cours</p>
                        <p className="mt-1 truncate text-xs font-bold text-foreground">{r.booking.subjectName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{r.booking.levelName}</p>
                      </div>
                      <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                        <p className="mt-1 text-xs font-bold text-foreground">{formatDate(r.createdAt)}</p>
                        <Link href={`/admin/reservations/${r.booking.id}`} className="block truncate text-[11px] font-medium text-primary">
                          {r.booking.reference}
                        </Link>
                      </div>
                    </div>

                    <ReviewOperationalActionsClient
                      reviewId={r.id}
                      teacherId={r.teacher.id}
                      teacherName={teacherName}
                      bookingId={r.booking.id}
                      bookingReference={r.booking.reference}
                      clientName={r.client.name}
                      rating={r.rating}
                      comment={r.comment}
                    />

                    <Button asChild variant="outline" className="h-11 w-full rounded-lg">
                      <Link href={`/admin/professeurs/${r.teacher.id}?tab=avis&bookingId=${r.booking.id}`}>
                        Voir la fiche professeur
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="hidden md:table-cell">Commentaire</TableHead>
                  <TableHead className="hidden lg:table-cell">Réservation</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => {
                  const severity = reviewSeverity(r.rating);
                  return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      <Link href={`/admin/clients/${r.client.id}`} className="inline-flex min-h-10 items-center hover:text-primary">
                        {r.client.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <ProfessorImage
                          photoUrl={r.teacher.photoUrl}
                          name={r.teacher.professionalName || r.teacher.fullName}
                          size="sm"
                          shape="circle"
                          verified={r.teacher.badgeVerified}
                        />
                        <Link href={`/admin/professeurs/${r.teacher.id}?tab=avis&bookingId=${r.booking.id}`} className="inline-flex min-h-10 items-center hover:text-primary">
                          {r.teacher.professionalName || r.teacher.fullName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1.5">
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          Note {r.rating}/5
                        </Badge>
                        {severity && (
                          <Badge variant="outline" className={severity.className}>
                            {severity.label}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm max-w-xs truncate">{r.comment ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      <Link href={`/admin/reservations/${r.booking.id}`} className="inline-flex min-h-10 items-center font-mono hover:text-primary">
                        {r.booking.reference}
                      </Link>
                      <p className="mt-1 text-muted-foreground">{r.booking.subjectName}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      {r.published ? (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Publié</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Masqué</Badge>
                      )}
                      <Badge variant="outline" className={`mt-1 ${reviewAdminStatusClass[r.adminStatus] ?? reviewAdminStatusClass.NEW}`}>
                        {reviewAdminStatusLabel[r.adminStatus] ?? r.adminStatus}
                      </Badge>
                      {r.adminNote && <p className="mt-1 max-w-[180px] truncate text-[11px] text-muted-foreground">{r.adminNote}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ReviewOperationalActionsClient
                          reviewId={r.id}
                          teacherId={r.teacher.id}
                          teacherName={r.teacher.professionalName || r.teacher.fullName}
                          bookingId={r.booking.id}
                          bookingReference={r.booking.reference}
                          clientName={r.client.name}
                          rating={r.rating}
                          comment={r.comment}
                          compact
                        />
                        <AvisClient review={{ id: r.id, published: r.published, adminStatus: r.adminStatus, adminNote: r.adminNote }} />
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ReviewSummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: any;
  tone: "blue" | "violet" | "amber" | "red";
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-950",
    violet: "border-violet-100 bg-violet-50/70 text-violet-950",
    amber: "border-amber-100 bg-amber-50/75 text-amber-950",
    red: "border-red-100 bg-red-50/75 text-red-950",
  }[tone];
  const iconClass = {
    blue: "text-blue-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${iconClass}`} />
      </div>
      <p className="mt-2 text-sm opacity-75">{detail}</p>
    </div>
  );
}
