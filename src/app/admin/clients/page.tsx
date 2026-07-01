import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import Link from "next/link";
import { ClientsListClient } from "./list-client";
import { initials, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
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
        where: { paymentStatus: { notIn: ["FAILED"] } },
        select: { totalPrice: true },
      },
    },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Clients" description={`${clients.length} client(s)`} />

      <ClientsListClient q={q ?? ""} />

      {clients.length === 0 ? (
        <EmptyState icon={Users} title="Aucun client" description="Aucun client ne correspond." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden lg:table-cell">Commune</TableHead>
                  <TableHead className="text-right">Réservations</TableHead>
                  <TableHead className="text-right">Total dépensé</TableHead>
                  <TableHead className="hidden sm:table-cell">Inscrit le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const total = c.bookings.reduce((s, b) => s + b.totalPrice, 0);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-muted text-foreground text-xs">{initials(c.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <Link href={`/admin/clients/${c.id}`} className="text-sm font-medium text-foreground hover:text-primary">
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
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
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
