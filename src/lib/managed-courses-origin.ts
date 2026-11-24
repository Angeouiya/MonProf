// Only the actual request origin or administrator-configured public origins
// are accepted. Never trust client-supplied Forwarded/X-Forwarded-Host headers.
export function isManagedRequestOriginAllowed(requestUrl: string, origin: string | null, configured: (string | undefined)[]) {
  if (!origin) return false;
  const target = new URL(requestUrl);
  if (origin === target.origin) return true;
  for (const value of configured) {
    if (!value) continue;
    try {
      const expected = new URL(value.trim());
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname);
      if ((expected.protocol === "https:" || (expected.protocol === "http:" && loopback)) && expected.origin === origin) return true;
    } catch { /* Invalid configuration must not widen access. */ }
  }
  return false;
}
