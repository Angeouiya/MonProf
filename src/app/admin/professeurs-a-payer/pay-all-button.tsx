"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Banknote, Loader2 } from "lucide-react";
import { formatFCFA } from "@/lib/format";

const MAX_REFERENCE_LENGTH = 80;
const MAX_NOTE_LENGTH = 500;

function normalizePaymentPhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

export function PayAllTeacherButton({
  teacherId,
  total,
  count,
  teacherName,
  teacherPhone,
  pendingRetentions = 0,
  retainedTotal = 0,
}: {
  teacherId: string;
  total: number;
  count: number;
  teacherName: string;
  teacherPhone?: string | null;
  pendingRetentions?: number;
  retainedTotal?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("WAVE");
  const [paymentPhone, setPaymentPhone] = useState(teacherPhone ?? "");
  const [paymentPhoneConfirm, setPaymentPhoneConfirm] = useState(teacherPhone ?? "");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(String(total));
  const [note, setNote] = useState("");
  const cleanAmount = useMemo(() => Number(amount.replace(/\s/g, "")) || 0, [amount]);
  const normalizedPaymentPhone = normalizePaymentPhone(paymentPhone);
  const normalizedPaymentPhoneConfirm = normalizePaymentPhone(paymentPhoneConfirm);
  const remainingAfterPayment = Math.max(0, total - Math.min(cleanAmount, total));
  const referenceTooLong = reference.trim().length > MAX_REFERENCE_LENGTH;
  const noteTooLong = note.trim().length > MAX_NOTE_LENGTH;
  const phoneInvalid = normalizedPaymentPhone.length < 8 || normalizedPaymentPhone.length > 20;
  const phoneMismatch = normalizedPaymentPhone.length > 0 && normalizedPaymentPhoneConfirm.length > 0 && normalizedPaymentPhone !== normalizedPaymentPhoneConfirm;
  const phoneConfirmed = !phoneInvalid && normalizedPaymentPhone === normalizedPaymentPhoneConfirm;
  const canSubmit = cleanAmount > 0 && cleanAmount <= total && !phoneInvalid && normalizedPaymentPhone === normalizedPaymentPhoneConfirm && !referenceTooLong && !noteTooLong && !loading;

  const payAll = async () => {
    if (cleanAmount <= 0 || cleanAmount > total) {
      toast.error(`Le montant doit être compris entre 1 FCFA et ${formatFCFA(total)}.`);
      return;
    }
    if (referenceTooLong) {
      toast.error(`Référence trop longue (${MAX_REFERENCE_LENGTH} caractères maximum).`);
      return;
    }
    if (noteTooLong) {
      toast.error(`Note interne trop longue (${MAX_NOTE_LENGTH} caractères maximum).`);
      return;
    }
    if (phoneInvalid) {
      toast.error("Saisissez le numéro exact du paiement Mobile Money.");
      return;
    }
    if (normalizedPaymentPhone !== normalizedPaymentPhoneConfirm) {
      toast.error("Les deux numéros de paiement ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teacher-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          amount: cleanAmount,
          method,
          paymentPhone: normalizedPaymentPhone,
          paymentPhoneConfirm: normalizedPaymentPhoneConfirm,
          reference,
          note: note.trim() || `Paiement ${cleanAmount === total ? "total" : "partiel"} depuis Professeurs à payer (${count} cours suivis)`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Paiement impossible.");
      toast.success(`Paiement enregistré pour ${teacherName}: ${formatFCFA(cleanAmount)}`);
      setReference("");
      setNote("");
      setPaymentPhone(teacherPhone ?? "");
      setPaymentPhoneConfirm(teacherPhone ?? "");
      setAmount(String(Math.max(0, total - cleanAmount)));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paiement impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Banknote className="mr-1.5 h-4 w-4" />}
          Enregistrer paiement
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Enregistrer un paiement pour {teacherName}</AlertDialogTitle>
          <AlertDialogDescription>
            Saisissez le montant réellement déposé au professeur. Le système l'impute automatiquement sur les réservations payables et déduit le reste dû.
            {retainedTotal > 0 && (
              <span className="mt-2 block">
                Retenues déjà appliquées : <strong>{formatFCFA(retainedTotal)}</strong>. Elles sont déjà déduites du net à payer.
              </span>
            )}
            {pendingRetentions > 0 && (
              <span className="mt-2 block text-amber-800">
                Attention : <strong>{formatFCFA(pendingRetentions)}</strong> de retenue(s) sont encore en attente de validation. Vérifiez la fiche professeur avant paiement si nécessaire.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-3 rounded-3xl border border-blue-100 bg-blue-50/65 p-4 sm:grid-cols-3">
          <PaymentPreview label="Net à payer" value={formatFCFA(total)} />
          <PaymentPreview label="Montant saisi" value={formatFCFA(cleanAmount)} />
          <PaymentPreview label="Reste après paiement" value={formatFCFA(remainingAfterPayment)} strong={remainingAfterPayment === 0} />
        </div>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Montant payé</label>
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Ex : 25000"
            />
            {cleanAmount > total && (
              <p className="mt-1 text-xs font-medium text-red-700">Le montant dépasse le reste dû ({formatFCFA(total)}).</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Méthode</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WAVE">Wave</SelectItem>
                <SelectItem value="ORANGE_MONEY">Orange Money</SelectItem>
                <SelectItem value="MTN_MONEY">MTN Money</SelectItem>
                <SelectItem value="MOOV_MONEY">Moov Money</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Numéro de paiement</label>
            <Input
              inputMode="tel"
              value={paymentPhone}
              onChange={(event) => setPaymentPhone(event.target.value)}
              placeholder="Ex : +225 07 00 00 00 00"
            />
            <p className={phoneInvalid ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>
              Ce numéro figurera sur la facture/reçu du professeur.
            </p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Confirmer le numéro</label>
            <Input
              inputMode="tel"
              value={paymentPhoneConfirm}
              onChange={(event) => setPaymentPhoneConfirm(event.target.value)}
              placeholder="Retapez le numéro"
            />
            {phoneMismatch ? (
              <p className="mt-1 text-xs font-medium text-red-700">Les deux numéros ne correspondent pas.</p>
            ) : phoneConfirmed ? (
              <p className="mt-1 text-xs font-medium text-blue-800">Numéro confirmé.</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Double contrôle avant dépôt réel.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Référence opérateur</label>
            <Input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={MAX_REFERENCE_LENGTH + 10}
              placeholder="Optionnel"
            />
            <p className={referenceTooLong ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>
              {reference.trim().length}/{MAX_REFERENCE_LENGTH} caractères
            </p>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Note interne</label>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_NOTE_LENGTH + 50}
            placeholder="Ex : Dépôt Wave confirmé par l'admin, reçu opérateur conservé."
            className="min-h-20"
          />
          <p className={noteTooLong ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>
            {note.trim().length}/{MAX_NOTE_LENGTH} caractères
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setAmount(String(total))}>
            Mettre le reste à zéro
          </Button>
          <Button type="button" variant="outline" onClick={() => setAmount(String(Math.ceil(total / 2)))}>
            Paiement partiel 50%
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={payAll} disabled={!canSubmit}>
            Enregistrer {formatFCFA(cleanAmount)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PaymentPreview({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-2xl border border-blue-200 bg-white p-3" : "rounded-2xl border border-blue-100 bg-white/80 p-3"}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-950/55">{label}</p>
      <p className={strong ? "mt-1 text-sm font-black text-blue-950" : "mt-1 text-sm font-bold text-blue-950"}>{value}</p>
    </div>
  );
}
