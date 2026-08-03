import {
  normalizeJekoPaymentMethod,
  type JekoPaymentStatus,
  type JekoPaymentMethod,
} from "./jeko-utils";

const ACTIVE_ATTEMPT_STATUSES = new Set(["CREATED", "REQUESTING", "PENDING"]);
const TERMINAL_ATTEMPT_STATUSES = new Set(["FAILED", "REJECTED", "CANCELLED", "EXPIRED"]);
export const JEKO_UNIDENTIFIED_REQUEST_GRACE_MS = 30 * 60 * 1_000;

export type JekoAttemptSummary = {
  id: string;
  idempotencyKey: string;
  status: string;
  method: string | null;
  providerOrderId?: string | null;
  failureCode?: string | null;
};

export type JekoAttemptPlan =
  | {
      kind: "already_paid";
      attemptId: string;
    }
  | {
      kind: "reuse";
      attemptId: string;
      idempotencyKey: string;
      paymentMethod: JekoPaymentMethod;
    }
  | {
      kind: "create";
      attemptId: null;
      idempotencyKey: string;
      paymentMethod: JekoPaymentMethod;
    }
  | {
      kind: "blocked";
      attemptId: string;
      reason: string;
    };

/**
 * Une création REQUESTING sans ID ni URL fournisseur est inaccessible au
 * client. Après la fenêtre de cohérence Jèko, et seulement après qu'une
 * recherche serveur n'a trouvé aucune transaction, elle peut être
 * terminalisée afin d'autoriser une nouvelle référence.
 */
export function isStaleUnidentifiedJekoRequest(input: {
  status: string;
  providerOrderId?: string | null;
  checkoutUrl?: string | null;
  requestedAt?: Date | string | null;
  createdAt: Date | string;
  now?: Date | string;
}) {
  if (
    input.status !== "REQUESTING"
    || input.providerOrderId
    || input.checkoutUrl
  ) return false;

  const startedAt = new Date(input.requestedAt ?? input.createdAt).getTime();
  const now = new Date(input.now ?? new Date()).getTime();
  return Number.isFinite(startedAt)
    && Number.isFinite(now)
    && now - startedAt >= JEKO_UNIDENTIFIED_REQUEST_GRACE_MS;
}

export type JekoRescheduleFinancialSnapshot = {
  feeAmount: number;
  feePlatformAmount: number;
  feeTeacherAmount: number;
  paymentServiceFeeAmount: number;
  totalToPay: number;
};

export function parseJekoCheckoutBody(value: unknown):
  | { ok: true; paymentMethod: JekoPaymentMethod }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Corps JSON invalide." };
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "paymentMethod") {
    return {
      ok: false,
      error: "Seul le moyen de paiement Jèko est accepté. Le montant est toujours calculé par le serveur.",
    };
  }

  const paymentMethod = normalizeJekoPaymentMethod(value.paymentMethod);
  if (!paymentMethod) {
    return { ok: false, error: "Moyen de paiement Jèko non pris en charge." };
  }
  return { ok: true, paymentMethod };
}

/**
 * Les tentatives doivent être fournies de la plus récente à la plus ancienne.
 * La clé de nouvelle tentative ne contient volontairement pas le moyen choisi :
 * deux POST concurrents avec des moyens différents entrent en conflit sur la
 * même clé au lieu d'ouvrir deux demandes de paiement.
 */
export function planJekoBookingAttempt(input: {
  bookingId: string;
  requestedMethod: JekoPaymentMethod;
  attempts: JekoAttemptSummary[];
}): JekoAttemptPlan {
  const succeeded = input.attempts.find((attempt) => attempt.status === "SUCCEEDED");
  if (succeeded) {
    return { kind: "already_paid", attemptId: succeeded.id };
  }

  const active = input.attempts.find(isActiveOrReconcilableAttempt);
  if (active) {
    const paymentMethod = platformMethodToJeko(active.method);
    if (!paymentMethod) {
      return {
        kind: "blocked",
        attemptId: active.id,
        reason: "La tentative active utilise un moyen de paiement non reconnu. Un contrôle est requis.",
      };
    }
    return {
      kind: "reuse",
      attemptId: active.id,
      idempotencyKey: active.idempotencyKey,
      paymentMethod,
    };
  }

  const terminalCount = input.attempts.filter((attempt) => TERMINAL_ATTEMPT_STATUSES.has(attempt.status)).length;
  return {
    kind: "create",
    attemptId: null,
    idempotencyKey: `BOOKING:${input.bookingId}:JEKO:ATTEMPT:${terminalCount + 1}`,
    paymentMethod: input.requestedMethod,
  };
}

/**
 * Même verrou que pour le paiement principal, mais la portée est la demande
 * de reprogrammation. Le montant et le moyen ne font pas partie de la clé :
 * le snapshot serveur et la contrainte unique tranchent les courses réseau.
 */
