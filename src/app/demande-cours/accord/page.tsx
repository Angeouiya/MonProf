import { ManagedPublicShell } from "@/components/managed/public-shell";
import { ManagedContract } from "@/components/managed/contract";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function ManagedAgreementPage() {
  return <ManagedPublicShell><ManagedContract /></ManagedPublicShell>;
}
