import { InscriptionForm } from "@/components/auth/inscription-form";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import { getSafeInternalReturnPath } from "@/lib/safe-return-path";

export const dynamic = "force-dynamic";

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const { communes } = await getCachedTeacherSearchCatalog();

  return <InscriptionForm communes={communes} returnTo={getSafeInternalReturnPath(from)} />;
}
