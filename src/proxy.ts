import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getNextAuthSecret } from "@/lib/auth-secret";

const PASSWORD_CHANGE_ERROR = {
  error: "Vous devez remplacer votre mot de passe temporaire avant d'utiliser votre espace.",
  code: "PASSWORD_CHANGE_REQUIRED",
};

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: getNextAuthSecret() });
  if (token?.role !== "CLIENT" || token.passwordMustChange !== true) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (pathname === "/api/client/profile" && request.method === "PATCH") {
    return NextResponse.next();
  }

  return NextResponse.json(PASSWORD_CHANGE_ERROR, {
    status: 403,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export const config = {
  matcher: "/api/:path*",
};
