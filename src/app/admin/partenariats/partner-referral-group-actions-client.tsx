"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RestrictionNoticeDialog } from "@/components/shared/restriction-notice-dialog";
import { formatFCFA } from "@/lib/format";
import { toast } from "sonner";

export function PartnerReferralGroupActionsClient({
  promoterPhone,
  promoterNames,
  payableCount,
  payableAmount,
}: {
  promoterPhone: string | null;
  promoterNames: string[];
  payableCount: number;
  payableAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [identityName, setIdentityName] = useState(promoterNames[0] ?? "");
  const [payoutMethod, setPayoutMethod] = useState("WAVE");
  const [payoutPhone, setPayoutPhone] = useState(promoterPhone ?? "");
  const [payoutReference, setPayoutReference] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const canPay = Boolean(promoterPhone && payableCount > 0 && payableAmount > 0);

  async function payGroup() {
    if (!canPay) {
      setErrorNotice("Ce lot n'a aucun numéro ou aucune commission payable.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/partner-referrals/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoterPhone,
          identityName,
          payoutMethod,
          payoutPhone,
          payoutReference,
          adminNote,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorNotice(data.error || "Paiement groupé impossible.");
        return;
      }
      toast.success(data.message || "Lot partenaire marqué payé.");
      setOpen(false);
      router.refresh();
    } catch {
      setErrorNotice("Connexion impossible. Vérifiez le réseau puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button type="button" disabled={!canPay} className="min-h-10 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            Payer le lot
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Payer ce numéro partenaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les commissions PAYABLE de ce numéro seront marquées payées avec la même référence de dépôt.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4">
            <div className="rounded-xl border border-[#E3E8F2] bg-[#F8FAFC] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Lot comptable</p>
              <p className="mt-1 text-sm font-black text-[#111B4D]">{promoterPhone ?? "Numéro non renseigné"}</p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">
                {payableCount} commission(s) · {formatFCFA(payableAmount)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#64748B]">
                Apporteur(s) : {promoterNames.join(", ") || "Non renseigné"}
              </p>
            </div>

            <div className="grid gap-3 min-[720px]:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`group-identity-${promoterPhone}`} className="text-xs">Nom vérifié sur pièce</Label>
                <Input id={`group-identity-${promoterPhone}`} value={identityName} onChange={(event) => setIdentityName(event.target.value)} placeholder="Nom officiel" className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`group-method-${promoterPhone}`} className="text-xs">Moyen de dépôt</Label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger id={`group-method-${promoterPhone}`} className="min-h-10">
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
                <Label htmlFor={`group-phone-${promoterPhone}`} className="text-xs">Téléphone dépôt</Label>
                <Input id={`group-phone-${promoterPhone}`} value={payoutPhone} onChange={(event) => setPayoutPhone(event.target.value)} placeholder="+225 XX XX XX XX XX" className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`group-ref-${promoterPhone}`} className="text-xs">Référence dépôt commune</Label>
                <Input id={`group-ref-${promoterPhone}`} value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="Référence Jèko / dépôt" className="min-h-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`group-note-${promoterPhone}`} className="text-xs">Note admin</Label>
              <Textarea id={`group-note-${promoterPhone}`} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Pièce reçue, vérification, remarque..." className="min-h-20" />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void payGroup();
              }}
              className="bg-[#111B4D] text-white hover:bg-[#1E2A78]"
            >
              {busy ? "Paiement..." : `Marquer payé · ${formatFCFA(payableAmount)}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RestrictionNoticeDialog
        open={Boolean(errorNotice)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setErrorNotice(null);
        }}
        title="Paiement groupé impossible"
        description={errorNotice ?? ""}
        variant="restriction"
      />
    </>
  );
}
