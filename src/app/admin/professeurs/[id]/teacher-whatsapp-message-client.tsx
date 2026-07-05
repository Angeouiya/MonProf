"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCopy, Link2, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatFCFA } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/phone";

type TeacherMissionBooking = {
  id: string;
  reference: string;
  clientName: string;
  clientPhone?: string | null;
  subjectName: string;
  levelName: string;
  courseFormat: string;
  commune?: string | null;
  quartier?: string | null;
  addressHint?: string | null;
  preferredDays: string;
  preferredTime: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  schoolProgram?: string | null;
  needDescription?: string | null;
  objective?: string | null;
  message?: string | null;
  participantsCount: number;
  sessionsCount: number;
  teacherCourseShare: number;
  transportFee: number;
  transportRouteLabel?: string | null;
  teacherNetAmount: number;
  status: string;
  paymentStatus: string;
  paidAmount: number;
  remainingAmount: number;
};

const courseFormatLabels: Record<string, string> = {
  ONLINE: "En ligne",
  HOME: "À domicile",
  IN_PERSON: "À domicile",
};

const bookingStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Brouillon PayDunya",
  PAID: "Payée",
  PENDING_ADMIN_VALIDATION: "Validation admin requise",
  CONFIRMED: "Confirmée",
  ASSIGNED: "Attribuée au professeur",
  IN_PROGRESS: "En cours",
  COURSE_DONE: "Cours effectué",
  PENDING_CLIENT_VALIDATION: "Validation client attendue",
  VALIDATED_BY_CLIENT: "Validée par le client",
  PAYMENT_TO_RELEASE: "Paiement à libérer",
  TEACHER_PAID: "Professeur payé",
  CANCELLED: "Annulée",
  DISPUTED: "En litige",
  REFUNDED: "Remboursée",
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: "Paiement en attente",
  BLOCKED: "Fonds bloqués",
  VALIDATED: "Fonds validés",
  TO_PAY_TEACHER: "À payer au professeur",
  TEACHER_PAID: "Professeur payé",
  DISPUTED: "Paiement suspendu",
  REFUNDED: "Remboursé",
  FAILED: "Échec paiement",
};

function formatDays(raw: string) {
  try {
    const days = JSON.parse(raw);
    if (Array.isArray(days)) return days.join(", ");
  } catch {
    return raw;
  }
  return raw;
}

function formatBookingDateLine(booking: TeacherMissionBooking) {
  return booking.scheduledDate
    ? `${formatDate(booking.scheduledDate)} ${booking.scheduledTime || booking.preferredTime || ""}`.trim()
    : `${formatDays(booking.preferredDays)} - ${booking.preferredTime}`;
}

function formatBookingLocation(booking: TeacherMissionBooking) {
  return booking.courseFormat === "ONLINE"
    ? "Lien en ligne à confirmer"
    : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" / ") || "à confirmer";
}

