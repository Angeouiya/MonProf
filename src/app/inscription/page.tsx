import { InscriptionForm } from "@/components/auth/inscription-form";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";

export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const { communes } = await getCachedTeacherSearchCatalog();

  return <InscriptionForm communes={communes} />;
}
