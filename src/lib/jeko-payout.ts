import "server-only";

import { createHash } from "node:crypto";
import type { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { requireJekoServerConfig, type JekoServerConfig } from "./jeko-config";
import {
  JEKO_COMPETENCE_STORE_NAME,
  isCompetenceJekoStoreName,
} from "./jeko-store-identity";
import {
  JEKO_CURRENCY,
  jekoAmountCentsToXof,
  jekoFeeCentsToCoveredXof,
  xofToJekoAmountCents,
} from "./jeko-utils";

export const JEKO_PAYOUT_METHOD_MAP = {
  WAVE: "wave",
  // The Partner API contract uses `orange` for contacts, transfers and
  // transaction responses. `orange_money` is the platform enum label only.
  ORANGE_MONEY: "orange",
  MTN_MONEY: "mtn",
  MOOV_MONEY: "moov",
  DJAMO: "djamo",
} as const;

export type SupportedTeacherPayoutMethod = keyof typeof JEKO_PAYOUT_METHOD_MAP;
export type JekoMobileMoneyMethod = (typeof JEKO_PAYOUT_METHOD_MAP)[SupportedTeacherPayoutMethod];
export type JekoPayoutStatus = "pending" | "success" | "failed";

export type JekoPayoutRequestOptions = {
  config?: JekoServerConfig;
  fetchImpl?: typeof fetch;
};

export type JekoMobileMoneyContact = {
  id: string;
  name: string;
  paymentMethod: JekoMobileMoneyMethod;
  phoneNumber: string;
};

export type JekoStoreBalance = {
  storeId: string;
  availableAmountCents: number;
  availableAmountXof: number;
  currency: typeof JEKO_CURRENCY;
};

export type JekoStoreSummary = {
  id: string;
  name: string;
};

export type JekoTransferDetails = {
  providerTransferId: string;
  providerTransactionId: string | null;
  storeId: string;
  contactId: string | null;
  reference: string;
  status: JekoPayoutStatus;
  paymentMethod: JekoMobileMoneyMethod;
  beneficiary: string;
  teacherNetAmountCents: number;
  teacherNetAmountXof: number;
  feeCoveredByPlatformCents: number;
  /**
   * Montant entier archivé en FCFA. Un éventuel reliquat de centimes est
   * arrondi au FCFA supérieur afin que Compétence ne sous-estime jamais ses frais.
   */
  feeCoveredByPlatformXof: number;
  totalPlatformDebitCents: number;
  totalPlatformDebitXof: number;
  description: string;
  createdAt: string;
  raw: Record<string, unknown>;
};

export type CreateJekoTeacherPayoutInput = {
  reference: string;
  teacherName: string;
  phoneNumber: string;
  paymentMethod: PaymentMethod;
  /** Montant net exact promis au professeur, en FCFA entiers. */
  teacherNetAmountXof: number;
  description?: string | null;
  /** Date du DRAFT local, utilisée pour retrouver explicitement un doublon ancien. */
  referenceCreatedAt?: Date | string | null;
};

export type JekoTeacherPayoutResult = {
  providerTransferId: string | null;
  providerTransactionId: string | null;
  contactId: string;
  storeId: string;
  reference: string;
  status: JekoPayoutStatus;
  paymentMethod: JekoMobileMoneyMethod;
  teacherNetAmountCents: number;
  teacherNetAmountXof: number;
  feeCoveredByPlatformCents: number | null;
  feeCoveredByPlatformXof: number | null;
  totalPlatformDebitCents: number | null;
  totalPlatformDebitXof: number | null;
  duplicate: boolean;
  reconciliationRequired: boolean;
  balanceBefore: JekoStoreBalance;
  raw: Record<string, unknown>;
};

export class JekoPayoutApiError extends Error {
  readonly httpStatus: number;
  readonly code: string | null;
  readonly retryable: boolean;

  constructor(message: string, httpStatus: number, code: string | null = null) {
    super(message);
    this.name = "JekoPayoutApiError";
    this.httpStatus = httpStatus;
    this.code = code;
    this.retryable = httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
  }
}

let competenceStoreCache: { key: string; storeId: string } | null = null;

const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().trim().length(3),
});

const contactSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(300),
  paymentMethod: z.string().trim().min(1).max(40),
  identifier: z.object({
    number: z.string().trim().min(1).max(40).optional(),
  }).passthrough(),
}).passthrough();

const contactsSchema = z.array(contactSchema);

const transactionStatusSchema = z.object({
  id: z.string().trim().min(1).max(200),
  status: z.string().trim().min(1).max(40),
}).passthrough();

const transferSchema = z.object({
  id: z.string().trim().min(1).max(200),
  storeId: z.string().trim().min(1).max(200),
  contactId: z.string().trim().min(1).max(200).nullable().optional(),
  amount: moneySchema,
  fees: moneySchema,
  status: z.string().trim().min(1).max(40),
  paymentMethod: z.string().trim().min(1).max(40),
  beneficiary: z.string().trim().min(1).max(300),
  description: z.string().trim().max(255),
  reference: z.string().trim().min(5).max(100).nullable().optional(),
  createdAt: z.string().trim().min(1).max(100),
  transaction: transactionStatusSchema.nullable().optional(),
}).passthrough();

const partnerTransactionSchema = z.object({
  id: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(40),
  status: z.string().trim().min(1).max(40),
  amount: moneySchema,
  fees: moneySchema,
  currency: z.string().trim().length(3),
  paymentMethod: z.string().trim().min(1).max(40),
  counterpartLabel: z.string().nullable().optional(),
  counterpartIdentifier: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  reference: z.string().trim().min(1).max(200),
  createdAt: z.string().trim().min(1).max(100),
}).passthrough();

const transactionListSchema = z.object({
  total: z.number().int().nonnegative(),
  perPage: z.number().int().positive(),
  currentPage: z.number().int().positive(),
  data: z.array(partnerTransactionSchema),
}).passthrough();

const storeSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(300),
}).passthrough();

const storesSchema = z.array(storeSchema);

type ParsedTransfer = z.infer<typeof transferSchema>;
type ParsedPartnerTransaction = z.infer<typeof partnerTransactionSchema>;

