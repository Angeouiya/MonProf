"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";
import { activePaymentMethodOptions, paymentMethodLabel } from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaymentMethodLogo } from "@/components/shared/payment-method-logo";

const MAX_NOTE_LENGTH = 500;

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function TeacherPayoutRequestForm({
  readyToReceive,
  pendingRequested,
  defaultPhone,
  defaultMethod,
  payoutInstructions,
}: {
  readyToReceive: number;
  pendingRequested: number;
  defaultPhone?: string | null;
  defaultMethod?: string | null;
  payoutInstructions?: string | null;
}) {
  const router = useRouter();
  const requestableAmount = Math.max(0, readyToReceive - pendingRequested);
  const [amount, setAmount] = useState(requestableAmount > 0 ? String(requestableAmount) : "");
  const [method, setMethod] = useState(defaultMethod || "WAVE");
  const [paymentPhone, setPaymentPhone] = useState(defaultPhone ?? "");
  const [paymentPhoneConfirm, setPaymentPhoneConfirm] = useState(defaultPhone ?? "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanAmount = useMemo(() => Number(amount.replace(/\s/g, "")) || 0, [amount]);
  const normalizedPhone = normalizePhone(paymentPhone);
  const normalizedConfirm = normalizePhone(paymentPhoneConfirm);
  const phoneMismatch = normalizedPhone.length > 0 && normalizedConfirm.length > 0 && normalizedPhone !== normalizedConfirm;
  const phoneConfirmed = normalizedPhone.length >= 8 && normalizedPhone === normalizedConfirm;
  const noteTooLong = note.trim().length > MAX_NOTE_LENGTH;
  const canSubmit = requestableAmount > 0
    && cleanAmount > 0
    && cleanAmount <= requestableAmount
    && normalizedPhone.length >= 8
    && normalizedPhone.length <= 20
    && normalizedPhone === normalizedConfirm
    && !noteTooLong
    && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/professor/payout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cleanAmount,
          method,
          paymentPhone: normalizedPhone,
          paymentPhoneConfirm: normalizedConfirm,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Impossible d'envoyer la demande.");
        return;
      }
      toast.success("Demande de paiement envoyée à l'administration.");
      setAmount("");
      setNote("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[1.15rem] border border-[#E6EAF3] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-semibold text-[#111827]">Demander un paiement</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
            Saisissez le montant souhaité, le moyen de paiement et le numéro exact. Retapez le numéro pour éviter toute erreur avant contrôle admin.
          </p>
          {payoutInstructions && (
            <p className="mt-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748B]">
              Consigne enregistrée : {payoutInstructions}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[#111B4D] bg-white px-3 py-2 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Disponible</p>
          <p className="text-sm font-semibold text-[#111B4D]">{formatFCFA(requestableAmount)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_190px]">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Montant demandé</label>
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Ex : 25000"
            disabled={requestableAmount <= 0}
            className="mt-1"
          />
          {cleanAmount > requestableAmount && (
            <p className="mt-1 text-xs font-semibold text-red-700">Le montant dépasse le disponible ({formatFCFA(requestableAmount)}).</p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Moyen de paiement</label>
          <Select value={method} onValueChange={setMethod} disabled={requestableAmount <= 0}>
            <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {activePaymentMethodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[#E6EAF3] bg-white p-2">
            <PaymentMethodLogo method={method} className="h-9 min-w-20 rounded-xl" />
            <p className="text-xs font-semibold leading-5 text-[#64748B]">
              L'admin paiera uniquement via le moyen choisi après vérification.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Numéro {paymentMethodLabel(method)}
          </label>
          <Input
            inputMode="tel"
            value={paymentPhone}
            onChange={(event) => setPaymentPhone(event.target.value)}
            placeholder="Ex : +225 07 00 00 00 00"
            disabled={requestableAmount <= 0}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Confirmer le numéro</label>
          <Input
            inputMode="tel"
            value={paymentPhoneConfirm}
            onChange={(event) => setPaymentPhoneConfirm(event.target.value)}
            placeholder="Retapez le numéro"
            disabled={requestableAmount <= 0}
            className="mt-1"
          />
          {phoneMismatch && (
            <p className="mt-1 text-xs font-semibold text-red-700">Les deux numéros ne correspondent pas.</p>
          )}
          {phoneConfirmed && (
            <p className="mt-1 text-xs font-semibold text-[#111B4D]">Numéro confirmé. Vérifiez encore l'indicatif et les chiffres avant l'envoi.</p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Note pour l'administration</label>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex : merci d'envoyer le paiement sur mon numéro Wave principal."
          disabled={requestableAmount <= 0}
          className="mt-1 min-h-24"
        />
        <p className={noteTooLong ? "mt-1 text-xs font-semibold text-red-700" : "mt-1 text-xs font-semibold text-[#64748B]"}>
          {note.trim().length}/{MAX_NOTE_LENGTH} caractères
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <CheckCircle2 className="h-4 w-4 text-[#111B4D]" />
          <span>{pendingRequested > 0 ? `${formatFCFA(pendingRequested)} déjà demandé et en attente.` : "Aucune demande en attente."}</span>
        </div>
        <Button type="button" onClick={submit} disabled={!canSubmit} className="min-h-11 rounded-2xl bg-[#111B4D] text-white hover:bg-[#1E2A78]">
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Envoyer la demande
        </Button>
      </div>
    </div>
  );
}
