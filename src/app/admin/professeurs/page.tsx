import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { TeacherStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Plus, MoreHorizontal, Eye, Pencil, Ban, Bell, GraduationCap } from "lucide-react";
import Link from "next/link";
import { ProfesseursListClient } from "./list-client";
import { initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProfesseursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; subject?: string; commune?: string; badge?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const status = sp.status && sp.status !== "all" ? sp.status : undefined;
  const subject = sp.subject && sp.subject !== "all" ? sp.subject : undefined;
  const commune = sp.commune && sp.commune !== "all" ? sp.commune : undefined;
  const badge = sp.badge && sp.badge !== "all" ? sp.badge : undefined;

  const where: any = {};
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

  const [teachers, subjects, communes] = await Promise.all([
    db.teacher.findMany({
      where,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      include: {
        subjects: { include: { subject: true } },
        zones: { include: { commune: true } },
        _count: { select: { bookings: true, reviews: true } },
      },
    }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.commune.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Compute totals per teacher
  const teacherIds = teachers.map((t) => t.id);
  const financeAgg = teacherIds.length
    ? await db.transaction.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: teacherIds }, type: "CLIENT_PAYMENT", status: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] } },
        _sum: { amount: true },
      })
    : [];
  const financeMap = new Map(financeAgg.map((f) => [f.teacherId, f._sum.amount ?? 0]));
  const realizedAgg = teacherIds.length
    ? await db.booking.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: teacherIds }, status: { in: ["COURSE_DONE","PENDING_CLIENT_VALIDATION","VALIDATED_BY_CLIENT","PAYMENT_TO_RELEASE","TEACHER_PAID"] } },
        _count: { _all: true },
      })
    : [];
  const realizedMap = new Map(realizedAgg.map((r) => [r.teacherId, r._count._all]));

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
        filters={{ q: q ?? "", status: status ?? "", subject: subject ?? "", commune: commune ?? "", badge: badge ?? "" }}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name }))}
      />

      {teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Aucun professeur"
          description="Aucun professeur ne correspond à vos filtres."
          action={<Button asChild><Link href="/admin/professeurs/nouveau"><Plus className="mr-2 h-4 w-4" /> Ajouter un professeur</Link></Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professeur</TableHead>
                  <TableHead className="hidden md:table-cell">Spécialité</TableHead>
                  <TableHead className="hidden lg:table-cell">Commune</TableHead>
                  <TableHead className="hidden sm:table-cell">Note</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Cours réalisés</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Total généré</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => {
                  const primary = t.subjects.find((s) => s.isPrimary)?.subject ?? t.subjects[0]?.subject;
                  const communeName = t.zones[0]?.commune.name ?? t.commune ?? "—";
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={t.photoUrl ?? undefined} alt={t.fullName} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(t.fullName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link href={`/admin/professeurs/${t.id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                              {t.professionalName || t.fullName}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate">{t.jobTitle}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{primary?.name ?? "—"}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{communeName}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-medium">{t.rating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({t.ratingCount})</span>
                        </div>
                      </TableCell>
                      <TableCell><TeacherStatusBadge status={t.status} /></TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm tabular-nums">{realizedMap.get(t.id) ?? 0}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right"><Money amount={financeMap.get(t.id) ?? 0} className="text-sm" /></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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
                              <Link href={`/admin/professeurs/${t.id}?action=notify`}><Bell className="mr-2 h-4 w-4" /> Notifier pour un cours</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="text-red-600">
                              <Link href={`/admin/professeurs/${t.id}?action=suspend`}><Ban className="mr-2 h-4 w-4" /> Suspendre</Link>
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
      )}
    </div>
  );
}
