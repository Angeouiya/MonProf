import Link from "next/link";
import { Handshake, CheckCircle2, Clock3, XCircle, WalletCards } from "lucide-react";
import { PartnerReferralStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { buildPartnerReferralSharePath, getPartnerPromotionWindow } from "@/lib/partner-referrals";
import { PartnerReferralActionsClient } from "./partner-referral-actions-client";

const STATUS_LABELS: Record<PartnerReferralStatus, string> = {
  DECLARED: "Déclarée",
  PAYMENT_CONFIRMED: "Paiement confirmé",
  PAYABLE: "À payer",
  PAID: "Payée",
  REJECTED: "Rejetée",
  EXPIRED: "Expirée",
};

const STATUS_CLASSES: Record<PartnerReferralStatus, string> = {
  DECLARED: "border-blue-200 bg-blue-50 text-blue-800",
  PAYMENT_CONFIRMED: "border-indigo-200 bg-indigo-50 text-indigo-800",
  PAYABLE: "border-amber-200 bg-amber-50 text-amber-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
  EXPIRED: "border-slate-200 bg-slate-50 text-slate-700",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  DECLARED: "Pré-déclarée",
  MATCHED: "Rattachée",
  EXPIRED: "Expirée",
  REJECTED: "Rejetée",
};

const LEAD_STATUS_CLASSES: Record<string, string> = {
  DECLARED: "border-blue-200 bg-blue-50 text-blue-800",
  MATCHED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  EXPIRED: "border-slate-200 bg-slate-50 text-slate-700",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
};

export default async function AdminPartenariatsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireAdmin("FINANCE_VIEW");
  const params = await searchParams;
  const selectedStatus = isPartnerReferralStatus(params?.status) ? params.status : undefined;
  const where = selectedStatus ? { status: selectedStatus } : {};

  const [items, counts, sums, leads] = await Promise.all([
    db.partnerReferral.findMany({
      where,
      orderBy: [{ status: "asc" }, { declaredAt: "desc" }],
      take: 80,
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        teacher: { select: { id: true, fullName: true, professionalName: true } },
        booking: {
          select: {
            id: true,
            reference: true,
            subjectName: true,
            levelName: true,
            courseCategory: true,
            schoolSystem: true,
            status: true,
            paymentStatus: true,
            courseAmount: true,
            transportFee: true,
            paymentServiceFeeAmount: true,
            totalClientPays: true,
          },
        },
      },
    }),
    db.partnerReferral.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { commissionAmount: true },
    }),
    db.partnerReferral.aggregate({
      _sum: { courseAmount: true, commissionAmount: true },
      _count: { _all: true },
    }),
    db.partnerReferralLead.findMany({
      orderBy: [{ status: "asc" }, { declaredAt: "desc" }],
      take: 40,
    }),
  ]);

  const countsByStatus = new Map(counts.map((item) => [item.status, item]));
  const payableAmount = countsByStatus.get("PAYABLE")?._sum.commissionAmount ?? 0;
  const paidAmount = countsByStatus.get("PAID")?._sum.commissionAmount ?? 0;
  const { startsAt, endsAt } = getPartnerPromotionWindow();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Partenariats"
        description="Suivi des apporteurs d’affaires : déclaration pendant la promotion, paiement Jèko confirmé, réservation validée, commission de 10 % sur le montant cours hors transport/frais."
        rootPage
      >
        <Button asChild variant="outline">
          <Link href="/partenariat">Voir la page publique</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Handshake} label="Déclarations" value={`${sums._count._all}`} detail={`${formatDate(startsAt)} → ${formatDate(endsAt)} · ${leads.length} lien(s)`} />
        <MetricCard icon={WalletCards} label="Commissions totales" value={formatFCFA(sums._sum.commissionAmount ?? 0)} detail="10 % du montant cours uniquement" />
        <MetricCard icon={Clock3} label="À payer" value={formatFCFA(payableAmount)} detail={`${countsByStatus.get("PAYABLE")?._count._all ?? 0} dossier(s)`} />
        <MetricCard icon={CheckCircle2} label="Déjà payé" value={formatFCFA(paidAmount)} detail={`${countsByStatus.get("PAID")?._count._all ?? 0} dépôt(s)`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pré-déclarations apporteurs</CardTitle>
          <p className="text-sm font-medium leading-6 text-[#64748B]">
            Ces dossiers viennent du formulaire mobile apporteur. Ils restent en attente tant qu’un client ne réserve pas avec le lien généré.
          </p>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="Aucune pré-déclaration"
              description="Les liens créés par les apporteurs apparaîtront ici avant d’être rattachés à une réservation."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {leads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-[#E3E8F2] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Code</p>
                      <Link href={buildPartnerReferralSharePath(lead.code, lead.requestedJourney)} className="mt-1 inline-flex text-lg font-black text-[#111B4D] hover:underline">
                        {lead.code}
                      </Link>
                    </div>
                    <Badge variant="outline" className={LEAD_STATUS_CLASSES[lead.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}>
                      {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <InfoBlock label="Apporteur" value={lead.promoterName} detail={lead.promoterPhone} />
                    <InfoBlock label="Client annoncé" value={lead.expectedClientName || "Non renseigné"} detail={lead.expectedClientPhone || lead.requestedJourney || "—"} />
                  </div>
                  <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
                    Déclaré le {formatDate(lead.declaredAt)} · valable jusqu’au {formatDate(lead.promotionEndsAt)}
                    {lead.matchedBookingId ? ` · réservation rattachée ${lead.matchedBookingId}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between">
            <CardTitle className="text-base">Registre des commissions</CardTitle>
            <div className="flex flex-wrap gap-2">
              <FilterLink label="Tous" href="/admin/partenariats" active={!selectedStatus} />
              {Object.values(PartnerReferralStatus).map((status) => (
                <FilterLink key={status} label={STATUS_LABELS[status]} href={`/admin/partenariats?status=${status}`} active={selectedStatus === status} />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icon={XCircle}
              title="Aucune déclaration"
              description="Les commissions apparaîtront ici dès qu’un client déclare un apporteur au moment de réserver."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dossier</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Apporteur</TableHead>
                    <TableHead>Formation</TableHead>
                    <TableHead>Montants</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="min-w-44">
                        <Link href={`/admin/reservations/${item.booking.id}`} className="font-semibold text-[#111B4D] hover:underline">
                          {item.booking.reference}
                        </Link>
                        <p className="mt-1 text-xs font-medium text-[#64748B]">Déclaré le {formatDate(item.declaredAt)}</p>
                        <p className="mt-1 text-xs font-medium text-[#64748B]">Promo valable jusqu’au {formatDate(item.promotionEndsAt)}</p>
                      </TableCell>
                      <TableCell className="min-w-48">
                        <p className="font-semibold text-[#111827]">{item.client.name}</p>
                        <p className="text-xs text-[#64748B]">{item.client.phone || item.client.email || "Contact non renseigné"}</p>
                      </TableCell>
                      <TableCell className="min-w-52">
                        <p className="font-semibold text-[#111827]">{item.promoterName}</p>
                        <p className="text-xs text-[#64748B]">{item.promoterPhone || "Téléphone non renseigné"}</p>
                        {item.promoterIdentityName && <p className="mt-1 text-xs font-semibold text-emerald-700">Pièce : {item.promoterIdentityName}</p>}
                      </TableCell>
                      <TableCell className="min-w-56">
                        <p className="font-semibold text-[#111827]">{item.booking.subjectName}</p>
                        <p className="text-xs text-[#64748B]">{item.booking.levelName} · {journeyLabel(item.booking.schoolSystem, item.booking.courseCategory)}</p>
                        <p className="text-xs text-[#64748B]">Prof : {item.teacher?.professionalName || item.teacher?.fullName || "—"}</p>
                      </TableCell>
                      <TableCell className="min-w-52">
                        <AmountLine label="Cours" value={item.courseAmount} />
                        <AmountLine label="Transport exclu" value={item.booking.transportFee} muted />
                        <AmountLine label="Frais service exclus" value={item.booking.paymentServiceFeeAmount} muted />
                        <AmountLine label={`Commission ${item.commissionRate} %`} value={item.commissionAmount} strong />
                      </TableCell>
                      <TableCell className="min-w-44">
                        <Badge variant="outline" className={STATUS_CLASSES[item.status]}>
                          {STATUS_LABELS[item.status]}
                        </Badge>
                        <p className="mt-2 text-xs text-[#64748B]">Paiement : {item.booking.paymentStatus}</p>
                        <p className="text-xs text-[#64748B]">Réservation : {item.booking.status}</p>
                      </TableCell>
                      <TableCell className="min-w-[24rem]">
                        <PartnerReferralActionsClient referralId={item.id} status={item.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold text-[#111827]">{value}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={active
        ? "inline-flex min-h-9 items-center rounded-lg border border-[#111B4D] bg-[#111B4D] px-3 text-xs font-semibold text-white"
        : "inline-flex min-h-9 items-center rounded-lg border border-[#DDE6F7] bg-white px-3 text-xs font-semibold text-[#111827]"}
    >
      {label}
    </Link>
  );
}

function AmountLine({ label, value, strong = false, muted = false }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 text-xs ${strong ? "font-bold text-[#111B4D]" : muted ? "font-medium text-[#64748B]" : "font-semibold text-[#111827]"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatFCFA(value)}</span>
    </div>
  );
}

function InfoBlock({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#111827]">{value}</p>
      {detail && <p className="mt-0.5 truncate text-xs font-medium text-[#64748B]">{detail}</p>}
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function journeyLabel(schoolSystem: string | null, courseCategory: string | null) {
  if (["formation_professionnelle", "apprentissage_metier", "enseignement_superieur", "langues_communication"].includes(courseCategory || "")) return "Professionnel";
  if (schoolSystem === "francais") return "Système français";
  if (schoolSystem === "ivoirien") return "Système ivoirien";
  return "Parcours";
}

function isPartnerReferralStatus(value: unknown): value is PartnerReferralStatus {
  return typeof value === "string" && Object.values(PartnerReferralStatus).includes(value as PartnerReferralStatus);
}
