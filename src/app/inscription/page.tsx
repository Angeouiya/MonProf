import { db } from "@/lib/db";
import { InscriptionForm } from "@/components/auth/inscription-form";

export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const communes = await db.commune.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <InscriptionForm communes={communes} />;
}
