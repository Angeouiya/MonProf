"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Loader2, Send, ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/shared/password-input";
import { RestrictionNoticeDialog } from "@/components/shared/restriction-notice-dialog";
import { formatFCFA } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PayoutMethodPicker } from "@/components/professor/payout-method-picker";

const MAX_NOTE_LENGTH = 500;

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function createPayoutRequestIdempotencyKey() {
  return crypto.randomUUID();
}

export function TeacherPayoutRequestForm({
  readyToReceive,
  pendingRequested,
  draftReservedAmount,
  defaultPhone,
  defaultMethod,
  payoutInstructions,
  minimumProcessingHours,
  maximumProcessingHours,
}: {
  readyToReceive: number;
  pendingRequested: number;
  draftReservedAmount: number;
  defaultPhone?: string | null;
  defaultMethod?: string | null;
  payoutInstructions?: string | null;
  minimumProcessingHours: number;
  maximumProcessingHours: number;
}) {
  const router = useRouter();
  const requestableAmount = Math.max(0, readyToReceive - draftReservedAmount);
  const [amount, setAmount] = useState(requestableAmount > 0 ? String(requestableAmount) : "");
  const [method, setMethod] = useState(defaultMethod || "WAVE");
  const [paymentPhone, setPaymentPhone] = useState(defaultPhone ?? "");
  const [paymentPhoneConfirm, setPaymentPhoneConfirm] = useState(defaultPhone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const pendingSubmissionRef = useRef<{ key: string; fingerprint: string } | null>(null);

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
    && currentPassword.length > 0
    && !noteTooLong
    && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    const requestPayload = {
      amount: cleanAmount,
      method,
      paymentPhone: normalizedPhone,
      paymentPhoneConfirm: normalizedConfirm,
      note: note.trim(),
    };
    const fingerprint = JSON.stringify(requestPayload);
    if (!pendingSubmissionRef.current || pendingSubmissionRef.current.fingerprint !== fingerprint) {
      pendingSubmissionRef.current = {
        key: createPayoutRequestIdempotencyKey(),
        fingerprint,
      };
    }
    const idempotencyKey = pendingSubmissionRef.current.key;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/professor/payout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestPayload,
          idempotencyKey,
          currentPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "PAYOUT_REQUEST_IDEMPOTENCY_MISMATCH" || data.code === "PAYOUT_PREVIOUS_ATTEMPT_CANCELLED" || data.payout?.action === "failed") {
          pendingSubmissionRef.current = null;
        }
        setBlockingError(data.error || "Impossible de lancer le retrait Jèko.");
        return;
      }
      pendingSubmissionRef.current = null;
      setNotice(data.pending
        ? "Retrait Jèko lancé. Le solde reste réservé jusqu'à confirmation finale, sans double débit."
        : `Retrait confirmé. Vous recevez exactement ${formatFCFA(cleanAmount)} ; frais Jèko pris en charge par Compétence.`);
      setAmount("");
      setCurrentPassword("");
      setNote("");
      router.refresh();
    } catch {
      setBlockingError("La réponse du serveur n'a pas été reçue. Vous pouvez réessayer : le même retrait ne sera pas créé deux fois.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="demande-retrait-professeur" data-professor-payout-request data-professor-payout-primary-action className="scroll-mt-24 rounded-xl border border-[#DDE6F7] bg-white p-4 shadow-sm min-[640px]:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[#111827]">Retirer via Jèko</p>
          <p className="mt-1 text-sm font-semibold text-[#64748B]">Montant. Numéro. Confirmation Jèko.</p>
        </div>
        <div className="shrink-0 rounded-lg bg-[#EEF2FF] px-3 py-2 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Disponible</p>
          <p className="text-base font-black text-[#111B4D]">{formatFCFA(requestableAmount)}</p>
        </div>
      </div>

      <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Vous recevez le montant exact. Frais Jèko pris en charge par Compétence.
      </p>

      <div data-professor-payout-fields className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <div>
          <label className="text-xs font-semibold text-[#475569]">Montant</label>
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Ex : 25000"
            disabled={requestableAmount <= 0}
            className="mt-1 min-h-12 text-base font-semibold"
          />
          {cleanAmount > requestableAmount && (
            <p className="mt-1 text-xs font-semibold text-red-700">Le montant dépasse le disponible ({formatFCFA(requestableAmount)}).</p>
          )}
          {cleanAmount > 0 && cleanAmount <= requestableAmount && (
            <p className="mt-1 text-xs font-bold text-emerald-700">
              Vous recevrez exactement {formatFCFA(cleanAmount)} sur le numéro confirmé.
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-[#475569]">Recevoir avec</p>
          <div className="mt-2">
            <PayoutMethodPicker value={method} onChange={setMethod} disabled={loading} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-[#475569]">
            Numéro {paymentMethodLabel(method)}
          </label>
          <Input
            inputMode="tel"
            value={paymentPhone}
            onChange={(event) => setPaymentPhone(event.target.value)}
            placeholder="Ex : +225 07 00 00 00 00"
            disabled={requestableAmount <= 0}
            className="mt-1 min-h-12"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#475569]">Retaper le numéro</label>
          <Input
            inputMode="tel"
            value={paymentPhoneConfirm}
            onChange={(event) => setPaymentPhoneConfirm(event.target.value)}
            placeholder="Retapez le numéro"
            disabled={requestableAmount <= 0}
            className="mt-1 min-h-12"
          />
          {phoneMismatch && (
            <p className="mt-1 text-xs font-semibold text-red-700">Les deux numéros ne correspondent pas.</p>
          )}
          {phoneConfirmed && (
            <p className="mt-1 text-xs font-semibold text-emerald-700">Numéro confirmé.</p>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[#DDE6F7] bg-[#F8FAFF] p-3">
        <label htmlFor="teacher-payout-current-password" className="inline-flex items-center gap-2 text-xs font-semibold text-[#475569]">
          <ShieldCheck className="h-4 w-4 text-[#111B4D]" aria-hidden />
          Confirmer avec votre mot de passe actuel
        </label>
        <PasswordInput
          id="teacher-payout-current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Votre mot de passe professeur"
          disabled={requestableAmount <= 0 || loading}
          className="mt-2 min-h-12 bg-white"
          required
        />
        <p className="mt-1.5 text-xs font-semibold leading-5 text-[#64748B]">
          Cette confirmation empêche un retrait frauduleux depuis une session laissée ouverte. Le mot de passe n'est jamais transmis à Jèko.
        </p>
      </div>

      <details className="group mt-3 rounded-lg border border-[#E6EAF3] bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-[#475569] [&::-webkit-details-marker]:hidden">
          Note ou consigne facultative
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-[#EEF2F7] p-3">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ajouter une précision facultative"
            disabled={requestableAmount <= 0}
            className="min-h-20"
          />
          <p className={noteTooLong ? "mt-1 text-xs font-semibold text-red-700" : "mt-1 text-xs font-semibold text-[#64748B]"}>
            {note.trim().length}/{MAX_NOTE_LENGTH}
          </p>
          {payoutInstructions ? <p className="mt-2 text-xs font-semibold leading-5 text-[#64748B]">Consigne enregistrée : {payoutInstructions}</p> : null}
        </div>
      </details>

      {notice ? (
        <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4" aria-hidden />
          {notice}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 min-[640px]:grid-cols-[minmax(0,1fr)_auto] min-[640px]:items-center">
        <p className="text-xs font-semibold leading-5 text-[#64748B]">
          {draftReservedAmount > 0
            ? `${formatFCFA(draftReservedAmount)} en confirmation Jèko.`
            : pendingRequested > 0
              ? `${formatFCFA(pendingRequested)} ancienne(s) demande(s) à libérer sans blocage du wallet.`
              : `Confirmation Jèko automatique. Historique indicatif : ${minimumProcessingHours}h à ${maximumProcessingHours}h selon le réseau.`}
        </p>
        <Button type="button" onClick={submit} disabled={!canSubmit} className="min-h-12 w-full rounded-lg bg-[#111B4D] px-6 text-white hover:bg-[#1E2A78] min-[640px]:w-auto">
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          {cleanAmount > 0 && cleanAmount <= requestableAmount ? `Retirer via Jèko ${formatFCFA(cleanAmount)}` : "Retirer via Jèko"}
        </Button>
      </div>
      <RestrictionNoticeDialog
        open={Boolean(blockingError)}
        onOpenChange={(open) => {
          if (!open) setBlockingError(null);
        }}
        title="Retrait non autorisé"
        description={blockingError ?? "Le retrait n'a pas été lancé."}
        variant="restriction"
        primaryLabel="OK"
        onPrimary={() => setBlockingError(null)}
      />
    </div>
  );
}
