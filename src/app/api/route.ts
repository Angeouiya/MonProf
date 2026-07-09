import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "competence",
    status: "online",
    health: "/api/health",
  });
}
