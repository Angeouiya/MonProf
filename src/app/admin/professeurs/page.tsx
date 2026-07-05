import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { TeacherStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, ImageIcon, Plus, MoreHorizontal, Eye, Pencil, Ban, Bell, GraduationCap, ClipboardList, Wallet } from "lucide-react";
import Link from "next/link";
import { ProfesseursListClient } from "./list-client";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ProfessorTrustBadges } from "@/components/shared/professor-trust-badges";
import { computeTeacherQualityScore } from "@/lib/teacher-operations";
import { getTeacherAdjustedPayable, getTeacherPaidAmount, getTeacherRemainingAmount } from "@/lib/teacher-payments";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

export default async function AdminProfesseursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; subject?: string; commune?: string; badge?: string; photo?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const status = sp.status && sp.status !== "all" ? sp.status : undefined;
  const subject = sp.subject && sp.subject !== "all" ? sp.subject : undefined;
  const commune = sp.commune && sp.commune !== "all" ? sp.commune : undefined;
  const badge = sp.badge && sp.badge !== "all" ? sp.badge : undefined;
  const photo = sp.photo && sp.photo !== "all" ? sp.photo : undefined;

  const where: any = {};
  const andFilters: any[] = [];
  if (q) {
    where.OR = [
      { fullName: { contains: q } },
      { professionalName: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { jobTitle: { contains: q } },
    ];
  }
  if (status) where.status = status;
  if (subject) where.subjects = { some: { subject: { slug: subject } } };
  if (commune) where.zones = { some: { commune: { name: commune } } };
  if (badge === "verified") where.badgeVerified = true;
  if (badge === "recommended") where.badgeRecommended = true;
  if (badge === "new") where.badgeNew = true;
  if (badge === "popular") where.badgePopular = true;
  if (badge === "premium") where.badgePremium = true;
  if (badge === "featured") where.featured = true;
  if (photo === "missing") {
    andFilters.push({ OR: [{ photoUrl: null }, { photoUrl: "" }] });
  }
  if (photo === "with-photo") {
    andFilters.push({ AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] });
  }
  if (andFilters.length) where.AND = andFilters;

  const [teachers, subjects, communes, totalTeachersCount, missingPhotoCount, activeMissingPhotoCount] = await Promise.all([
    db.teacher.findMany({
      where,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      include: {
        subjects: { include: { subject: true } },
        zones: { include: { commune: true } },
        bookings: {
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            totalPrice: true,
            totalClientPays: true,
            teacherNetAmount: true,
            teacherPaidAmount: true,
            paydunyaStatus: true,
            paydunyaVerifiedAt: true,
            transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
          },
        },
        tasks: { orderBy: { createdAt: "desc" }, take: 50 },
        warnings: { orderBy: { createdAt: "desc" }, take: 50 },
        sanctions: { orderBy: { createdAt: "desc" }, take: 50 },
        oldReplacements: { orderBy: { createdAt: "desc" }, take: 50 },
        paymentAdjustments: { orderBy: { createdAt: "desc" }, take: 50 },
        _count: { select: { bookings: true, reviews: true } },
      },
    }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.commune.findMany({ orderBy: { name: "asc" } }),
    db.teacher.count(),
    db.teacher.count({ where: { OR: [{ photoUrl: null }, { photoUrl: "" }] } }),
    db.teacher.count({ where: { status: "ACTIVE", OR: [{ photoUrl: null }, { photoUrl: "" }] } }),
  ]);

  // Compute totals per teacher
  const teacherIds = teachers.map((t) => t.id);
  const realizedAgg = teacherIds.length
    ? await db.booking.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: teacherIds }, status: { in: ["COURSE_DONE","PENDING_CLIENT_VALIDATION","VALIDATED_BY_CLIENT","PAYMENT_TO_RELEASE","TEACHER_PAID"] } },
        _count: { _all: true },
      })
    : [];
  const realizedMap = new Map(realizedAgg.map((r) => [r.teacherId, r._count._all]));
  const teacherRows = teachers.map((t) => {
    const primary = t.subjects.find((s) => s.isPrimary)?.subject ?? t.subjects[0]?.subject;
    const communeName = (t.zones[0]?.commune as any)?.name ?? t.commune ?? "—";
    const displayName = t.professionalName || t.fullName;
    const hasPhoto = Boolean(t.photoUrl?.trim());
    const verifiedBookings = t.bookings.filter(hasVerifiedPayDunyaClientPayment);
    const totalGenerated = verifiedBookings.reduce((sum, booking) => sum + (booking.totalClientPays || booking.totalPrice), 0);
    const realized = realizedMap.get(t.id) ?? 0;
    const blocked = verifiedBookings
      .filter((booking) => booking.paymentStatus === "BLOCKED")
      .reduce((sum, booking) => sum + booking.teacherNetAmount, 0);
    const paid = verifiedBookings.reduce((sum, booking) => sum + getTeacherPaidAmount(booking), 0);
    const grossToPay = verifiedBookings
      .filter((booking) => booking.paymentStatus === "TO_PAY_TEACHER")
      .reduce((sum, booking) => sum + getTeacherRemainingAmount(booking, t.paymentAdjustments), 0);
    const toPay = getTeacherAdjustedPayable(grossToPay, t.paymentAdjustments);
    const lateTasks = t.tasks.filter((task) => task.status === "LATE").length;
    const criticalTasks = t.tasks.filter((task) => task.priority === "CRITICAL" && !["DONE", "CANCELLED"].includes(task.status)).length;
    const incidents = lateTasks + criticalTasks + t.warnings.length + t.sanctions.length + t.oldReplacements.length;
    const score = computeTeacherQualityScore({
      rating: t.rating,
      bookings: t.bookings,
      warnings: t.warnings,
      sanctions: t.sanctions,
      replacements: t.oldReplacements,
    });
    return {
      teacher: t,
      primary,
      communeName,
      displayName,
      hasPhoto,
      totalGenerated,
      realized,
      blocked,
      paid,
      toPay,
      lateTasks,
      criticalTasks,
      incidents,
      score,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Professeurs" description={`${teachers.length} professeur(s)`}>
        <Button asChild>
          <Link href="/admin/professeurs/nouveau">
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Link>
        </Button>
      </PageHeader>

      <ProfesseursListClient
        filters={{ q: q ?? "", status: status ?? "", subject: subject ?? "", commune: commune ?? "", badge: badge ?? "", photo: photo ?? "" }}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name }))}
      />

      <Card className={missingPhotoCount > 0 ? "border-amber-100 bg-amber-50/80" : "border-blue-100 bg-blue-50/65"}>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex gap-3">
            <span className={missingPhotoCount > 0 ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700"}>
              {missingPhotoCount > 0 ? <AlertTriangle className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
            </span>
            <div>
              <p className={missingPhotoCount > 0 ? "text-sm font-black text-amber-950" : "text-sm font-black text-blue-950"}>
                Contrôle photos professeurs
              </p>
              <p className={missingPhotoCount > 0 ? "mt-1 text-sm text-amber-950/75" : "mt-1 text-sm text-blue-950/75"}>
                {missingPhotoCount > 0
                  ? `${missingPhotoCount} professeur(s) sur ${totalTeachersCount} n'ont pas de photo exploitable. Les professeurs actifs sans photo sont bloqués côté public et doivent être corrigés.`
                  : `Tous les ${totalTeachersCount} professeur(s) ont une photo enregistrée. Les nouveaux profils actifs restent protégés par la validation serveur.`}
              </p>
              {activeMissingPhotoCount > 0 && (
                <p className="mt-2 text-xs font-bold text-red-700">
                  Attention : {activeMissingPhotoCount} professeur(s) actif(s) hérités sans photo doivent être désactivés ou complétés.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant={missingPhotoCount > 0 ? "default" : "outline"} className="rounded-lg">
              <Link href="/admin/professeurs?photo=missing">
                <ImageIcon className="mr-1.5 h-4 w-4" />
                Voir sans photo
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-lg bg-white">
              <Link href="/admin/professeurs/nouveau">
                <Plus className="mr-1.5 h-4 w-4" />
                Ajouter avec photo
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Aucun professeur"
          description="Aucun professeur ne correspond à vos filtres."
          action={<Button asChild><Link href="/admin/professeurs/nouveau"><Plus className="mr-2 h-4 w-4" /> Ajouter un professeur</Link></Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {teacherRows.map(({ teacher: t, primary, communeName, displayName, hasPhoto, totalGenerated, realized, blocked, paid, toPay, lateTasks, criticalTasks, incidents, score }) => {

              return (
                <Card key={t.id} className="border-violet-100 bg-white">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProfessorImage
                          photoUrl={t.photoUrl}
                          name={displayName}
                          size="md"
                          shape="circle"
                          verified={t.badgeVerified}
                        />
                        <div className="min-w-0">
                          <Link href={`/admin/professeurs/${t.id}`} className="inline-flex min-h-10 max-w-full items-center truncate text-sm font-bold text-foreground">
                            {displayName}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{t.jobTitle}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{primary?.name ?? "—"} · {communeName}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/professeurs/${t.id}`}><Eye className="mr-2 h-4 w-4" /> Voir</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/professeurs/${t.id}/modifier`}><Pencil className="mr-2 h-4 w-4" /> Modifier</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/professeurs/${t.id}?tab=operationnel&action=notify`}><Bell className="mr-2 h-4 w-4" /> Notifier pour un cours</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="text-red-600">
                            <Link href={`/admin/professeurs/${t.id}?tab=operationnel&action=suspend`}><Ban className="mr-2 h-4 w-4" /> Suspendre</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ProfessorTrustBadges
                        verified={t.badgeVerified}
                        recommended={t.badgeRecommended}
                        premium={t.badgePremium}
                        popular={t.badgePopular}
                        isNew={t.badgeNew}
                        size="sm"
                      />
                      {t.featured && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Mis en avant</Badge>}
                      {!hasPhoto && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">Photo manquante</Badge>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <TeacherStatusBadge status={t.status} />
                      <Badge variant="outline" className="border-violet-100 bg-white text-violet-800">
                        Note {t.rating.toFixed(1)}/5 · {t.ratingCount} avis
                      </Badge>
                      <Badge variant="outline" className={score >= 75 ? "border-blue-100 bg-blue-50 text-blue-800" : score >= 60 ? "border-amber-100 bg-amber-50 text-amber-800" : "border-red-100 bg-red-50 text-red-800"}>
                        Score qualité {score}/100
                      </Badge>
                      {incidents > 0 && (
                        <Badge variant="outline" className="border-red-100 bg-red-50 text-red-800">
                          {incidents} alerte(s)
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Cours réalisés</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-foreground">{realized}</p>
                      </div>
                      <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Total généré</p>
                        <Money amount={totalGenerated} className="mt-1 text-xs font-black" />
                      </div>
                      <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Réservations</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-foreground">{t._count.bookings}</p>
                      </div>
                      <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Avis</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-foreground">{t._count.reviews}</p>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                        <p className="text-[11px] font-medium text-blue-900/70">Fonds bloqués</p>
                        <Money amount={blocked} className="mt-1 text-xs font-black" />
                      </div>
                      <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2">
                        <p className="text-[11px] font-medium text-amber-900/70">Reste à payer</p>
                        <Money amount={toPay} className="mt-1 text-xs font-black" />
                        {paid > 0 && <p className="mt-1 text-[11px] text-amber-900/70">Payé: {paid.toLocaleString("fr-FR")} FCFA</p>}
                      </div>
                      <div className="rounded-lg border border-red-100 bg-red-50/55 px-3 py-2">
                        <p className="text-[11px] font-medium text-red-900/70">Tâches urgentes</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-red-950">{criticalTasks + lateTasks}</p>
                      </div>
                      <div className="rounded-lg border border-violet-100 bg-violet-50/55 px-3 py-2">
                        <p className="text-[11px] font-medium text-violet-900/70">Discipline</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-violet-950">{t.warnings.length + t.sanctions.length}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild className="h-11 rounded-lg">
                        <Link href={`/admin/professeurs/${t.id}`}><Eye className="mr-1.5 h-4 w-4" /> Fiche</Link>
                      </Button>
                      <Button asChild variant="outline" className="h-11 rounded-lg">
                        <Link href={`/admin/professeurs/${t.id}?tab=operationnel&action=notify`}><Bell className="mr-1.5 h-4 w-4" /> Notifier</Link>
                      </Button>
                      <Button asChild variant="outline" className="h-11 rounded-lg">
                        <Link href={`/admin/professeurs/${t.id}?tab=cours`}><ClipboardList className="mr-1.5 h-4 w-4" /> Mission</Link>
                      </Button>
                      <Button asChild variant="outline" className="h-11 rounded-lg">
                        <Link href={`/admin/professeurs/${t.id}?tab=paiements`}><Wallet className="mr-1.5 h-4 w-4" /> Comptabilité</Link>
                      </Button>
                    </div>
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
                  <TableHead>Professeur</TableHead>
                  <TableHead className="hidden md:table-cell">Spécialité</TableHead>
                  <TableHead className="hidden lg:table-cell">Commune</TableHead>
                  <TableHead className="hidden sm:table-cell">Note</TableHead>
                  <TableHead className="hidden xl:table-cell">Score qualité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Alertes</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Cours réalisés</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Fonds bloqués</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">À payer</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Total généré</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teacherRows.map(({ teacher: t, primary, communeName, hasPhoto, blocked, toPay, paid, totalGenerated, realized, criticalTasks, lateTasks, incidents, score }) => {
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ProfessorImage
                            photoUrl={t.photoUrl}
                            name={t.professionalName || t.fullName}
                            size="sm"
                            shape="circle"
                            verified={t.badgeVerified}
                          />
                          <div className="min-w-0">
                            <Link href={`/admin/professeurs/${t.id}`} className="inline-flex min-h-10 max-w-full items-center truncate text-sm font-medium text-foreground hover:text-primary">
                              {t.professionalName || t.fullName}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate">{t.jobTitle}</p>
                            <ProfessorTrustBadges
                              verified={t.badgeVerified}
                              recommended={t.badgeRecommended}
                              premium={t.badgePremium}
                              popular={t.badgePopular}
                              isNew={t.badgeNew}
                              size="sm"
                              maxSecondary={1}
                              className="mt-1"
                            />
                            {!hasPhoto && <Badge variant="outline" className="mt-1 border-red-200 bg-red-50 text-red-800">Photo manquante</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{primary?.name ?? "—"}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{communeName}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">Note {t.rating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({t.ratingCount})</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <Badge variant="outline" className={score >= 75 ? "border-blue-100 bg-blue-50 text-blue-800" : score >= 60 ? "border-amber-100 bg-amber-50 text-amber-800" : "border-red-100 bg-red-50 text-red-800"}>
                          {score}/100
                        </Badge>
                      </TableCell>
                      <TableCell><TeacherStatusBadge status={t.status} /></TableCell>
                      <TableCell className="hidden xl:table-cell text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={incidents > 0 ? "text-sm font-bold text-red-700" : "text-sm text-muted-foreground"}>{incidents}</span>
                          {(criticalTasks + lateTasks) > 0 && <span className="text-[11px] text-red-700">{criticalTasks + lateTasks} urgente(s)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm tabular-nums">{realized}</TableCell>
                      <TableCell className="hidden xl:table-cell text-right"><Money amount={blocked} className="text-sm" /></TableCell>
                      <TableCell className="hidden xl:table-cell text-right">
                        <Money amount={toPay} className="text-sm font-semibold" />
                        {paid > 0 && <p className="text-[11px] text-muted-foreground">Payé: {paid.toLocaleString("fr-FR")}</p>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right"><Money amount={totalGenerated} className="text-sm" /></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/professeurs/${t.id}`}><Eye className="mr-2 h-4 w-4" /> Voir</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/professeurs/${t.id}/modifier`}><Pencil className="mr-2 h-4 w-4" /> Modifier</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/professeurs/${t.id}?tab=operationnel&action=notify`}><Bell className="mr-2 h-4 w-4" /> Notifier pour un cours</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/professeurs/${t.id}?tab=cours`}><ClipboardList className="mr-2 h-4 w-4" /> Message mission</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/professeurs/${t.id}?tab=paiements`}><Wallet className="mr-2 h-4 w-4" /> Comptabilité</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="text-red-600">
                              <Link href={`/admin/professeurs/${t.id}?tab=operationnel&action=suspend`}><Ban className="mr-2 h-4 w-4" /> Suspendre</Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
