import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/teacher-auth";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { ProfessorMarketplaceMission } from "@/components/marketplace/professor-marketplace-mission";

export default async function MarcheMissionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!marketplaceEnabled()) redirect("/professeur/missions");
  await requireTeacher();
  const { id } = await params;
  return <ProfessorMarketplaceMission requestId={id} />;
}
