"use client";

const FALLBACK_PUBLIC_ORIGIN = "https://competence.ci";

export function getClientPublicOrigin() {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  return configured ?? FALLBACK_PUBLIC_ORIGIN;
}

export function publicClientUrl(path: string) {
  return new URL(path, getClientPublicOrigin()).toString();
}

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
