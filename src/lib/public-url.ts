import type { NextRequest } from "next/server";

const PRODUCTION_APP_ORIGIN = "https://competence.ci";

export function getPublicAppOrigin(req?: NextRequest) {
  const requestOrigin = req?.nextUrl.origin;
  if (requestOrigin && isLocalOrigin(requestOrigin)) {
    return requestOrigin.replace(/\/+$/, "");
  }
  return PRODUCTION_APP_ORIGIN;
}

export function absoluteAppUrl(path: string, req?: NextRequest) {
  return new URL(path, getPublicAppOrigin(req)).toString();
}

function isLocalOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}
