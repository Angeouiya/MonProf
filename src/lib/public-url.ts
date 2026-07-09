import type { NextRequest } from "next/server";

const PRODUCTION_APP_ORIGIN = "https://competence.ci";

export function getPublicAppOrigin(req?: NextRequest) {
  return firstPublicOrigin(
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    req?.nextUrl.origin,
  ) ?? PRODUCTION_APP_ORIGIN;
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

function normalizePublicOrigin(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}
