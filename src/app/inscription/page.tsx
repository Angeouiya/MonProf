import { InscriptionForm } from "@/components/auth/inscription-form";
import { getCachedCommunes } from "@/lib/catalog-cache";

export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const communes = await getCachedCommunes();

  return <InscriptionForm communes={communes} />;
}
