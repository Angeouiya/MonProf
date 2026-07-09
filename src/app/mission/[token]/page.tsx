import { notFound } from "next/navigation";
import { BookOpen, Clock, LockKeyhole, Mail, MapPin, MessageCircle, Phone, ShieldCheck, TimerReset, Users, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatFCFA } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MissionActions } from "./mission-actions";
import { ProfessorImage } from "@/components/shared/professor-image";
import { buildWhatsAppUrl } from "@/lib/phone";
import { MissionCopyPanel } from "./mission-copy-panel";
import { parsePricingSnapshot } from "@/lib/pricing";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

export default async function TeacherMissionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const mission = await db.teacherMissionLink.findUnique({
    where: { token },
    include: {
      teacher: true,
      booking: {
        include: {
          client: true,
          transactions: { where: { type: "CLIENT_PAYMENT" } },
        },
      },
    },
  });
  if (!mission) notFound();
  if (!hasVerifiedPayDunyaClientPayment(mission.booking)) {
    return (
      <main className="min-h-screen bg-white px-4 py-10">
        <div className="mx-auto max-w-xl rounded-lg border border-[#E3E8F2] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-normal text-[#111827]">Mission non activée</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
            Cette mission n'est pas disponible tant que le paiement PayDunya n'a pas été confirmé par vérification serveur. Contactez le service client Compétence si vous avez reçu ce lien par erreur.
          </p>
        </div>
      </main>
    );
  }
  const settingsRows = await db.setting.findMany({
    where: { key: { in: ["support_phone", "support_email"] } },
  });
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));

  const expired = mission.expiresAt < new Date();
  const locked = expired || ["CONFIRMED", "UNAVAILABLE", "PROBLEM_REPORTED", "EXPIRED", "REPLACEMENT_RECOMMENDED"].includes(mission.status);
  const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
  const booking = mission.booking;
  const pricingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
  const statusLabel = getMissionStatusLabel(expired ? "EXPIRED" : mission.status);
  const statusTone = getMissionStatusTone(expired ? "EXPIRED" : mission.status);
  const groupLabel = booking.participantsCount > 1
    ? `Petit groupe (${booking.participantsCount} participants)`
    : "Cours individuel";
  const locationLabel = booking.courseFormat === "ONLINE"
    ? booking.onlineLink || "Lien en ligne à confirmer"
    : `${booking.commune || "—"} ${booking.quartier || ""} ${booking.addressHint || ""}`.trim();
  const supportPhone = settings.support_phone || "";
  const supportEmail = settings.support_email || "";
  const supportMessage = [
    `Bonjour Compétence, je suis ${teacherName}.`,
    `Je vous contacte au sujet de la mission ${booking.reference}.`,
    `Cours : ${booking.subjectName} - ${booking.levelName}.`,
  ].join("\n");
  const supportWhatsAppUrl = buildWhatsAppUrl(supportPhone, supportMessage);
  const clientMessage = [
    `Bonjour ${booking.client.name},`,
    `Je suis ${teacherName}, votre professeur pour le cours ${booking.subjectName} (${booking.levelName}) avec Compétence.`,
    `Je vous contacte au sujet de la réservation ${booking.reference}.`,
  ].join("\n");
  const clientWhatsAppUrl = buildWhatsAppUrl(booking.client.phone, clientMessage);
  const clientPhoneHref = booking.client.phone ? `tel:${booking.client.phone.replace(/\s+/g, "")}` : "";
  const displayCourseDate = booking.scheduledDate ?? booking.startDate;
  const missionSummary = [
    `Mission Compétence - ${booking.reference}`,
    `Professeur : ${teacherName}`,
    `Client : ${booking.client.name}`,
    `Contact client : ${booking.client.phone || "À confirmer par le service client"}`,
    `Cours : ${booking.subjectName} - ${booking.levelName}`,
    `Date : ${displayCourseDate ? formatDate(displayCourseDate) : "À confirmer"}`,
    `Heure : ${booking.scheduledTime || booking.preferredTime || "À confirmer"}`,
    `Format : ${booking.courseFormat === "HOME" ? "Cours à domicile" : "Cours en ligne"}`,
    `Type : ${groupLabel}`,
    `Nombre de séance(s) : ${booking.sessionsCount} séance(s) de 2h`,
    `Lieu : ${locationLabel || "À confirmer"}`,
    pricingSnapshot?.transportRouteLabel ? `Trajet : ${pricingSnapshot.transportRouteLabel}` : "",
    booking.isQuoteOnly ? "Montant : prix finalisé par le service client" : `Part cours : ${formatFCFA(booking.teacherPayoutAmount || booking.teacherNetAmount)}`,
    !booking.isQuoteOnly && booking.transportFee > 0 ? `Frais déplacement : ${formatFCFA(booking.transportFee)}` : "",
    booking.isQuoteOnly ? "" : `Total à recevoir : ${formatFCFA(booking.teacherNetAmount)}`,
    mission.instructions ? `Consignes service client : ${mission.instructions}` : "Consignes service client : confirmer rapidement la disponibilité.",
  ].filter(Boolean).join("\n");

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-[#111827]">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-4 py-2 text-sm font-semibold text-[#111B4D]">
            <ShieldCheck className="h-4 w-4" /> Compétence - Mission professeur sécurisée
          </div>
          <div className="mt-5 flex justify-center">
            <ProfessorImage
              photoUrl={mission.teacher.photoUrl}
              name={teacherName}
              size="xl"
              shape="circle"
              verified={mission.teacher.badgeVerified}
            />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-normal text-[#111827] sm:text-4xl">{mission.title}</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">Bonjour {teacherName}, consultez les détails et confirmez votre disponibilité.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MissionSignalCard
            icon={<LockKeyhole className="h-4 w-4" />}
            label="Accès privé"
            value="Mission uniquement"
            description="Ce lien ne donne accès ni à votre profil, ni à d'autres cours."
            tone="blue"
          />
          <MissionSignalCard
            icon={<TimerReset className="h-4 w-4" />}
            label="Expiration"
            value={expired ? "Expiré" : formatDateTime(mission.expiresAt)}
            description={expired ? "Contactez le service client pour une mise à jour." : "Répondez avant cette limite."}
            tone={expired ? "red" : "amber"}
          />
          <MissionSignalCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Statut réponse"
            value={statusLabel}
            description="Votre réponse est transmise au service client."
            tone={expired ? "red" : mission.status === "CONFIRMED" ? "blue" : "violet"}
          />
        </div>

        <MissionCopyPanel
          token={token}
          missionSummary={missionSummary}
          clientMessage={clientMessage}
          supportMessage={supportMessage}
          clientWhatsAppUrl={clientWhatsAppUrl}
          supportWhatsAppUrl={supportWhatsAppUrl}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              Détails du cours
              <Badge variant="outline" className={statusTone}>
                {statusLabel}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Client" value={booking.client.name} />
            <Info label="Contact client" value={booking.client.phone || "—"} icon={<Phone className="h-4 w-4" />} />
            <Info label="Matière" value={booking.subjectName} />
            <Info label="Niveau" value={booking.levelName} />
            <Info label="Date" value={displayCourseDate ? formatDate(displayCourseDate) : "À confirmer"} icon={<Clock className="h-4 w-4" />} />
            <Info label="Heure" value={booking.scheduledTime || booking.preferredTime} />
            <Info label="Format" value={booking.courseFormat === "HOME" ? "Cours à domicile" : "Cours en ligne"} />
            <Info label="Type" value={groupLabel} icon={<Users className="h-4 w-4" />} />
            <Info label="Séances" value={`${booking.sessionsCount} séance(s) de 2h`} />
            <Info label="Part cours" value={booking.isQuoteOnly ? "Prix à finaliser" : formatFCFA(booking.teacherPayoutAmount || booking.teacherNetAmount)} icon={<Wallet className="h-4 w-4" />} />
            <Info label="Déplacement" value={booking.isQuoteOnly ? "À confirmer" : formatFCFA(booking.transportFee)} icon={<Wallet className="h-4 w-4" />} />
            <Info label="Total à recevoir" value={booking.isQuoteOnly ? "Prix à finaliser" : formatFCFA(booking.teacherNetAmount)} icon={<Wallet className="h-4 w-4" />} />
            {pricingSnapshot?.transportRouteLabel && (
              <Info label="Trajet déplacement" value={pricingSnapshot.transportRouteLabel} icon={<MapPin className="h-4 w-4" />} />
            )}
            <div className="sm:col-span-2">
              <Info label="Lieu" value={locationLabel} icon={<MapPin className="h-4 w-4" />} />
            </div>
            {(booking.objective || booking.schoolProgram || booking.needDescription || booking.message) && (
              <div className="sm:col-span-2 rounded-lg border border-[#E3E8F2] bg-white p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  <BookOpen className="h-4 w-4" /> Détails pédagogiques
                </p>
                <div className="mt-3 space-y-2 text-sm text-[#111827]">
                  {booking.objective && <MissionText label="Objectif" value={booking.objective} />}
                  {booking.schoolProgram && <MissionText label="Programme / contexte" value={booking.schoolProgram} />}
                  {booking.needDescription && <MissionText label="Besoin précis" value={booking.needDescription} />}
                  {booking.message && <MissionText label="Message client" value={booking.message} />}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact client pour cette mission</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Utilisez ces actions uniquement pour organiser ce cours. Si l'information semble incorrecte, contactez le service client.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {clientPhoneHref ? (
                <Button asChild variant="outline" className="h-11 rounded-lg">
                  <a href={clientPhoneHref}>
                    <Phone className="mr-2 h-4 w-4" />
                    Appeler le client
                  </a>
                </Button>
              ) : (
                <Button variant="outline" className="h-11 rounded-lg" disabled>
                  <Phone className="mr-2 h-4 w-4" />
                  Numéro client absent
                </Button>
              )}
              {clientWhatsAppUrl ? (
                <Button asChild variant="outline" className="h-11 rounded-lg border-[#DDE6F7] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                  <a href={clientWhatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp client
                  </a>
                </Button>
              ) : (
                <Button variant="outline" className="h-11 rounded-lg" disabled>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp indisponible
                </Button>
              )}
            </div>
            <div className="rounded-lg border border-[#E3E8F2] bg-white p-4 text-sm text-[#111827]">
              <p><span className="font-semibold">Client :</span> {booking.client.name}</p>
              <p className="mt-1"><span className="font-semibold">Téléphone :</span> {booking.client.phone || "Non renseigné"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Consignes service client</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg border border-[#E3E8F2] bg-white p-4 text-sm font-medium leading-6 text-[#64748B]">
              {mission.instructions || "Merci de confirmer rapidement votre disponibilité et de contacter le service client si une information manque."}
            </p>
            {locked && (
              <div className="rounded-lg border border-[#DDE6F7] bg-white p-4 text-sm font-semibold text-[#111B4D]">
                Statut actuel : {statusLabel}. {mission.response ? `Votre message : ${mission.response}` : "Aucune action supplémentaire n'est nécessaire depuis ce lien."}
              </div>
            )}
            <p className="text-xs font-medium text-[#64748B]">Lien valide jusqu'au {formatDateTime(mission.expiresAt)}. Vous ne pouvez accéder qu'à cette mission.</p>
            <MissionActions token={token} disabled={locked} />
          </CardContent>
        </Card>

        {(supportPhone || supportEmail) && (
          <Card>
            <CardHeader><CardTitle>Contact service client</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Utilisez ces contacts uniquement pour cette mission. Pour toute difficulté, indiquez la référence {booking.reference}.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {supportPhone && (
                  <Button asChild variant="outline" className="h-11 rounded-lg">
                    <a href={`tel:${supportPhone.replace(/\s+/g, "")}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      Appeler
                    </a>
                  </Button>
                )}
                {supportWhatsAppUrl && (
                  <Button asChild variant="outline" className="h-11 rounded-lg">
                    <a href={supportWhatsAppUrl} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </a>
                  </Button>
                )}
                {supportEmail && (
                  <Button asChild variant="outline" className="h-11 rounded-lg">
                    <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Mission ${booking.reference}`)}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </a>
                  </Button>
                )}
              </div>
              <div className="rounded-lg border border-[#E3E8F2] bg-white p-4 text-sm text-[#111827]">
                {supportPhone && <p><span className="font-semibold">Téléphone :</span> {supportPhone}</p>}
                {supportEmail && <p className="mt-1"><span className="font-semibold">Email :</span> {supportEmail}</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function MissionSignalCard({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  tone: "blue" | "violet" | "amber" | "red";
}) {
  const toneClass = {
    blue: "border-[#DDE6F7] bg-white text-[#111B4D]",
    violet: "border-[#DDE6F7] bg-white text-[#111B4D]",
    amber: "border-[#DDE6F7] bg-white text-[#111B4D]",
    red: "border-[#E3E8F2] bg-white text-[#B42318]",
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-snug">{value}</p>
      <p className="mt-1 text-xs font-medium leading-relaxed text-[#64748B]">{description}</p>
    </div>
  );
}

function getMissionStatusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING_CONFIRMATION: "En attente de confirmation",
    RELAUNCHED: "Relancé",
    CONFIRMED: "Disponibilité confirmée",
    UNAVAILABLE: "Indisponible",
    PROBLEM_REPORTED: "Problème signalé",
    EXPIRED: "Lien expiré",
    REPLACEMENT_RECOMMENDED: "Remplacement recommandé",
  };
  return map[status] ?? status;
}

function getMissionStatusTone(status: string) {
  if (status === "CONFIRMED") return "border-[#111B4D] bg-[#111B4D] text-white";
  if (["UNAVAILABLE", "PROBLEM_REPORTED", "EXPIRED", "REPLACEMENT_RECOMMENDED"].includes(status)) {
    return "border-[#B42318] bg-white text-[#B42318]";
  }
  return "border-[#DDE6F7] bg-white text-[#111B4D]";
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">{icon}{label}</p>
      <p className="mt-1 font-semibold text-[#111827]">{value || "—"}</p>
    </div>
  );
}

function MissionText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-0.5 whitespace-pre-line font-medium">{value}</p>
    </div>
  );
}