/** Produit la même référence Jèko pour le même enregistrement de retrait. */
export function buildJekoTeacherPayoutReference(payoutRecordId: string) {
  const source = payoutRecordId.trim();
  if (!source) throw new Error("Identifiant de versement professeur manquant.");

  const safeSource = source
    .replace(/[^A-Za-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!safeSource) throw new Error("Identifiant de versement professeur invalide.");

  const prefix = "COMP-PROF-";
  const direct = `${prefix}${safeSource}`;
  if (direct.length <= 100) return direct;

  const digest = createHash("sha256").update(source).digest("hex").slice(0, 16);
  const available = 100 - prefix.length - digest.length - 1;
  return `${prefix}${safeSource.slice(0, available)}-${digest}`;
}

export function mapTeacherPayoutMethodToJeko(method: PaymentMethod): JekoMobileMoneyMethod {
  const mapped = JEKO_PAYOUT_METHOD_MAP[method as SupportedTeacherPayoutMethod];
  if (!mapped) {
    throw new Error(`La méthode de versement ${String(method)} n'est pas prise en charge par Jèko.`);
  }
  return mapped;
}

/**
 * Compare la méthode enregistrée avec celle renvoyée par Jèko.
 * Le contrat actuel utilise `orange`; `orange_money` reste accepté pour les
 * anciens événements déjà émis ou rejoués.
 */
export function jekoPayoutWebhookMethodMatches(method: PaymentMethod | null, value: string) {
  if (!method) return false;
  const normalized = value.trim().toLowerCase();
  const providerMethod = normalized === "orange_money" ? "orange" : normalized;
  return mapTeacherPayoutMethodToJeko(method) === providerMethod;
}

export function normalizeJekoPayoutPhoneNumber(value: string) {
  let normalized = value.trim().replace(/[\s().-]+/g, "");
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  if (/^225\d{10}$/.test(normalized)) normalized = `+${normalized}`;
  if (/^0\d{9}$/.test(normalized)) normalized = `+225${normalized}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Le numéro Mobile Money doit être valide et au format international.");
  }
  return normalized;
}

export async function listJekoMobileMoneyContacts(
  options: JekoPayoutRequestOptions = {},
): Promise<JekoMobileMoneyContact[]> {
  const config = options.config ?? requireJekoServerConfig();
  const { raw } = await jekoPayoutFetchJson(
    `${config.apiBaseUrl}/partner_api/contacts`,
    { method: "GET", cache: "no-store" },
    config,
    options.fetchImpl,
  );
  const contacts = parseJekoResponse(contactsSchema, raw, "liste de contacts");

  return contacts.flatMap((contact) => {
    const method = normalizeJekoMobileMoneyMethod(contact.paymentMethod);
    const phoneNumber = contact.identifier.number;
    if (!method || !phoneNumber) return [];
    try {
      return [{
        id: contact.id,
        name: contact.name,
        paymentMethod: method,
        phoneNumber: normalizeJekoPayoutPhoneNumber(phoneNumber),
      }];
    } catch {
      return [];
    }
  });
}

export async function findJekoMobileMoneyContact(
  input: { paymentMethod: PaymentMethod; phoneNumber: string },
  options: JekoPayoutRequestOptions = {},
) {
  const paymentMethod = mapTeacherPayoutMethodToJeko(input.paymentMethod);
  const phoneNumber = normalizeJekoPayoutPhoneNumber(input.phoneNumber);
  const contacts = await listJekoMobileMoneyContacts(options);
  return contacts.find(
    (contact) => contact.paymentMethod === paymentMethod && contact.phoneNumber === phoneNumber,
  ) ?? null;
}

export async function createJekoMobileMoneyContact(
  input: { teacherName: string; paymentMethod: PaymentMethod; phoneNumber: string },
  options: JekoPayoutRequestOptions = {},
): Promise<JekoMobileMoneyContact> {
  const config = options.config ?? requireJekoServerConfig();
  const teacherName = normalizeTeacherName(input.teacherName);
  const paymentMethod = mapTeacherPayoutMethodToJeko(input.paymentMethod);
  const phoneNumber = normalizeJekoPayoutPhoneNumber(input.phoneNumber);
  const payload = {
    name: teacherName,
    paymentMethod,
    identifier: { number: phoneNumber },
  };
  const { raw } = await jekoPayoutFetchJson(
    `${config.apiBaseUrl}/partner_api/contacts`,
    { method: "POST", body: JSON.stringify(payload) },
    config,
    options.fetchImpl,
  );
  const contact = parseJekoResponse(contactSchema, raw, "contact créé");
  const responseMethod = normalizeJekoMobileMoneyMethod(contact.paymentMethod);
  const responsePhone = contact.identifier.number
    ? normalizeJekoPayoutPhoneNumber(contact.identifier.number)
    : null;
  if (responseMethod !== paymentMethod || responsePhone !== phoneNumber) {
    throw responseMismatch("Jèko a renvoyé un contact différent du bénéficiaire demandé.");
  }
  return {
    id: contact.id,
    name: contact.name,
    paymentMethod,
    phoneNumber,
  };
}

export async function ensureJekoMobileMoneyContact(
  input: { teacherName: string; paymentMethod: PaymentMethod; phoneNumber: string },
  options: JekoPayoutRequestOptions = {},
) {
  const existing = await findJekoMobileMoneyContact(input, options);
  if (existing) return existing;

  try {
    return await createJekoMobileMoneyContact(input, options);
  } catch (error) {
    // Certaines configurations Jèko refusent un doublon de contact. Une
    // seconde lecture rend la création idempotente en cas de course concurrente.
    if (!(error instanceof JekoPayoutApiError) || error.httpStatus !== 409) throw error;
    const racedContact = await findJekoMobileMoneyContact(input, options);
    if (racedContact) return racedContact;
    throw error;
  }
}

export async function getJekoStoreBalance(
  options: JekoPayoutRequestOptions = {},
): Promise<JekoStoreBalance> {
  const config = await resolveJekoCompetenceStoreConfig(options);
  const storeId = normalizeProviderId(config.storeId, "magasin");
  const { raw } = await jekoPayoutFetchJson(
    `${config.apiBaseUrl}/partner_api/stores/${encodeURIComponent(storeId)}/balance`,
    { method: "GET", cache: "no-store" },
    config,
    options.fetchImpl,
  );
  const balance = parseJekoResponse(moneySchema, raw, "solde magasin");
  assertXof(balance.currency, "Le solde magasin Jèko");
  return {
    storeId,
    availableAmountCents: balance.amount,
    availableAmountXof: balance.amount / 100,
    currency: JEKO_CURRENCY,
  };
}

/**
 * Lecture sûre des boutiques disponibles. Cette opération n'ouvre aucun
 * paiement et ne déclenche aucun transfert ; elle sert à contrôler que
 * Production pointe vers la boutique Compétence, pas vers une boutique
 * historique comme Buildify/Bluidify.
 */
export async function getJekoStores(
  options: JekoPayoutRequestOptions = {},
): Promise<JekoStoreSummary[]> {
  const config = options.config ?? requireJekoServerConfig();
  const { raw } = await jekoPayoutFetchJson(
    `${config.apiBaseUrl}/partner_api/stores`,
    { method: "GET", cache: "no-store" },
    config,
    options.fetchImpl,
  );
  const rawStores = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.data)
      ? raw.data
      : isRecord(raw) && Array.isArray(raw.stores)
        ? raw.stores
        : null;
  const stores = parseJekoResponse(storesSchema, rawStores, "liste des magasins");
  return stores.map((store) => ({ id: store.id, name: store.name }));
}

export async function resolveJekoCompetenceStoreConfig(
  options: JekoPayoutRequestOptions = {},
): Promise<JekoServerConfig> {
  const config = options.config ?? requireJekoServerConfig();
  // Les tests injectent un fetch mocké avec une config artificielle. En
  // Production, aucun fetchImpl n'est injecté : on résout alors l'unique
  // boutique officielle pour éviter tout retour vers Buildify/Bluidify.
  if (options.fetchImpl) return config;

  const cacheKey = `${config.apiBaseUrl}:${config.apiKeyId}:${config.storeId}`;
  if (competenceStoreCache?.key === cacheKey) {
    return competenceStoreCache.storeId === config.storeId
      ? config
      : { ...config, storeId: competenceStoreCache.storeId };
  }

  const stores = await getJekoStores({ config });
  const matches = stores.filter((store) => isCompetenceJekoStoreName(store.name));
  if (matches.length !== 1) {
    throw new JekoPayoutApiError(
      `La clé Jèko doit donner accès à une seule boutique ${JEKO_COMPETENCE_STORE_NAME}.`,
      502,
      "JEKO_COMPETENCE_STORE_NOT_FOUND",
    );
  }

  const storeId = normalizeProviderId(matches[0]!.id, "magasin");
  competenceStoreCache = { key: cacheKey, storeId };
  return storeId === config.storeId ? config : { ...config, storeId };
}

export async function getJekoTeacherPayoutTransfer(
  transferId: string,
  options: JekoPayoutRequestOptions = {},
) {
  const config = await resolveJekoCompetenceStoreConfig(options);
  const safeTransferId = normalizeProviderId(transferId, "virement");
  const { raw } = await jekoPayoutFetchJson(
    `${config.apiBaseUrl}/partner_api/transfers/${encodeURIComponent(safeTransferId)}`,
    { method: "GET", cache: "no-store" },
    config,
    options.fetchImpl,
  );
  const transfer = parseJekoResponse(transferSchema, raw, "virement");
  if (transfer.storeId !== config.storeId) {
    throw responseMismatch("Le virement Jèko appartient à un autre magasin.");
  }
  return toTransferDetails(transfer, raw as Record<string, unknown>);
}

/**
 * Exécute le flux serveur complet : contact réutilisé/créé, contrôle du
 * solde puis transfert du net exact. Les frais retournés par Jèko ne sont
 * jamais soustraits du montant professeur : ils sont exposés séparément
 * comme charge Compétence.
 */
export async function createJekoTeacherPayout(
  input: CreateJekoTeacherPayoutInput,
  options: JekoPayoutRequestOptions = {},
): Promise<JekoTeacherPayoutResult> {
  const config = await resolveJekoCompetenceStoreConfig(options);
  const reference = normalizePayoutReference(input.reference);
  const teacherNetAmountCents = xofToJekoAmountCents(input.teacherNetAmountXof);
  if (teacherNetAmountCents < 500) {
    throw new Error("Le montant minimum d'un virement Jèko est de 5 FCFA.");
  }
  const paymentMethod = mapTeacherPayoutMethodToJeko(input.paymentMethod);
  const phoneNumber = normalizeJekoPayoutPhoneNumber(input.phoneNumber);
  const description = normalizeDescription(input.description, reference);
  const contact = await ensureJekoMobileMoneyContact({
    teacherName: input.teacherName,
    paymentMethod: input.paymentMethod,
    phoneNumber,
  }, { ...options, config });
  const balanceBefore = await getJekoStoreBalance({ ...options, config });

  if (balanceBefore.availableAmountCents < teacherNetAmountCents) {
    const existing = await findTransferTransactionByReference(
      {
        reference,
        teacherNetAmountCents,
        paymentMethod,
        phoneNumber,
        referenceCreatedAt: input.referenceCreatedAt,
      },
      { ...options, config },
    );
    if (existing) {
      return transactionToPayoutResult(existing, contact.id, balanceBefore, true);
    }
    throw new JekoPayoutApiError(
      "Le solde du magasin Jèko est insuffisant pour verser le montant net au professeur.",
      400,
      "INSUFFICIENT_BALANCE",
    );
  }

  const payload = {
    storeId: config.storeId,
    contactId: contact.id,
    amountCents: teacherNetAmountCents,
    currency: JEKO_CURRENCY,
    description,
    reference,
  };
  const response = await jekoPayoutFetchJson(
    `${config.apiBaseUrl}/partner_api/transfers`,
    { method: "POST", body: JSON.stringify(payload) },
    config,
    options.fetchImpl,
    [409],
  );

  if (response.httpStatus === 409) {
    const existing = await findTransferTransactionByReference(
      {
        reference,
        teacherNetAmountCents,
        paymentMethod,
        phoneNumber,
        referenceCreatedAt: input.referenceCreatedAt,
      },
      { ...options, config },
    );
    if (existing) {
      return transactionToPayoutResult(existing, contact.id, balanceBefore, true);
    }
    return {
      providerTransferId: null,
      providerTransactionId: null,
      contactId: contact.id,
      storeId: config.storeId,
      reference,
      status: "pending",
      paymentMethod,
      teacherNetAmountCents,
      teacherNetAmountXof: input.teacherNetAmountXof,
      feeCoveredByPlatformCents: null,
      feeCoveredByPlatformXof: null,
      totalPlatformDebitCents: null,
      totalPlatformDebitXof: null,
      duplicate: true,
      reconciliationRequired: true,
      balanceBefore,
      raw: isRecord(response.raw) ? response.raw : {},
    };
  }

  const transfer = parseJekoResponse(transferSchema, response.raw, "virement créé");
  validateCreatedTransfer(transfer, {
    storeId: config.storeId,
    contactId: contact.id,
    reference,
    teacherNetAmountCents,
    paymentMethod,
    phoneNumber,
  });
  const details = toTransferDetails(transfer, response.raw as Record<string, unknown>);
  return {
    providerTransferId: details.providerTransferId,
    providerTransactionId: details.providerTransactionId,
    contactId: contact.id,
    storeId: details.storeId,
    reference: details.reference,
    status: details.status,
    paymentMethod: details.paymentMethod,
    teacherNetAmountCents: details.teacherNetAmountCents,
    teacherNetAmountXof: details.teacherNetAmountXof,
    feeCoveredByPlatformCents: details.feeCoveredByPlatformCents,
    feeCoveredByPlatformXof: details.feeCoveredByPlatformXof,
    totalPlatformDebitCents: details.totalPlatformDebitCents,
    totalPlatformDebitXof: details.totalPlatformDebitXof,
    duplicate: false,
    reconciliationRequired: false,
    balanceBefore,
    raw: details.raw,
  };
}

async function findTransferTransactionByReference(
  expected: {
    reference: string;
    teacherNetAmountCents: number;
    paymentMethod: JekoMobileMoneyMethod;
    phoneNumber: string;
    referenceCreatedAt?: Date | string | null;
  },
  options: JekoPayoutRequestOptions,
) {
  const config = await resolveJekoCompetenceStoreConfig(options);
  const maxPages = 50;
  for (const window of buildTransactionSearchWindows(expected.referenceCreatedAt)) {
    for (let page = 1; page <= maxPages; page += 1) {
      const query = new URLSearchParams({
        storeId: config.storeId,
        page: String(page),
        limit: "100",
        startDate: window.startDate,
        endDate: window.endDate,
      });
      const { raw } = await jekoPayoutFetchJson(
        `${config.apiBaseUrl}/partner_api/transactions?${query.toString()}`,
        { method: "GET", cache: "no-store" },
        config,
        options.fetchImpl,
      );
      const transactions = parseJekoResponse(transactionListSchema, raw, "historique des virements");
      const transaction = transactions.data.find((candidate) => (
        candidate.type.trim().toLowerCase() === "transfer" && candidate.reference === expected.reference
      ));
      if (transaction) {
        validateExistingTransaction(transaction, expected);
        return transaction;
      }

      if (transactions.currentPage * transactions.perPage >= transactions.total) break;
      if (page === maxPages) {
        throw new JekoPayoutApiError(
          "Une fenêtre de l'historique Jèko est trop volumineuse pour confirmer automatiquement la référence.",
          503,
          "HISTORY_SCAN_INCOMPLETE",
        );
      }
    }
  }
  return null;
}

function buildTransactionSearchWindows(referenceCreatedAt?: Date | string | null) {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = startOfUtcDay(new Date());
  const parsed = referenceCreatedAt ? new Date(referenceCreatedAt) : null;
  const earliest = parsed && Number.isFinite(parsed.getTime())
    ? new Date(startOfUtcDay(parsed).getTime() - dayMs)
    : new Date(now.getTime() - 89 * dayMs);
  const windows: Array<{ startDate: string; endDate: string }> = [];
  let end = now;
  while (end.getTime() >= earliest.getTime() && windows.length < 50) {
    const start = new Date(Math.max(earliest.getTime(), end.getTime() - 89 * dayMs));
    windows.push({ startDate: formatUtcDay(start), endDate: formatUtcDay(end) });
    end = new Date(start.getTime() - dayMs);
  }
  return windows;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatUtcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validateCreatedTransfer(
  transfer: ParsedTransfer,
  expected: {
    storeId: string;
    contactId: string;
    reference: string;
    teacherNetAmountCents: number;
    paymentMethod: JekoMobileMoneyMethod;
    phoneNumber: string;
  },
) {
  assertXof(transfer.amount.currency, "Le montant du virement Jèko");
  assertXof(transfer.fees.currency, "Les frais du virement Jèko");
  const responseMethod = normalizeJekoMobileMoneyMethod(transfer.paymentMethod);
  const responsePhone = normalizeJekoPayoutPhoneNumber(transfer.beneficiary);
  if (
    transfer.storeId !== expected.storeId
    || transfer.contactId !== expected.contactId
    || transfer.reference !== expected.reference
    || transfer.amount.amount !== expected.teacherNetAmountCents
    || responseMethod !== expected.paymentMethod
    || responsePhone !== expected.phoneNumber
  ) {
    throw responseMismatch(
      "Jèko a renvoyé un montant, un bénéficiaire ou une référence incohérente.",
    );
  }
}

function validateExistingTransaction(
  transaction: ParsedPartnerTransaction,
  expected: {
    reference: string;
    teacherNetAmountCents: number;
    paymentMethod: JekoMobileMoneyMethod;
    phoneNumber: string;
  },
) {
  assertXof(transaction.amount.currency, "Le montant de la transaction Jèko");
  assertXof(transaction.fees.currency, "Les frais de la transaction Jèko");
  assertXof(transaction.currency, "La transaction Jèko");
  const responseMethod = normalizeJekoMobileMoneyMethod(transaction.paymentMethod);
  const responsePhone = transaction.counterpartIdentifier
    ? normalizeJekoPayoutPhoneNumber(transaction.counterpartIdentifier)
    : null;
  if (
    transaction.reference !== expected.reference
    || transaction.amount.amount !== expected.teacherNetAmountCents
    || responseMethod !== expected.paymentMethod
    || responsePhone !== expected.phoneNumber
  ) {
    throw new JekoPayoutApiError(
      "La référence Jèko existe déjà avec des données différentes.",
      409,
      "IDEMPOTENCY_MISMATCH",
    );
  }
}

function toTransferDetails(
  transfer: ParsedTransfer,
  raw: Record<string, unknown>,
): JekoTransferDetails {
  assertXof(transfer.amount.currency, "Le montant du virement Jèko");
  assertXof(transfer.fees.currency, "Les frais du virement Jèko");
  const paymentMethod = normalizeJekoMobileMoneyMethod(transfer.paymentMethod);
  if (!paymentMethod) {
    throw responseMismatch("Jèko a renvoyé une méthode de virement inconnue.");
  }
  if (!transfer.reference) {
    throw responseMismatch("Jèko n'a pas renvoyé la référence du virement.");
  }
  if (!Number.isFinite(Date.parse(transfer.createdAt))) {
    throw responseMismatch("Jèko a renvoyé une date de virement invalide.");
  }

  const teacherNetAmountXof = safeJekoAmountCentsToXof(transfer.amount.amount);
  const feeCoveredByPlatformXof = jekoFeeCentsToCoveredXof(transfer.fees.amount);
  return {
    providerTransferId: transfer.id,
    providerTransactionId: transfer.transaction?.id ?? null,
    storeId: transfer.storeId,
    contactId: transfer.contactId ?? null,
    reference: transfer.reference,
    status: normalizeJekoPayoutStatus(transfer.status),
    paymentMethod,
    beneficiary: transfer.beneficiary,
    teacherNetAmountCents: transfer.amount.amount,
    teacherNetAmountXof,
    feeCoveredByPlatformCents: transfer.fees.amount,
    feeCoveredByPlatformXof,
    totalPlatformDebitCents: transfer.amount.amount + transfer.fees.amount,
    totalPlatformDebitXof: teacherNetAmountXof + feeCoveredByPlatformXof,
    description: transfer.description,
    createdAt: transfer.createdAt,
    raw,
  };
}

function transactionToPayoutResult(
  transaction: ParsedPartnerTransaction,
  contactId: string,
  balanceBefore: JekoStoreBalance,
  duplicate: boolean,
): JekoTeacherPayoutResult {
  const method = normalizeJekoMobileMoneyMethod(transaction.paymentMethod);
  if (!method) throw responseMismatch("Méthode du virement Jèko inconnue.");
  const teacherNetAmountXof = safeJekoAmountCentsToXof(transaction.amount.amount);
  const feeCoveredByPlatformXof = jekoFeeCentsToCoveredXof(transaction.fees.amount);
  return {
    providerTransferId: null,
    providerTransactionId: transaction.id,
    contactId,
    storeId: balanceBefore.storeId,
    reference: transaction.reference,
    status: normalizeJekoPayoutStatus(transaction.status),
    paymentMethod: method,
    teacherNetAmountCents: transaction.amount.amount,
    teacherNetAmountXof,
    feeCoveredByPlatformCents: transaction.fees.amount,
    feeCoveredByPlatformXof,
    totalPlatformDebitCents: transaction.amount.amount + transaction.fees.amount,
    totalPlatformDebitXof: teacherNetAmountXof + feeCoveredByPlatformXof,
    duplicate,
    reconciliationRequired: false,
    balanceBefore,
    raw: transaction as Record<string, unknown>,
  };
}

function normalizeJekoPayoutStatus(value: string): JekoPayoutStatus {
  const normalized = value.trim().toLowerCase();
  if (["success", "successful", "completed", "paid"].includes(normalized)) return "success";
  if (["error", "failed", "failure", "cancelled", "canceled"].includes(normalized)) return "failed";
  if (["pending", "created", "processing", "in_progress"].includes(normalized)) return "pending";
  throw responseMismatch(`Statut de virement Jèko inconnu : ${value}.`);
}

function normalizeJekoMobileMoneyMethod(value: string): JekoMobileMoneyMethod | null {
  const normalized = value.trim().toLowerCase();
  // Accept the old spelling defensively when reconciling an archived provider
  // payload, but always normalize to the official Jèko value.
  if (normalized === "orange_money") return "orange";
  if (["wave", "orange", "mtn", "moov", "djamo"].includes(normalized)) {
    return normalized as JekoMobileMoneyMethod;
  }
  return null;
}

function normalizeTeacherName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 200) throw new Error("Nom du professeur invalide pour Jèko.");
  return name;
}

function normalizeDescription(value: string | null | undefined, reference: string) {
  const description = value?.trim() || `Versement professeur ${reference}`;
  if (description.length > 255) throw new Error("La description du virement Jèko est trop longue.");
  return description;
}

function normalizePayoutReference(value: string) {
  const reference = value.trim();
  if (
    reference.length < 5
    || reference.length > 100
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(reference)
  ) {
    throw new Error("La référence du virement Jèko doit contenir 5 à 100 caractères sûrs.");
  }
  return reference;
}

function normalizeProviderId(value: string, label: string) {
  const id = value.trim();
  if (!id || id.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new Error(`Identifiant Jèko de ${label} invalide.`);
  }
  return id;
}

function assertXof(value: string, label: string) {
  if (value.trim().toUpperCase() !== JEKO_CURRENCY) {
    throw responseMismatch(`${label} n'est pas libellé en XOF.`);
  }
}

