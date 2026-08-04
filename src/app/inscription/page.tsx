import { InscriptionForm } from "@/components/auth/inscription-form";
import { getSafeInternalReturnPath } from "@/lib/safe-return-path";

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return <InscriptionForm returnTo={getSafeInternalReturnPath(from)} />;
}
