import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { PaymentStatusBadge, BookingStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Phone, Mail, MessageSquare } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/format";
import { DisputeActionsClient } from "./actions-client";
import { DisputeOperationalActionsClient } from "./dispute-operational-actions-client";

export const dynamic = "force-dynamic";

const BADGE_CLS: Record<string, string> = {
  OPEN: "border-red-200 bg-red-50 text-red-700",
  INVESTIGATING: "border-amber-200 bg-amber-50 text-amber-700",
  RESOLVED: "border-blue-200 bg-blue-50 text-blue-700",
  REFUNDED: "border-blue-200 bg-blue-50 text-blue-700",
  REJECTED: "border-slate-200 bg-slate-50 text-slate-700",
};
const LABELS: Record<string, string> = {
  OPEN: "Ouvert", INVESTIGATING: "Investigation", RESOLVED: "Résolu", REFUNDED: "Remboursé", REJECTED: "Rejeté",
};

export default async function LitigeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, email: true, badgeVerified: true } },
          client: { select: { id: true, name: true, phone: true, email: true } },
          transactions: { orderBy: { createdAt: "desc" } },
        },
      },
      openedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!dispute) notFound();

  return (
    <div className="space-y-5">
      <PageHeader title={`Litige — ${dispute.reason}`} description={`Ouvert ${timeAgo(dispute.createdAt)} par ${dispute.openedBy.name}`}>
        <Button asChild variant="outline">
          <Link href="/admin/litiges"><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={BADGE_CLS[dispute.status]}>{LABELS[dispute.status]}</Badge>
            <BookingStatusBadge status={dispute.booking.status} />
            <PaymentStatusBadge status={dispute.booking.paymentStatus} />
            <span className="text-sm text-muted-foreground">Réservation <Link href={`/admin/reservations/${dispute.booking.id}`} className="font-mono text-primary hover:underline">{dispute.booking.reference}</Link></span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Détails du litige</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Raison</p>
              <p className="font-medium">{dispute.reason}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="mt-1">{dispute.description || "—"}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Ouvert par</p>
              <p className="text-sm">{dispute.openedBy.name} ({dispute.openedBy.email})</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date d'ouverture</p>
              <p className="text-sm">{formatDateTime(dispute.createdAt)}</p>
            </div>
            {dispute.resolvedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Date résolution</p>
                <p className="text-sm">{formatDateTime(dispute.resolvedAt)}</p>
              </div>
            )}
            {dispute.resolution && (
              <>
                <Separator />
                <div className="rounded-2xl border border-violet-100 bg-white/75 p-3 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground">Résolution</p>
                  <p className="mt-1 text-sm">{dispute.resolution}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Parties</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Client</p>
              <Link href={`/admin/clients/${dispute.booking.client.id}`} className="font-medium hover:text-primary">{dispute.booking.client.name}</Link>
              <p className="flex items-center gap-2 mt-1 text-xs"><Phone className="h-3.5 w-3.5" /> {dispute.booking.client.phone ?? "—"}</p>
              <p className="flex items-center gap-2 text-xs"><Mail className="h-3.5 w-3.5" /> {dispute.booking.client.email}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Professeur</p>
              <div className="mt-1 flex items-center gap-2">
                <ProfessorImage
                  photoUrl={dispute.booking.teacher.photoUrl}
                  name={dispute.booking.teacher.professionalName || dispute.booking.teacher.fullName}
                  size="sm"
                  shape="circle"
                  verified={dispute.booking.teacher.badgeVerified}
                />
                <Link href={`/admin/professeurs/${dispute.booking.teacher.id}?tab=cours&bookingId=${dispute.booking.id}`} className="font-medium hover:text-primary">{dispute.booking.teacher.professionalName || dispute.booking.teacher.fullName}</Link>
              </div>
              <p className="flex items-center gap-2 mt-1 text-xs"><Phone className="h-3.5 w-3.5" /> {dispute.booking.teacher.phone}</p>
              <p className="flex items-center gap-2 text-xs"><Mail className="h-3.5 w-3.5" /> {dispute.booking.teacher.email ?? "—"}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold"><Money amount={dispute.booking.totalPrice} /></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Commission</p>
                <p className="font-semibold"><Money amount={dispute.booking.commissionAmount} /></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net prof</p>
                <p className="font-semibold"><Money amount={dispute.booking.teacherNetAmount} /></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DisputeOperationalActionsClient
        disputeId={dispute.id}
        reason={dispute.reason}
        description={dispute.description}
        booking={{
          id: dispute.booking.id,
          reference: dispute.booking.reference,
          subjectName: dispute.booking.subjectName,
          levelName: dispute.booking.levelName,
          totalPrice: dispute.booking.totalPrice,
          teacherNetAmount: dispute.booking.teacherNetAmount,
          paymentStatus: dispute.booking.paymentStatus,
          teacher: {
            id: dispute.booking.teacher.id,
            fullName: dispute.booking.teacher.fullName,
            professionalName: dispute.booking.teacher.professionalName,
            phone: dispute.booking.teacher.phone,
          },
          client: {
            id: dispute.booking.client.id,
            name: dispute.booking.client.name,
            phone: dispute.booking.client.phone,
          },
        }}
      />

      <DisputeActionsClient disputeId={dispute.id} status={dispute.status} />
    </div>
  );
}
