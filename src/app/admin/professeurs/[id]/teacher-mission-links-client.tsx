"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ClipboardCopy, ExternalLink, Link2, ShieldAlert, ShieldCheck, TimerOff, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

type TeacherMissionLinkItem = {
  id: string;
  token: string;
  bookingId: string;
  title: string;
  instructions?: string | null;
  status: string;
  expiresAt: string;
  confirmedAt?: string | null;
  declinedAt?: string | null;
  problemAt?: string | null;
  response?: string | null;
  createdAt: string;
  booking: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    client: { name: string; phone?: string | null };
  };
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_CONFIRMATION: "En attente",
    RELAUNCHED: "Relancé",
    CONFIRMED: "Confirmé",
    UNAVAILABLE: "Indisponible",
    PROBLEM_REPORTED: "Problème signalé",
    EXPIRED: "Expiré",
    REPLACEMENT_RECOMMENDED: "Remplacement recommandé",
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === "CONFIRMED") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "UNAVAILABLE" || status === "PROBLEM_REPORTED" || status === "REPLACEMENT_RECOMMENDED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "EXPIRED") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status === "RELAUNCHED") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function missionEventDate(mission: TeacherMissionLinkItem) {
  if (mission.confirmedAt) return `Confirmé le ${formatDateTime(mission.confirmedAt)}`;
  if (mission.declinedAt) return `Refusé le ${formatDateTime(mission.declinedAt)}`;
  if (mission.problemAt) return `Problème le ${formatDateTime(mission.problemAt)}`;
  return `Créé le ${formatDateTime(mission.createdAt)}`;
}

function missionAction(mission: TeacherMissionLinkItem) {
  if (mission.status === "UNAVAILABLE" || mission.status === "REPLACEMENT_RECOMMENDED") {
    return {
      href: `/admin/reservations/${mission.bookingId}?action=replace`,
      label: "Remplacer",
      icon: UserCog,
      className: "border-red-100 text-red-700 hover:bg-red-50",
    };
  }
  if (mission.status === "PROBLEM_REPORTED") {
    return {
      href: `/admin/reservations/${mission.bookingId}`,
      label: "Traiter",
      icon: ShieldAlert,
      className: "border-amber-100 text-amber-800 hover:bg-amber-50",
    };
  }
  return null;
}

export function TeacherMissionLinksClient({ missions }: { missions: TeacherMissionLinkItem[] }) {
  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/mission/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Lien mission copié.");
  };

  const copyMissionSummary = async (mission: TeacherMissionLinkItem) => {
    const url = `${window.location.origin}/mission/${mission.token}`;
    await navigator.clipboard.writeText([
      mission.title,
      `Réservation : ${mission.booking.reference}`,
      `Client : ${mission.booking.client.name}`,
      `Contact : ${mission.booking.client.phone || "à confirmer"}`,
      `Cours : ${mission.booking.subjectName} - ${mission.booking.levelName}`,
      `Statut : ${statusLabel(mission.status)}`,
      `Expiration : ${formatDateTime(mission.expiresAt)}`,
      mission.response ? `Réponse : ${mission.response}` : "",
      `Lien : ${url}`,
    ].filter(Boolean).join("\n"));
    toast.success("Résumé mission copié.");
  };

  return (
    <Card className="border-violet-100">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Suivi des liens mission privés</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Contrôle des liens envoyés au professeur pour confirmer une mission, signaler une indisponibilité ou remonter un problème.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-800">
          <Link2 className="mr-1.5 h-3.5 w-3.5" />
          {missions.length} lien(s)
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {missions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-violet-100 p-4 text-sm text-muted-foreground">
            Aucun lien mission privé généré pour ce professeur.
          </p>
        ) : (
          missions.map((mission) => {
            const expired = new Date(mission.expiresAt).getTime() < Date.now();
            const action = missionAction(mission);
            const ActionIcon = action?.icon;
            return (
              <div key={mission.id} className="rounded-lg border border-violet-100 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{mission.title}</p>
                      <Badge variant="outline" className={statusClass(mission.status)}>{statusLabel(mission.status)}</Badge>
                      {expired && mission.status === "PENDING_CONFIRMATION" && (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                          <TimerOff className="mr-1 h-3.5 w-3.5" />
                          Expiré côté temps
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {mission.booking.reference} · {mission.booking.subjectName} · {mission.booking.levelName} · client {mission.booking.client.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {missionEventDate(mission)} · expire le {formatDateTime(mission.expiresAt)}
                    </p>
                    {mission.instructions && (
                      <p className="mt-3 rounded-lg border border-violet-100 bg-violet-50/35 p-3 text-sm text-muted-foreground">
                        {mission.instructions}
                      </p>
                    )}
                    {mission.response && (
                      <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm font-medium text-blue-900">
                        <ShieldCheck className="mr-1.5 inline h-4 w-4" />
                        Réponse professeur : {mission.response}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => copyLink(mission.token)}>
                      <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                      Copier lien
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => copyMissionSummary(mission)}>
                      <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                      Copier résumé
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/mission/${mission.token}`} target="_blank">
                        Ouvrir <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {action && (
                      <Button asChild size="sm" variant="outline" className={action.className}>
                        <Link href={action.href}>
                          {ActionIcon && <ActionIcon className="mr-1.5 h-3.5 w-3.5" />}
                          {action.label}
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/reservations/${mission.bookingId}`}>
                        Réservation <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
