import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Banknote, Users } from "lucide-react";
import Link from "next/link";
import { formatFCFA, initials } from "@/lib/format";
import { PayAllTeacherButton } from "./pay-all-button";

export const dynamic = "force-dynamic";

export default async function AdminProfesseursAPayerPage() {
  await requireAdmin();
  const bookings = await db.booking.findMany({
    where: { paymentStatus: "TO_PAY_TEACHER" },
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      client: { select: { name: true } },
    },
    orderBy: { clientValidatedAt: "desc" },
    take: 200,
  });

  // Group by teacher
  const byTeacher = new Map<string, { teacher: any; bookings: typeof bookings; total: number }>();
  for (const b of bookings) {
    const key = b.teacherId;
    if (!byTeacher.has(key)) byTeacher.set(key, { teacher: b.teacher, bookings: [], total: 0 });
    const entry = byTeacher.get(key)!;
    entry.bookings.push(b);
    entry.total += b.teacherNetAmount;
  }
  const groups = Array.from(byTeacher.values()).sort((a, b) => b.total - a.total);
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Professeurs à payer" description="Regroupement des paiements à libérer par professeur" />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Net total à payer" value={formatFCFA(grandTotal)} icon={Banknote} tone="primary" />
        <StatCard label="Professeurs concernés" value={groups.length} icon={Users} />
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={Banknote} title="Aucun professeur à payer" description="Tous les paiements ont été libérés." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.teacher.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">{initials(g.teacher.fullName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Link href={`/admin/professeurs/${g.teacher.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {g.teacher.professionalName || g.teacher.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{g.bookings.length} cours à payer</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total à payer</p>
                    <p className="text-base font-semibold"><Money amount={g.total} /></p>
                  </div>
                  <PayAllTeacherButton
                    bookings={g.bookings.map((b) => ({ id: b.id, net: b.teacherNetAmount, ref: b.reference }))}
                    teacherName={g.teacher.professionalName || g.teacher.fullName}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.bookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/admin/reservations/${b.id}`} className="text-primary hover:underline">{b.reference}</Link>
                        </TableCell>
                        <TableCell className="text-sm">{b.client.name}</TableCell>
                        <TableCell className="text-right"><Money amount={b.teacherNetAmount} className="text-sm font-medium" /></TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/admin/reservations/${b.id}`}>Voir</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
