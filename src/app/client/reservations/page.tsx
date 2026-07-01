import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA, formatDate, avatarFromName } from "@/lib/format";
import { CalendarCheck, ArrowRight, Home, Video } from "lucide-react";
import { BookingStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const TABS: { id: string; label: string; statuses?: BookingStatus[] }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "encours", label: "En cours", statuses: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_CLIENT_VALIDATION", "PAYMENT_TO_RELEASE"] },
  { id: "aconfirmer", label: "À confirmer", statuses: ["PENDING_CLIENT_VALIDATION"] },
  { id: "terminees", label: "Terminées", statuses: ["VALIDATED_BY_CLIENT", "TEACHER_PAID"] },
  { id: "annulees", label: "Annulées", statuses: ["CANCELLED", "REFUNDED", "DISPUTED"] },
];

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;
  const tabId = sp.tab ?? "toutes";
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];

  const where: any = { clientId: user.id };
  if (tab.statuses) where.status = { in: tab.statuses };

  const bookings = await db.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      teacher: {
        select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes réservations"
        description="Suivez l'ensemble de vos cours réservés."
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/client/reservations?tab=${t.id}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tabId === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-white text-foreground/70 hover:bg-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Aucune réservation"
          description="Vous n'avez pas encore réservé de cours."
          action={
            <Button asChild size="sm">
              <Link href="/client/rechercher">Réserver un cours</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const name = b.teacher.professionalName || b.teacher.fullName;
            return (
              <Card key={b.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                        {b.teacher.photoUrl ? (
                          <Image src={b.teacher.photoUrl} alt={name} fill className="object-cover" />
                        ) : (
                          <img src={avatarFromName(name)} alt={name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{b.reference}</p>
                          <BookingStatusBadge status={b.status} />
                        </div>
                        <p className="truncate text-sm text-foreground">
                          {b.subjectName} • {b.levelName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {name} • {b.scheduledDate ? formatDate(b.scheduledDate) : formatDate(b.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {b.courseFormat === "HOME" ? (
                            <span className="inline-flex items-center gap-1"><Home className="h-3 w-3" /> Domicile</span>
                          ) : (
                            <span className="inline-flex items-center gap-1"><Video className="h-3 w-3" /> En ligne</span>
                          )}
                        </p>
                        <p className="text-sm font-semibold text-foreground"><Money amount={b.totalPrice} /></p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/client/reservations/${b.id}`}>
                          Détails <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
