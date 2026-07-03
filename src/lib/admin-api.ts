import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireAdminApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return null;
  return {
    id: (session.user as any).id as string,
    name: session.user.name || "Admin",
    email: session.user.email || "",
  };
}
