import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { TeacherStatusBadge, BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pencil, Bell, Star, MapPin, Phone, Mail, GraduationCap, Award,
  BookOpen, Wallet, CheckCircle2, Clock, Users, MessageSquare,
} from "lucide-react";
import { TeacherActionsClient } from "./actions-client";
import { formatFCFA, formatDate, formatDateTime, timeAgo, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Lundi" }, { key: "tue", label: "Mardi" }, { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" }, { key: "fri", label: "Vendredi" }, { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];
const SLOTS = [
  { key: "morning", label: "Matin" }, { key: "afternoon", label: "Après-midi" }, { key: "evening", label: "Soir" },
];

export default async function ProfesseurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;

  const teacher = await db.teacher.findUnique({
    where: { id },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { client: { select: { name: true } } },
        take: 100,
      },
      transactions: { orderBy: { createdAt: "desc" }, take: 50 },
      reviews: { include: { client: { select: { name: true } }, booking: { select: { reference: true } } }, orderBy: { createdAt: "desc" } },
      notifications: { orderBy: { createdAt: "desc" }, take: 30 },
      _count: { select: { bookings: true, reviews: true } },
    },
  });

  if (!teacher) notFound();

  const availability: any = teacher.availability ? JSON.parse(teacher.availability) : null;
  const primarySubject = teacher.subjects.find((s) => s.isPrimary)?.subject ?? teacher.subjects[0]?.subject;

  const realized = teacher.bookings.filter((b) => ["COURSE_DONE","PENDING_CLIENT_VALIDATION","VALIDATED_BY_CLIENT","PAYMENT_TO_RELEASE","TEACHER_PAID"].includes(b.status)).length;
  const cancelled = teacher.bookings.filter((b) => b.status === "CANCELLED").length;
  const refunded = teacher.bookings.filter((b) => b.status === "REFUNDED").length;
  const pending = teacher.bookings.filter((b) => ["PENDING_PAYMENT","PAID","PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS"].includes(b.status)).length;
  const disputed = teacher.bookings.filter((b) => b.status === "DISPUTED").length;
  const uniqueClients = new Set(teacher.bookings.map((b) => b.clientId)).size;

  const validBookings = teacher.bookings.filter((b) => b.paymentStatus !== "FAILED");
  const totalGenerated = validBookings.reduce((s, b) => s + b.totalPrice, 0);
  const totalCommission = validBookings.reduce((s, b) => s + b.commissionAmount, 0);
  const totalNet = validBookings.reduce((s, b) => s + b.teacherNetAmount, 0);
  const blockedFunds = teacher.bookings.filter((b) => b.paymentStatus === "BLOCKED").reduce((s, b) => s + b.teacherNetAmount, 0);
  const validatedFunds = teacher.bookings.filter((b) => b.paymentStatus === "VALIDATED").reduce((s, b) => s + b.teacherNetAmount, 0);
  const toPay = teacher.bookings.filter((b) => b.paymentStatus === "TO_PAY_TEACHER").reduce((s, b) => s + b.teacherNetAmount, 0);
  const alreadyPaid = teacher.bookings.filter((b) => b.paymentStatus === "TEACHER_PAID").reduce((s, b) => s + b.teacherNetAmount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={teacher.professionalName || teacher.fullName}
        description={teacher.jobTitle}
      >
        <Button asChild variant="outline">
          <Link href="/admin/professeurs">Retour</Link>
        </Button>
        <Button asChild>
          <Link href={`/admin/professeurs/${teacher.id}/modifier`}>
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Link>
        </Button>
      </PageHeader>

      {/* Header card */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            <AvatarImage src={teacher.photoUrl ?? undefined} alt={teacher.fullName} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg">{initials(teacher.fullName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{teacher.fullName}</h2>
              <TeacherStatusBadge status={teacher.status} />
              {teacher.featured && <Badge variant="secondary" className="bg-primary/10 text-primary">Mis en avant</Badge>}
              {teacher.badgeVerified && <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Vérifié</Badge>}
              {teacher.badgeRecommended && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Recommandé</Badge>}
              {teacher.badgePremium && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Premium</Badge>}
              {teacher.badgeNew && <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">Nouveau</Badge>}
              {teacher.badgePopular && <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">Populaire</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {teacher.rating.toFixed(1)} ({teacher.ratingCount} avis)</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {teacher.commune ?? "—"}</span>
              <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {teacher.phone}</span>
              {teacher.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {teacher.email}</span>}
            </div>
          </div>
          <TeacherActionsClient teacherId={teacher.id} teacherName={teacher.professionalName || teacher.fullName} />
        </CardContent>
      </Card>

      <Tabs defaultValue="infos">
        <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="matieres">Matières & Niveaux</TabsTrigger>
          <TabsTrigger value="tarifs">Tarifs</TabsTrigger>
          <TabsTrigger value="activite">Activité</TabsTrigger>
          <TabsTrigger value="cours">Cours</TabsTrigger>
          <TabsTrigger value="paiements">Paiements</TabsTrigger>
          <TabsTrigger value="avis">Avis</TabsTrigger>
          <TabsTrigger value="historique">Historique notifs</TabsTrigger>
        </TabsList>

        {/* INFOS */}
        <TabsContent value="infos" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Nom complet" value={teacher.fullName} />
                <InfoRow label="Nom professionnel" value={teacher.professionalName || "—"} />
                <InfoRow label="Téléphone" value={teacher.phone} />
                <InfoRow label="Email" value={teacher.email || "—"} />
                <InfoRow label="Commune" value={teacher.commune || "—"} />
                <InfoRow label="Quartier" value={teacher.quartier || "—"} />
                <InfoRow label="Adresse (indice)" value={teacher.addressHint || "—"} />
                <Separator />
                <InfoRow label="Titre" value={teacher.jobTitle} />
                <InfoRow label="Type de profil" value={teacher.profileType} />
                <InfoRow label="Expérience" value={`${teacher.experienceYears} an(s)`} />
                <InfoRow label="Diplôme" value={teacher.diploma || "—"} />
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Bio</p>
                  <p className="mt-1 text-foreground">{teacher.bio}</p>
                </div>
                {teacher.internalNote && (
                  <>
                    <Separator />
                    <div className="rounded-md bg-amber-50 p-3 text-amber-800">
                      <p className="text-xs font-medium">Note interne</p>
                      <p className="mt-1 text-sm">{teacher.internalNote}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Disponibilités</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                {availability ? (
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium text-muted-foreground">Jour</th>
                        {SLOTS.map((s) => <th key={s.key} className="px-3 py-2 text-center font-medium text-muted-foreground">{s.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((d) => (
                        <tr key={d.key} className="border-b border-border last:border-0">
                          <td className="py-2 font-medium">{d.label}</td>
                          {SLOTS.map((s) => {
                            const ok = !!availability[d.key]?.[s.key];
                            return (
                              <td key={s.key} className="px-3 py-2 text-center">
                                {ok ? <CheckCircle2 className="mx-auto h-4 w-4 text-primary" /> : <span className="text-muted-foreground">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune disponibilité renseignée.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Zones d'intervention</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {teacher.zones.length === 0 && <p className="text-sm text-muted-foreground">Aucune zone.</p>}
                {teacher.zones.map((z) => (
                  <Badge key={z.commune.id} variant="secondary" className="gap-1">
                    <MapPin className="h-3 w-3" /> {z.commune.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATIERES & NIVEAUX */}
        <TabsContent value="matieres">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Matières enseignées</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {teacher.subjects.map((s) => (
                  <div key={s.subject.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-primary" /> {s.subject.name}
                    </span>
                    {s.isPrimary && <Badge variant="secondary" className="bg-primary/10 text-primary">Principale</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Niveaux enseignés</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {teacher.levels.map((l) => (
                    <Badge key={l.level.id} variant="outline">{l.level.name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TARIFS */}
        <TabsContent value="tarifs">
          <Card>
            <CardHeader><CardTitle className="text-base">Tarification</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PriceCard label="Tarif / heure" amount={teacher.pricePerHour} />
                <PriceCard label="Tarif / séance" amount={teacher.pricePerSession} />
                <PriceCard label="Pack 4 séances" amount={teacher.pricePack4} />
                <PriceCard label="Pack 8 séances" amount={teacher.pricePack8} />
              </div>
              <Separator className="my-4" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBox label="Commission plateforme" value={`${teacher.commissionRate}%`} />
                <InfoBox label="Tier" value={teacher.pricingTier} />
                <InfoBox label="Net prof / séance" value={formatFCFA(Math.round(teacher.pricePerSession * (1 - teacher.commissionRate/100)))} />
                <InfoBox label="Net prof / Pack 8" value={formatFCFA(Math.round(teacher.pricePack8 * (1 - teacher.commissionRate/100)))} />
              </div>
              <Separator className="my-4" />
              <div className="flex flex-wrap gap-3">
                <Badge variant={teacher.offersHome ? "default" : "outline"}>À domicile</Badge>
                <Badge variant={teacher.offersOnline ? "default" : "outline"}>En ligne</Badge>
                <Badge variant={teacher.offersGroup ? "default" : "outline"}>Groupe</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITE */}
        <TabsContent value="activite">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Cours attribués" value={teacher.bookings.length} icon={GraduationCap} />
            <StatCard label="Cours réalisés" value={realized} icon={CheckCircle2} tone="success" />
            <StatCard label="En attente" value={pending} icon={Clock} tone="warning" />
            <StatCard label="Annulés" value={cancelled} icon={Clock} />
            <StatCard label="Remboursés" value={refunded} icon={Clock} />
            <StatCard label="En litige" value={disputed} icon={Clock} tone={disputed > 0 ? "danger" : "default"} />
            <StatCard label="Clients uniques" value={uniqueClients} icon={Users} />
            <StatCard label="Avis reçus" value={teacher._count.reviews} icon={MessageSquare} />
            <StatCard label="Note moyenne" value={teacher.rating.toFixed(1)} icon={Star} tone="primary" />
          </div>
        </TabsContent>

        {/* COURS */}
        <TabsContent value="cours">
          <Card>
            <CardHeader><CardTitle className="text-base">Cours du professeur</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden md:table-cell">Matière</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacher.bookings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Aucun cours.</TableCell>
                    </TableRow>
                  )}
                  {teacher.bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/admin/reservations/${b.id}`} className="text-sm font-medium text-primary hover:underline">{b.reference}</Link>
                      </TableCell>
                      <TableCell className="text-sm">{b.client.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{b.subjectName}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(b.scheduledDate ?? b.createdAt)}</TableCell>
                      <TableCell className="text-right"><Money amount={b.totalPrice} className="text-sm" /></TableCell>
                      <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAIEMENTS */}
        <TabsContent value="paiements" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total généré" value={formatFCFA(totalGenerated)} icon={Wallet} tone="primary" />
            <StatCard label="Commission plateforme" value={formatFCFA(totalCommission)} icon={Award} tone="warning" />
            <StatCard label="Net prof total" value={formatFCFA(totalNet)} icon={Wallet} tone="success" />
            <StatCard label="Déjà payé au prof" value={formatFCFA(alreadyPaid)} icon={CheckCircle2} tone="success" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Fonds bloqués" value={formatFCFA(blockedFunds)} icon={Clock} tone="warning" />
            <StatCard label="Fonds validés" value={formatFCFA(validatedFunds)} icon={CheckCircle2} />
            <StatCard label="À payer au prof" value={formatFCFA(toPay)} icon={Wallet} tone="danger" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Historique des transactions</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Commission</TableHead>
                    <TableHead className="text-right">Net prof</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacher.transactions.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Aucune transaction.</TableCell></TableRow>
                  )}
                  {teacher.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm font-mono">{t.reference}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{t.type}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                      <TableCell className="text-right"><Money amount={t.amount} className="text-sm" /></TableCell>
                      <TableCell className="text-right hidden md:table-cell"><Money amount={t.commission} className="text-sm" muted /></TableCell>
                      <TableCell className="text-right"><Money amount={t.teacherNet} className="text-sm font-medium" /></TableCell>
                      <TableCell><PaymentStatusBadge status={t.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AVIS */}
        <TabsContent value="avis">
          <Card>
            <CardHeader><CardTitle className="text-base">Avis reçus</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {teacher.reviews.length === 0 && <p className="text-sm text-muted-foreground">Aucun avis.</p>}
              {teacher.reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.client.name}</span>
                      <span className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map((i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                      {!r.published && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Masqué</Badge>}
                    </div>
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-foreground">{r.comment}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Réservation {r.booking.reference}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORIQUE NOTIFS */}
        <TabsContent value="historique">
          <Card>
            <CardHeader><CardTitle className="text-base">Notifications envoyées au professeur</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border max-h-[480px] overflow-y-auto">
                {teacher.notifications.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">Aucune notification envoyée.</li>}
                {teacher.notifications.map((n) => (
                  <li key={n.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{n.channel}</Badge>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDateTime(n.createdAt)} • {timeAgo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function PriceCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground"><Money amount={amount} /></p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
