export const PASSWORD_RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000;
export const MAX_PASSWORD_RESET_REQUESTS_PER_WINDOW = 3;
export const MAX_PASSWORD_RESET_REQUESTS_PER_IP_WINDOW = 12;
export const PASSWORD_RESET_AUDIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Garde le quota indépendant des réponses HTTP pour préserver l'anti-énumération. */
export function isPasswordResetRequestAllowed(recentRequestCount: number) {
  return recentRequestCount < MAX_PASSWORD_RESET_REQUESTS_PER_WINDOW;
}

export function isPasswordResetIpAllowed(recentRequestCount: number) {
  return recentRequestCount < MAX_PASSWORD_RESET_REQUESTS_PER_IP_WINDOW;
}
