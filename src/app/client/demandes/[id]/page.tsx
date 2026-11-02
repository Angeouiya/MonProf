import { redirect } from "next/navigation";
import { requireClient } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { ClientMarketplaceRequest } from "@/components/marketplace/client-marketplace-request";

export default async function ClientDemandeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!marketplaceEnabled()) redirect("/client");
  await requireClient();
  const { id } = await params;
  return <ClientMarketplaceRequest requestId={id} />;
}
