import type { NextRequest } from "next/server";

const PRODUCTION_APP_ORIGIN = "https://www.competence.ci";

export function getPublicAppOrigin(req?: NextRequest) {
  if (process.env.VERCEL_ENV === "preview") {
    const previewOrigin = normalizeVercelOrigin(process.env.VERCEL_URL);
    if (previewOrigin) return previewOrigin;
  }

  if (process.env.NODE_ENV !== "production" && req) {
    const requestOrigin = normalizePublicOrigin(req.nextUrl.origin, true);
    if (requestOrigin) return requestOrigin;
  }

  const configuredOrigin = firstPublicOrigin(
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  );
  if (configuredOrigin) return configuredOrigin;

  const vercelOrigin = normalizeVercelOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL,
  );
  if (vercelOrigin) return vercelOrigin;

  return PRODUCTION_APP_ORIGIN;
}

export function absoluteAppUrl(path: string, req?: NextRequest) {
  return new URL(path, getPublicAppOrigin(req)).toString();
}

function firstPublicOrigin(...values: Array<string | undefined>) {
  for (const value of values) {
    const origin = normalizePublicOrigin(value);
    if (origin) return origin;
  }
  return null;
}

function normalizePublicOrigin(value?: string | null, allowHttpLocal = false) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(allowHttpLocal && local && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeVercelOrigin(value?: string | null) {
  if (!value) return null;
  return normalizePublicOrigin(value.includes("://") ? value : `https://${value}`);
}
