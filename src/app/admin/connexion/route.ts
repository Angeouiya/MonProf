import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/connexion";
  url.searchParams.set("from", "/admin");
  return NextResponse.redirect(url);
}
