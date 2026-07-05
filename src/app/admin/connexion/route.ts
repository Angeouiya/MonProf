import { NextResponse } from "next/server";

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  const safeHost = hostHeader.startsWith("0.0.0.0") ? hostHeader.replace("0.0.0.0", "localhost") : hostHeader;
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const url = new URL(`${protocol}://${safeHost}/connexion`);
  url.searchParams.set("from", "/admin");

  return NextResponse.redirect(url);
}
