import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/teacher-auth";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { ProfessorMarketplaceWallet } from "@/components/marketplace/professor-marketplace-wallet";

export default async function ProfessorWalletPage() {
  if (!marketplaceEnabled()) redirect("/professeur/paiements");
  await requireTeacher();
  return <ProfessorMarketplaceWallet />;
}