export function TeacherWhatsAppMessageClient({
  teacherId,
  teacherName,
  teacherPhone,
  bookings,
  initialBookingId,
}: {
  teacherId: string;
  teacherName: string;
  teacherPhone?: string | null;
  bookings: TeacherMissionBooking[];
  initialBookingId?: string | null;
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(() => (
    initialBookingId && bookings.some((booking) => booking.id === initialBookingId)
      ? initialBookingId
      : bookings[0]?.id || ""
  ));
  const [generatedMission, setGeneratedMission] = useState<{ bookingId: string; message: string; url: string } | null>(null);
  const [loadingMission, setLoadingMission] = useState(false);
  const selected = bookings.find((booking) => booking.id === bookingId) || bookings[0];

  const draftMessage = useMemo(() => {
    if (!selected) return "";
    const dateLine = formatBookingDateLine(selected);
    const format = courseFormatLabels[selected.courseFormat] ?? selected.courseFormat;
    const location = formatBookingLocation(selected);
    const groupLabel = selected.participantsCount > 1
      ? `Petit groupe (${selected.participantsCount} participants)`
      : "Cours individuel";
    const pedagogicalDetails = [
      selected.objective ? `Objectif : ${selected.objective}` : "",
      selected.schoolProgram ? `Programme / contexte : ${selected.schoolProgram}` : "",
      selected.needDescription ? `Besoin précis : ${selected.needDescription}` : "",
      selected.message ? `Message client : ${selected.message}` : "",
    ].filter(Boolean);
    return [
      `Bonjour ${teacherName},`,
      "",
      "Un cours vous est attribué sur Compétence.",
      "",
      `Réservation : ${selected.reference}`,
      `Client : ${selected.clientName}`,
      `Contact client : ${selected.clientPhone || "à confirmer par l'administration"}`,
      `Matière : ${selected.subjectName}`,
      `Niveau : ${selected.levelName}`,
      `Date / heure : ${dateLine}`,
      `Format : ${format}`,
      `Type : ${groupLabel}`,
      `Nombre de séance(s) : ${selected.sessionsCount}`,
      `Lieu : ${location}`,
      selected.transportRouteLabel ? `Trajet déplacement : ${selected.transportRouteLabel}` : "",
      `Part cours professeur : ${formatFCFA(selected.teacherCourseShare)}`,
      `Frais déplacement reversés : ${formatFCFA(selected.transportFee)}`,
      `Montant net prévu : ${formatFCFA(selected.teacherNetAmount)}`,
      `Statut réservation : ${bookingStatusLabels[selected.status] ?? selected.status}`,
      `Statut paiement : ${paymentStatusLabels[selected.paymentStatus] ?? selected.paymentStatus}`,
      `Déjà enregistré comme payé : ${formatFCFA(selected.paidAmount)}`,
      `Reste comptable lié à cette réservation : ${formatFCFA(selected.remainingAmount)}`,
      ...(pedagogicalDetails.length ? ["", "Détails pédagogiques :", ...pedagogicalDetails] : []),
      "",
      "Consignes :",
      "- Confirmez rapidement votre disponibilité.",
      "- Contactez le client uniquement pour organiser le cours prévu.",
      "- Prévenez immédiatement l'administration en cas de retard, indisponibilité, changement de lieu ou problème client.",
      "- Après le cours, attendez la validation client/admin avant toute demande de paiement.",
    ].join("\n");
  }, [selected, teacherName]);

  const fullOperationalDossier = useMemo(() => {
    const totalNet = bookings.reduce((sum, booking) => sum + booking.teacherNetAmount, 0);
    const totalPaid = bookings.reduce((sum, booking) => sum + booking.paidAmount, 0);
    const totalRemaining = bookings.reduce((sum, booking) => sum + booking.remainingAmount, 0);
    const blockedTotal = bookings
      .filter((booking) => booking.paymentStatus === "BLOCKED")
      .reduce((sum, booking) => sum + booking.remainingAmount, 0);
    const activeBookings = bookings.filter((booking) => !["CANCELLED", "REFUNDED", "TEACHER_PAID"].includes(booking.status));
    const lines = bookings.slice(0, 12).map((booking, index) => {
      const format = courseFormatLabels[booking.courseFormat] ?? booking.courseFormat;
      return [
        `${index + 1}. ${booking.reference} - ${booking.subjectName} (${booking.levelName})`,
        `   Client : ${booking.clientName}${booking.clientPhone ? ` / ${booking.clientPhone}` : ""}`,
        `   Créneau : ${formatBookingDateLine(booking)}`,
        `   Format : ${format} / ${booking.participantsCount} participant(s) / ${booking.sessionsCount} séance(s) de 2h`,
        `   Lieu : ${formatBookingLocation(booking)}`,
        booking.transportRouteLabel ? `   Trajet : ${booking.transportRouteLabel}` : "",
        `   Statut : ${bookingStatusLabels[booking.status] ?? booking.status} / ${paymentStatusLabels[booking.paymentStatus] ?? booking.paymentStatus}`,
        `   Part cours : ${formatFCFA(booking.teacherCourseShare)} / déplacement : ${formatFCFA(booking.transportFee)} / net : ${formatFCFA(booking.teacherNetAmount)}`,
        `   Payé : ${formatFCFA(booking.paidAmount)} / reste : ${formatFCFA(booking.remainingAmount)}`,
      ].filter(Boolean).join("\n");
    });

    return [
      `Dossier opérationnel professeur - ${teacherName}`,
      `Contrôle admin : ${new Date().toLocaleString("fr-FR")}`,
      "",
      "Synthèse comptable interne :",
      `- Missions suivies : ${bookings.length}`,
      `- Missions actives : ${activeBookings.length}`,
      `- Net professeur cumulé : ${formatFCFA(totalNet)}`,
      `- Déjà enregistré comme payé : ${formatFCFA(totalPaid)}`,
      `- Reste comptable : ${formatFCFA(totalRemaining)}`,
      `- Fonds encore bloqués : ${formatFCFA(blockedTotal)}`,
      "",
      "Réservations liées au professeur :",
      ...(lines.length ? lines : ["- Aucune réservation suivie pour le moment."]),
      bookings.length > lines.length ? `- +${bookings.length - lines.length} autre(s) réservation(s) visible(s) dans la fiche admin.` : "",
      "",
      "Consigne admin : utiliser ce dossier pour appeler, relancer, remplacer ou préparer un paiement professeur. Toute décision financière doit rester validée manuellement dans l'administration.",
    ].filter(Boolean).join("\n");
  }, [bookings, teacherName]);

  const activeMission = generatedMission?.bookingId === bookingId ? generatedMission : null;
  const message = activeMission?.message || draftMessage;

  const copyToClipboard = async (text: string, successLabel: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(successLabel);
  };

  const copyMessage = async () => {
    await copyToClipboard(message, "Message WhatsApp copié.");
  };

  const copyFullDossier = async () => {
    await copyToClipboard(fullOperationalDossier, "Dossier opérationnel complet copié.");
  };

  const createMissionLink = async () => {
    if (!selected) return;
    setLoadingMission(true);
    try {
      const res = await fetch("/api/admin/teacher-mission-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: selected.id,
          expiresInHours: 48,
          instructions: "Merci de confirmer rapidement votre disponibilité. Si vous êtes indisponible ou si une information manque, signalez-le immédiatement à l'administration.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création du lien impossible");
      const missionMessage = data.message || `${message}\n\nLien mission sécurisé : ${data.absoluteUrl || data.url}`;
      setGeneratedMission({
        bookingId: selected.id,
        message: missionMessage,
        url: data.absoluteUrl || data.url || "",
      });
      await copyToClipboard(missionMessage, "Lien sécurisé créé, message complet copié et historique enregistré.");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Création du lien mission impossible.");
    } finally {
      setLoadingMission(false);
    }
  };

  const whatsAppUrl = buildWhatsAppUrl(teacherPhone, message);
  const dossierWhatsAppUrl = buildWhatsAppUrl(teacherPhone, fullOperationalDossier);
  const selectedFormat = selected ? (courseFormatLabels[selected.courseFormat] ?? selected.courseFormat) : "";
  const selectedDate = selected
    ? formatBookingDateLine(selected)
    : "";

  if (bookings.length === 0) {
    return (
      <Card className="border-violet-100">
        <CardHeader><CardTitle className="text-base">Message mission professeur</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aucune réservation récente à transmettre pour ce professeur.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-violet-100">
      <CardHeader>
        <CardTitle className="text-base">Message mission / WhatsApp professeur</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sélectionnez une réservation appartenant à ce professeur, puis copiez le message, ouvrez WhatsApp ou créez un lien privé sécurisé.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 rounded-3xl border border-violet-100 bg-violet-50/35 p-4 lg:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-950/55">Transmission rapide</p>
            <p className="mt-1 text-sm font-semibold text-violet-950">
              Message prêt pour WhatsApp, SMS, email ou appel manuel.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-950/55">Dossier complet</p>
            <p className="mt-1 text-sm font-semibold text-violet-950">
              Copie toutes les missions, fonds bloqués, paiements et restes dus.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-950/55">Trace admin</p>
            <p className="mt-1 text-sm font-semibold text-violet-950">
              Le lien privé et les relances sont historisés dans l'espace professeur.
            </p>
          </div>
        </div>
        <Select value={bookingId} onValueChange={setBookingId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choisir une réservation" />
          </SelectTrigger>
          <SelectContent>
            {bookings.map((booking) => (
              <SelectItem key={booking.id} value={booking.id}>
                {booking.reference} - {booking.subjectName} - {booking.clientName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <div className="grid gap-3 rounded-3xl border border-[#1E2A78]/15 bg-blue-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Réservation</p>
              <p className="mt-1 font-mono text-sm font-black text-[#1E2A78]">{selected.reference}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Client</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{selected.clientName}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Cours</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{selected.subjectName} - {selected.levelName}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Créneau</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{selectedDate || "À confirmer"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Format</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{selectedFormat}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Participants</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{selected.participantsCount}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Séances de 2h</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{selected.sessionsCount}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Net professeur</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{formatFCFA(selected.teacherNetAmount)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Part cours</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{formatFCFA(selected.teacherCourseShare)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Déplacement</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{formatFCFA(selected.transportFee)}</p>
            </div>
            {selected.transportRouteLabel && (
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Trajet</p>
                <p className="mt-1 text-sm font-bold text-blue-950">{selected.transportRouteLabel}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Statut fonds</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{paymentStatusLabels[selected.paymentStatus] ?? selected.paymentStatus}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Déjà payé</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{formatFCFA(selected.paidAmount)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Reste comptable</p>
              <p className="mt-1 text-sm font-bold text-blue-950">{formatFCFA(selected.remainingAmount)}</p>
            </div>
          </div>
        )}
        {activeMission?.url && (
          <div className="flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Lien privé sécurisé généré et historisé.</p>
              <p className="mt-1 break-all">{activeMission.url}</p>
            </div>
          </div>
        )}
        <div>
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-black text-foreground">Message prêt à envoyer au professeur</p>
            <p className="text-xs font-medium text-muted-foreground">Mission sélectionnée, avec client, créneau, paiement et consignes admin</p>
          </div>
          <Textarea value={message} readOnly className="min-h-72 font-mono text-sm leading-relaxed" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button onClick={createMissionLink} disabled={loadingMission}>
            {loadingMission ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
            Créer lien privé + copier
          </Button>
          <Button onClick={copyMessage}>
            <ClipboardCopy className="mr-1.5 h-4 w-4" />
            Copier mission sélectionnée
          </Button>
          <Button variant="outline" onClick={copyFullDossier}>
            <ClipboardCopy className="mr-1.5 h-4 w-4" />
            Copier dossier complet
          </Button>
          <Button variant="outline" disabled={!dossierWhatsAppUrl} asChild={Boolean(dossierWhatsAppUrl)}>
            {dossierWhatsAppUrl ? (
              <a href={dossierWhatsAppUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                WhatsApp dossier complet
              </a>
            ) : (
              <span className="inline-flex items-center">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                 Dossier complet indisponible
              </span>
            )}
          </Button>
          <Button variant="outline" disabled={!whatsAppUrl} asChild={Boolean(whatsAppUrl)}>
            {whatsAppUrl ? (
              <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                WhatsApp mission
              </a>
            ) : (
              <span className="inline-flex items-center">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Téléphone manquant
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
