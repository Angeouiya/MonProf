"use client";

import { toast } from "sonner";
import { ClipboardCopy, MessageCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/phone";

type ReplacementMessageTarget = {
  label: string;
  message?: string | null;
  phone?: string | null;
};

export function ReplacementHistoryActionsClient({
  targets,
}: {
  targets: ReplacementMessageTarget[];
}) {
  const availableTargets = targets.filter((target) => target.message?.trim());

  const copyMessage = async (target: ReplacementMessageTarget) => {
    if (!target.message) return;
    await navigator.clipboard.writeText(target.message);
    toast.success(`Message ${target.label.toLowerCase()} copié.`);
  };

  if (availableTargets.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-3 text-xs text-muted-foreground">
        Aucun message historisé pour ce remplacement.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {availableTargets.map((target) => {
        const whatsAppUrl = buildWhatsAppUrl(target.phone, target.message || "");
        return (
          <div key={target.label} className="flex flex-col gap-2 rounded-2xl border border-violet-100 bg-white/80 p-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-foreground">{target.label}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => copyMessage(target)} className="h-8 rounded-xl">
                <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                Copier
              </Button>
              {whatsAppUrl ? (
                <Button asChild size="sm" variant="outline" className="h-8 rounded-xl border-blue-100 text-blue-800 hover:bg-blue-50">
                  <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" disabled className="h-8 rounded-xl">
                  <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
                  Sans numéro
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
