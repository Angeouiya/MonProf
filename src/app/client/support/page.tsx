import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, avatarFromName } from "@/lib/format";
import { LifeBuoy, Mail, Phone, AlertTriangle } from "lucide-react";
import { DisputeForm } from "./dispute-form";

export const dynamic = "force-dynamic";

const DISPUTE_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "Ouvert", tone: "bg-orange-50 text-orange-700 border-orange-200" },
  INVESTIGATING: { label: "En cours d'examen", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  RESOLVED: { label: "Résolu", tone: "bg-green-50 text-green-700 border-green-200" },
  REFUNDED: { label: "Remboursé", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rejeté", tone: "bg-red-50 text-red-700 border-red-200" },
};

export default async function SupportPage() {
  const user = await getSessionUser();
  if (!user) return null;

  // Réservations sur lesquelles le client peut ouvrir un litige (pas déjà en litige)
  const eligibleBookings = await db.booking.findMany({
    where: {
      clientId: user.id,
      status: { in: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
      disputes: true,
    },
  });
  const bookableForDispute = eligibleBookings.filter((b) => b.disputes.length === 0);

  // Mes litiges
  const myDisputes = await db.dispute.findMany({
    where: { openedById: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true, reference: true, subjectName: true, levelName: true,
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support et litiges"
        description="Ouvrez un litige ou consultez nos coordonnées de support."
      />

      {/* Coordonnées support */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <LifeBuoy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Besoin d'aide ?</p>
              <p className="text-xs text-muted-foreground">Notre support vous répond sous 24-48h ouvrées.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
            <a href="tel:+22527220000" className="flex items-center gap-2 text-foreground hover:text-primary">
              <Phone className="h-4 w-4 text-primary" />
              +225 27 22 00 00 00
            </a>
            <a href="mailto:support@monprof.ci" className="flex items-center gap-2 text-foreground hover:text-primary">
              <Mail className="h-4 w-4 text-primary" />
              support@monprof.ci
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Ouvrir un litige */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-accent" />
            Ouvrir un litige
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookableForDispute.length === 0 ? (
            <EmptyState
              title="Aucune réservation éligible"
              description="Vous pouvez ouvrir un litige uniquement sur une réservation en cours ou récemment terminée."
            />
          ) : (
            <DisputeForm bookings={bookableForDispute.map((b) => ({
              id: b.id,
              reference: b.reference,
              subjectName: b.subjectName,
              levelName: b.levelName,
              teacherName: b.teacher.professionalName || b.teacher.fullName,
            }))} />
          )}
        </CardContent>
      </Card>

      {/* Mes litiges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Mes litiges ({myDisputes.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myDisputes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun litige ouvert.</p>
          ) : (
            myDisputes.map((d) => {
              const st = DISPUTE_STATUS_LABELS[d.status] ?? DISPUTE_STATUS_LABELS.OPEN;
              const name = d.booking.teacher.professionalName || d.booking.teacher.fullName;
              return (
                <div key={d.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{d.booking.reference}</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.tone}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground">{d.booking.subjectName} • {d.booking.levelName}</p>
                      <p className="text-xs text-muted-foreground">{name} • {formatDate(d.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                    <p><span className="font-medium text-foreground">Raison :</span> <span className="text-muted-foreground">{d.reason}</span></p>
                    <p className="mt-1"><span className="font-medium text-foreground">Description :</span> <span className="text-muted-foreground">{d.description}</span></p>
                    {d.resolution && (
                      <p className="mt-1"><span className="font-medium text-foreground">Résolution :</span> <span className="text-muted-foreground">{d.resolution}</span></p>
                    )}
                  </div>
                  <Button asChild variant="ghost" size="sm" className="mt-2 -ml-2">
                    <Link href={`/client/reservations/${d.booking.id}`}>Voir la réservation</Link>
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
