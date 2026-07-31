const JEKO_CHECKOUT_ORIGIN = "https://pay.jeko.africa";

// L'API Jèko documente aujourd'hui des UUID. Le préfixe `pr_`/`pr-` reste
// accepté pour relire les anciennes identités déjà supportées par le
// rapprochement, sans ouvrir la redirection à un slug arbitraire.
const JEKO_PAYMENT_REQUEST_ID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|pr[_-][A-Za-z0-9_-]{4,150})$/i;

export function isJekoPaymentRequestId(value: string | null | undefined) {
  return Boolean(value && JEKO_PAYMENT_REQUEST_ID_PATTERN.test(value));
}

/**
 * Produit l'unique destination de checkout autorisée à partir de l'identité
 * fournisseur. La valeur `redirectUrl` de la réponse distante n'est jamais
 * relayée telle quelle au navigateur.
 */
export function buildCanonicalJekoCheckoutUrl(paymentRequestId: string) {
  const id = paymentRequestId.trim();
  if (!isJekoPaymentRequestId(id)) {
    throw new Error("Identifiant de demande Jèko invalide.");
  }
  return `${JEKO_CHECKOUT_ORIGIN}/payment/${id}`;
}

/** Validation utilisable côté serveur comme côté navigateur. */
export function isAllowedJekoRedirectUrl(
  value: string | null | undefined,
  expectedPaymentRequestId?: string,
) {
  if (!value || value !== value.trim()) return false;
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
      return false;
    }

    const match = /^\/payment\/([^/]+)\/?$/.exec(url.pathname);
    if (!match) return false;
    const id = match[1];
    if (!isJekoPaymentRequestId(id)) return false;
    return !expectedPaymentRequestId
      || id.toLowerCase() === expectedPaymentRequestId.trim().toLowerCase();
  } catch {
    return false;
  }
}