export function planJekoRescheduleAttempt(input: {
  rescheduleRequestId: string;
  requestedMethod: JekoPaymentMethod;
  attempts: JekoAttemptSummary[];
}): JekoAttemptPlan {
  const succeeded = input.attempts.find((attempt) => attempt.status === "SUCCEEDED");
  if (succeeded) return { kind: "already_paid", attemptId: succeeded.id };

  const active = input.attempts.find(isActiveOrReconcilableAttempt);
  if (active) {
    const paymentMethod = platformMethodToJeko(active.method);
    if (!paymentMethod) {
      return {
        kind: "blocked",
        attemptId: active.id,
        reason: "La tentative active utilise un moyen de paiement non reconnu. Un contrôle est requis.",
      };
    }
    return {
      kind: "reuse",
      attemptId: active.id,
      idempotencyKey: active.idempotencyKey,
      paymentMethod,
    };
  }

  const terminalCount = input.attempts.filter((attempt) => TERMINAL_ATTEMPT_STATUSES.has(attempt.status)).length;
  return {
    kind: "create",
    attemptId: null,
    idempotencyKey: `RESCHEDULE:${input.rescheduleRequestId}:JEKO:ATTEMPT:${terminalCount + 1}`,
    paymentMethod: input.requestedMethod,
  };
}

export function isJekoBookingPayable(booking: {
  status: string;
  paymentStatus: string;
  isQuoteOnly: boolean;
  totalClientPays: number;
  totalPrice: number;
}) {
  const amount = booking.totalClientPays > 0 ? booking.totalClientPays : booking.totalPrice;
  return !booking.isQuoteOnly
    && booking.status === "PENDING_PAYMENT"
    && booking.paymentStatus === "FAILED"
    && Number.isSafeInteger(amount)
    && amount > 0;
}

export function isJekoReschedulePayable(request: {
  status: string;
  totalToPay: number;
  paidAt: Date | string | null;
}) {
  return ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(request.status)
    && request.paidAt == null
    && Number.isSafeInteger(request.totalToPay)
    && request.totalToPay > 0;
}

/**
 * Valide l'instantané financier figé avant toute redirection externe.
 * Le fournisseur ne reçoit que le total, mais le ledger doit aussi pouvoir
 * prouver que la part professeur, la commission et les frais de service
 * composent exactement ce total.
 */
export function validateJekoRescheduleFinancialSnapshot(
  snapshot: JekoRescheduleFinancialSnapshot,
): string | null {
  const amounts = [
    snapshot.feeAmount,
    snapshot.feePlatformAmount,
    snapshot.feeTeacherAmount,
    snapshot.paymentServiceFeeAmount,
    snapshot.totalToPay,
  ];
  if (amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
    return "L'instantané financier du supplément contient un montant invalide.";
  }
  if (snapshot.feeAmount <= 0 || snapshot.totalToPay <= 0) {
    return "Le supplément doit avoir un montant strictement positif.";
  }
  if (snapshot.feeTeacherAmount + snapshot.feePlatformAmount !== snapshot.feeAmount) {
    return "La part professeur et la commission ne correspondent pas au supplément.";
  }
  if (snapshot.feeAmount + snapshot.paymentServiceFeeAmount !== snapshot.totalToPay) {
    return "Le supplément et les frais de service ne correspondent pas au total client.";
  }
  return null;
}

/**
 * Un désaccord entre le webhook signé et la confirmation GET peut être dû à
 * la propagation asynchrone chez le fournisseur. Il reste donc réessayable ;
 * seuls des statuts terminaux unanimes autorisent un crédit ou un échec.
 */
export function resolveJekoPaymentStatusConsensus(
  statuses: readonly JekoPaymentStatus[],
): JekoPaymentStatus {
  if (statuses.length === 0 || statuses.includes("pending")) return "pending";
  const first = statuses[0];
  return statuses.every((status) => status === first) ? first : "pending";
}

export function platformMethodToJeko(value: string | null | undefined): JekoPaymentMethod | null {
  const methods: Record<string, JekoPaymentMethod> = {
    WAVE: "wave",
    ORANGE_MONEY: "orange",
    MTN_MONEY: "mtn",
    MOOV_MONEY: "moov",
    DJAMO: "djamo",
  };
  return value ? methods[value] ?? null : null;
}

function isActiveOrReconcilableAttempt(attempt: JekoAttemptSummary) {
  return ACTIVE_ATTEMPT_STATUSES.has(attempt.status)
    || (
      attempt.status === "FAILED"
      && Boolean(attempt.providerOrderId)
      // Un statut d'erreur confirmé par GET/webhook est terminal et peut
      // ouvrir une nouvelle tentative. Tous les autres FAILED portant un ID
      // distant restent ambigus (notamment les anciens échecs de persistance)
      // et doivent être rapprochés avant tout nouveau POST.
      && attempt.failureCode !== "JEKO_PAYMENT_FAILED"
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
