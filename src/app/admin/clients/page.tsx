import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CalendarCheck, Lock, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { ClientsListClient } from "./list-client";
import { initials, formatDate } from "@/lib/format";
import { verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin("CLIENTS_VIEW");
  const sp = await searchParams;
  const q = sp.q?.trim();

  const where: any = { role: "CLIENT" };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  const clients = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bookings: true } },
      bookings: {
        where: verifiedPayDunyaBookingWhere(),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          subjectName: true,
          status: true,
          paymentStatus: true,
          totalPrice: true,
          createdAt: true,
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
        },
      },
    },
    take: 200,
  });
  const clientsWithBooking = clients.filter((client) => client.bookings.length > 0).length;
  const clientsWithBlockedFunds = clients.filter((client) => client.bookings.some((booking) => booking.paymentStatus === "BLOCKED")).length;
  const clientsWithAction = clients.filter((client) =>
    client.bookings.some((booking) => ["PENDING_CLIENT_VALIDATION", "DISPUTED"].includes(booking.status) || ["BLOCKED", "TO_PAY_TEACHER", "DISPUTED"].includes(booking.paymentStatus)),
  ).length;
  const totalSecured = clients.reduce((sum, client) => sum + client.bookings.reduce((sub, booking) => sub + booking.totalPrice, 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Clients" description={`${clients.length} client(s)`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients" value={clients.length} icon={Users} tone="primary" />
        <StatCard label="Avec réservation" value={clientsWithBooking} icon={CalendarCheck} />
        <StatCard label="Fonds bloqués" value={clientsWithBlockedFunds} icon={Lock} tone={clientsWithBlockedFunds ? "warning" : "default"} />
        <StatCard label="À surveiller" value={clientsWithAction} icon={AlertTriangle} tone={clientsWithAction ? "danger" : "default"} />
      </div>

      <div className="rounded-lg border border-[#E6EAF3] bg-white p-4 text-sm font-semibold leading-6 text-[#64748B]">
        <p className="font-bold text-[#111827]">Portefeuille client suivi</p>
        <p className="mt-1">
          {clientsWithBooking} client(s) ont déjà réservé pour un volume sécurisé de <strong>{<Money amount={totalSecured} />}</strong>.
          Les dossiers avec fonds bloqués, litige ou confirmation client doivent rester visibles depuis cette liste.
        </p>
      </div>

      <ClientsListClient q={q ?? ""} />

      {clients.length === 0 ? (
        <EmptyState icon={Users} title="Aucun client" description="Aucun client ne correspond." />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {clients.map((c) => {
              const total = c.bookings.reduce((s, b) => s + b.totalPrice, 0);
              const blocked = c.bookings.filter((b) => b.paymentStatus === "BLOCKED").reduce((s, b) => s + b.totalPrice, 0);
              const latest = c.bookings[0];
              const latestTeacherName = latest ? latest.teacher.professionalName || latest.teacher.fullName : null;
              const action = getClientActionLabel(c.bookings);
              return (
                <Card key={c.id} className="border-[#E6EAF3] bg-white">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarFallback className="bg-[#111B4D] text-sm font-bold text-white">{initials(c.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/clients/${c.id}`} className="flex min-h-10 items-center truncate text-sm font-bold text-foreground">
                          {c.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{c.phone ?? "Téléphone non renseigné"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Réservations</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-foreground">{c._count.bookings}</p>
                      </div>
                      <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Total dépensé</p>
                        <Money amount={total} className="mt-1 text-xs font-black" />
                      </div>
                      <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Fonds bloqués</p>
                        <Money amount={blocked} className="mt-1 text-xs font-black" />
                      </div>
                      <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">Commune</p>
                        <p className="mt-1 truncate text-xs font-bold text-foreground">{c.commune ?? "—"}</p>
                      </div>
                    </div>

                    {latest && latestTeacherName && (
                      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-[#E6EAF3] bg-white p-3">
                        <ProfessorImage photoUrl={latest.teacher.photoUrl} name={latestTeacherName} size="sm" shape="circle" verified={latest.teacher.badgeVerified} />
                        <div className="min-w-0">
                          <Link href={`/admin/reservations/${latest.id}`} className="flex min-h-10 items-center truncate text-sm font-bold text-foreground">
                            {latest.reference} - {latest.subjectName}
                          </Link>
                          <Link href={`/admin/professeurs/${latest.teacher.id}?tab=cours&bookingId=${latest.id}`} className="block truncate text-xs text-muted-foreground">
                            {latestTeacherName}
                          </Link>
                        </div>
                      </div>
                    )}

                    <Badge variant="outline" className={action.className}>{action.label}</Badge>

                    <Button asChild className="h-11 w-full rounded-lg">
                      <Link href={`/admin/clients/${c.id}`}>Voir le client</Link>
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
                  <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden lg:table-cell">Commune</TableHead>
                  <TableHead className="text-right">Réservations</TableHead>
                  <TableHead className="text-right">Total dépensé</TableHead>
                  <TableHead className="hidden sm:table-cell">Dernière réservation</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Fonds bloqués</TableHead>
                  <TableHead className="text-right">Suivi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const total = c.bookings.reduce((s, b) => s + b.totalPrice, 0);
                  const blocked = c.bookings.filter((b) => b.paymentStatus === "BLOCKED").reduce((s, b) => s + b.totalPrice, 0);
                  const latest = c.bookings[0];
                  const action = getClientActionLabel(c.bookings);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-[#111B4D] text-xs text-white">{initials(c.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <Link href={`/admin/clients/${c.id}`} className="inline-flex min-h-10 items-center text-sm font-medium text-foreground hover:text-primary">
                              {c.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{c.phone ?? "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{c.commune ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{c._count.bookings}</TableCell>
                      <TableCell className="text-right"><Money amount={total} className="text-sm font-medium" /></TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {latest ? (
                          <div className="flex items-center gap-2">
                            <ProfessorImage
                              photoUrl={latest.teacher.photoUrl}
                              name={latest.teacher.professionalName || latest.teacher.fullName}
                              size="sm"
                              shape="circle"
                              verified={latest.teacher.badgeVerified}
                            />
                            <div className="min-w-0">
                              <Link href={`/admin/reservations/${latest.id}`} className="inline-flex min-h-10 max-w-full items-center truncate font-medium text-foreground hover:text-primary">
                                {latest.reference}
                              </Link>
                              <p className="truncate text-xs text-muted-foreground">{latest.subjectName}</p>
                            </div>
                          </div>
                        ) : (
                          formatDate(c.createdAt)
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right">
                        <Money amount={blocked} className="text-sm" muted={blocked === 0} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={action.className}>{action.label}</Badge>
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

function getClientActionLabel(bookings: { status: string; paymentStatus: string }[]) {
  if (bookings.some((booking) => booking.status === "DISPUTED" || booking.paymentStatus === "DISPUTED")) {
    return { label: "Litige", className: "border-red-200 bg-red-50 text-red-700" };
  }
  if (bookings.some((booking) => booking.status === "PENDING_CLIENT_VALIDATION")) {
    return { label: "Confirmation client", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (bookings.some((booking) => booking.paymentStatus === "BLOCKED")) {
    return { label: "Fonds bloqués", className: "border-[#D7DEE9] bg-white text-[#111B4D]" };
  }
  if (bookings.some((booking) => booking.paymentStatus === "TO_PAY_TEACHER")) {
    return { label: "Paiement prof", className: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  return { label: "Suivi normal", className: "border-blue-200 bg-blue-50 text-blue-700" };
}