function safeJekoAmountCentsToXof(amountCents: number) {
  try {
    return jekoAmountCentsToXof(amountCents);
  } catch {
    throw responseMismatch("Le montant net Jèko ne correspond pas à un nombre entier de FCFA.");
  }
}

function parseJekoResponse<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new JekoPayoutApiError(
      `Réponse Jèko invalide pour ${label}.`,
      502,
      "INVALID_RESPONSE",
    );
  }
  return parsed.data;
}

function responseMismatch(message: string) {
  return new JekoPayoutApiError(message, 502, "RESPONSE_MISMATCH");
}

async function jekoPayoutFetchJson(
  url: string,
  init: RequestInit,
  config: JekoServerConfig,
  fetchImpl: typeof fetch = fetch,
  allowedErrorStatuses: readonly number[] = [],
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": config.apiKey,
        "X-API-KEY-ID": config.apiKeyId,
        ...init.headers,
      },
      signal: controller.signal,
    });
    const rawText = await response.text();
    let raw: unknown = null;
    if (rawText) {
      try {
        raw = JSON.parse(rawText);
      } catch {
        throw new JekoPayoutApiError("Jèko a renvoyé une réponse non JSON.", 502, "INVALID_JSON");
      }
    }

    if (!response.ok && !allowedErrorStatuses.includes(response.status)) {
      const apiError = isRecord(raw) ? raw : {};
      const code = firstString(apiError.id, apiError.code);
      const message = firstString(apiError.message, apiError.extras)
        ?? `Jèko a refusé le virement (HTTP ${response.status}).`;
      throw new JekoPayoutApiError(message, response.status, code);
    }
    if (response.ok && raw === null) {
      throw new JekoPayoutApiError("Jèko a renvoyé une réponse vide.", 502, "INVALID_JSON");
    }
    return { httpStatus: response.status, raw };
  } catch (error) {
    if (error instanceof JekoPayoutApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new JekoPayoutApiError("Le délai de réponse Jèko est dépassé.", 504, "TIMEOUT");
    }
    throw new JekoPayoutApiError("Impossible de joindre Jèko pour le virement.", 502, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
