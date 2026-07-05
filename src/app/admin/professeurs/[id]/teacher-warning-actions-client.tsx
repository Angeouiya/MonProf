"use client";

import { toast } from "sonner";
import { ClipboardCopy, MessageCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/phone";

export function TeacherWarningActionsClient({
  teacherPhone,
  message,
}: {
  teacherPhone?: string | null;
  message: string;
}) {
  const whatsAppUrl = buildWhatsAppUrl(teacherPhone, message);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    toast.success("Message d'avertissement copié.");
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={copyMessage} className="rounded-lg bg-white">
        <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
        Copier message
      </Button>
      {whatsAppUrl ? (
        <Button asChild size="sm" variant="outline" className="rounded-lg border-blue-100 bg-white text-blue-800 hover:bg-blue-50">
          <a href={whatsAppUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            WhatsApp
          </a>
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled className="rounded-lg">
          <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
          Téléphone absent
        </Button>
      )}
    </div>
  );
}
