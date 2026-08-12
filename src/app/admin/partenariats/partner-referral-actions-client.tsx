"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type PartnerReferralAction = "verify_identity" | "mark_paid" | "reject";

export function PartnerReferralActionsClient({
  referralId,
  status,
}: {
  referralId: string;
  status: string;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<PartnerReferralAction | null>(null);
  const [identityName, setIdentityName] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("WAVE");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [adminNote, setAdminNote] = useState("");

  async function run(action: PartnerReferralAction) {
    setBusyAction(action);
    try {
      const response = await fetch(`/api/admin/partner-referrals/${referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          identityName,
          payoutMethod,
          payoutPhone,
          payoutReference,
          adminNote,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Action impossible.");
        return;
      }
      toast.success(data.message || "Partenariat mis à jour.");
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  const canVerify = status === "PAYABLE";
  const canPay = status === "PAYABLE";
  const canReject = !["PAID", "REJECTED", "EXPIRED"].includes(status);

  return (
    <div className="grid gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3">
      <div className="grid gap-2 min-[720px]:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`identity-${referralId}`} className="text-xs">Nom vérifié sur pièce</Label>
          <Input id={`identity-${referralId}`} value={identityName} onChange={(event) => setIdentityName(event.target.value)} placeholder="Nom officiel" className="min-h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`method-${referralId}`} className="text-xs">Moyen de dépôt</Label>
          <Select value={payoutMethod} onValueChange={setPayoutMethod}>
            <SelectTrigger id={`method-${referralId}`} className="min-h-10">
              <SelectValue placeholder="Moyen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WAVE">Wave</SelectItem>
              <SelectItem value="ORANGE_MONEY">Orange Money</SelectItem>
              <SelectItem value="MTN_MONEY">MTN Money</SelectItem>
              <SelectItem value="MOOV_MONEY">Moov Money</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`phone-${referralId}`} className="text-xs">Téléphone dépôt</Label>
          <Input id={`phone-${referralId}`} value={payoutPhone} onChange={(event) => setPayoutPhone(event.target.value)} placeholder="+225 XX XX XX XX XX" className="min-h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ref-${referralId}`} className="text-xs">Référence dépôt</Label>
          <Input id={`ref-${referralId}`} value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="Référence Jèko / dépôt" className="min-h-10" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`note-${referralId}`} className="text-xs">Note admin</Label>
        <Textarea id={`note-${referralId}`} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Pièce reçue, vérification, remarque..." className="min-h-20" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!canVerify || busyAction !== null} onClick={() => void run("verify_identity")}>
          {busyAction === "verify_identity" ? "Vérification..." : "Pièce vérifiée"}
        </Button>
        <Button type="button" disabled={!canPay || busyAction !== null} onClick={() => void run("mark_paid")}>
          {busyAction === "mark_paid" ? "Paiement..." : "Marquer payé"}
        </Button>
        <Button type="button" variant="outline" disabled={!canReject || busyAction !== null} onClick={() => void run("reject")}>
          {busyAction === "reject" ? "Rejet..." : "Rejeter"}
        </Button>
      </div>
    </div>
  );
}
