const JEKO_CHECKOUT_ORIGIN = "https://pay.jeko.africa";

// L'API Jèko documente aujourd'hui des UUID. Le préfixe `pr_`/`pr-` reste
// accepté pour relire les anciennes identités déjà supportées par le
// rapprochement, sans ouvrir la redirection à un slug arbitraire.
const JEKO_PAYMENT_REQUEST_ID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|pr[_-][A-Za-z0-9_-]{4,150})$/i;
const JEKO_PAYMENT_PATH_PATTERN = /^\/payment\/([^/]+)\/?$/;
const JEKO_SHORT_CHECKOUT_PATH_PATTERN = /^\/(?:pr|c)\/[A-Za-z0-9_-]{2,150}\/?$/;

export function isJekoPaymentRequestId(value: string | null | undefined) {
  return Boolean(value && JEKO_PAYMENT_REQUEST_ID_PATTERN.test(value));
}

/**
 * Produit l'unique destination de checkout autorisée à partir de l'identité
 * fournisseur. Cette forme reste le filet de sécurité si Jèko ne renvoie pas
 * de `redirectUrl` courte conforme à notre allowlist.
 */
export function buildCanonicalJekoCheckoutUrl(paymentRequestId: string) {
  const id = paymentRequestId.trim();
  if (!isJekoPaymentRequestId(id)) {
    throw new Error("Identifiant de demande Jèko invalide.");
  }
  return `${JEKO_CHECKOUT_ORIGIN}/payment/${id}`;
}

/**
 * Jèko peut renvoyer une URL de checkout courte (`/pr/...`) en production.
 * On la conserve si elle reste sur le domaine officiel ; sinon on retombe sur
 * la forme déterministe documentée à partir de l'ID fournisseur validé.
 */
export function resolveJekoCheckoutUrl(
  paymentRequestId: string,
  providerRedirectUrl?: string | null,
) {
  const canonical = buildCanonicalJekoCheckoutUrl(paymentRequestId);
  const safeProviderUrl = normalizeAllowedJekoRedirectUrl(
    providerRedirectUrl,
    paymentRequestId,
  );
  return safeProviderUrl ?? canonical;
}

/** Validation utilisable côté serveur comme côté navigateur. */
export function isAllowedJekoRedirectUrl(
  value: string | null | undefined,
  expectedPaymentRequestId?: string,
) {
  return Boolean(normalizeAllowedJekoRedirectUrl(value, expectedPaymentRequestId));
}

function normalizeAllowedJekoRedirectUrl(
  value: string | null | undefined,
  expectedPaymentRequestId?: string,
) {
  if (!value || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (
      url.origin !== JEKO_CHECKOUT_ORIGIN
      || url.protocol !== "https:"
      || url.hostname.toLowerCase() !== "pay.jeko.africa"
      || url.port
      || url.username
      || url.password
      || url.search
      || url.hash
    ) {
      return null;
    }

    const paymentPath = JEKO_PAYMENT_PATH_PATTERN.exec(url.pathname);
    if (paymentPath) {
      const id = paymentPath[1];
      if (!isJekoPaymentRequestId(id)) return null;
      const matchesExpected = !expectedPaymentRequestId
      || id.toLowerCase() === expectedPaymentRequestId.trim().toLowerCase();
      return matchesExpected ? url.toString() : null;
    }

    if (JEKO_SHORT_CHECKOUT_PATH_PATTERN.test(url.pathname)) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}
