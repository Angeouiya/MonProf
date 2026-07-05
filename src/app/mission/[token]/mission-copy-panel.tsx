"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { ClipboardCopy, Link2, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MissionCopyPanelProps = {
  token: string;
  missionSummary: string;
  clientMessage: string;
  supportMessage: string;
  clientWhatsAppUrl: string;
  supportWhatsAppUrl: string;
};

export function MissionCopyPanel({
  token,
  missionSummary,
  clientMessage,
  supportMessage,
  clientWhatsAppUrl,
  supportWhatsAppUrl,
}: MissionCopyPanelProps) {
  const absoluteMissionUrl = useMemo(() => {
    if (typeof window === "undefined") return `/mission/${token}`;
    return `${window.location.origin}/mission/${token}`;
  }, [token]);

  async function copyText(text: string, successLabel: string) {
    await navigator.clipboard.writeText(text);
    toast.success(successLabel);
  }

  async function copyMissionSummary() {
    await copyText(
      `${missionSummary}\n\nLien privé sécurisé : ${absoluteMissionUrl}`,
      "Résumé mission copié.",
    );
  }

  return (
    <Card className="border-[#E3E8F2] bg-white">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCopy className="h-4 w-4 text-[#111B4D]" />
          Résumé opérationnel à copier
        </CardTitle>
        <p className="text-sm font-medium leading-6 text-[#64748B]">
          Utilisez ces messages uniquement pour organiser cette mission. Le lien reste privé et ne donne accès à aucun espace professeur complet.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-64 overflow-auto rounded-lg border border-[#E3E8F2] bg-white p-4 text-sm leading-relaxed text-[#111827]">
          <pre className="whitespace-pre-wrap font-sans">{missionSummary}</pre>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button type="button" variant="outline" className="h-11 justify-start rounded-lg" onClick={copyMissionSummary}>
            <ClipboardCopy className="mr-2 h-4 w-4" />
            Copier mission
          </Button>
          <Button type="button" variant="outline" className="h-11 justify-start rounded-lg" onClick={() => copyText(clientMessage, "Message client copié.")}>
            <Phone className="mr-2 h-4 w-4" />
            Copier client
          </Button>
          <Button type="button" variant="outline" className="h-11 justify-start rounded-lg" onClick={() => copyText(supportMessage, "Message admin copié.")}>
            <Link2 className="mr-2 h-4 w-4" />
            Copier admin
          </Button>
          {clientWhatsAppUrl ? (
            <Button asChild variant="outline" className="h-11 justify-start rounded-lg border-[#DDE6F7] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
              <a href={clientWhatsAppUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp client
              </a>
            </Button>
          ) : supportWhatsAppUrl ? (
            <Button asChild variant="outline" className="h-11 justify-start rounded-lg border-[#DDE6F7] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
              <a href={supportWhatsAppUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp admin
              </a>
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-11 justify-start rounded-lg" disabled>
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp indisponible
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
