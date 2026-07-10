import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Search, X } from "lucide-react";
import { CommunesClient } from "./client";
import { formatFCFA } from "@/lib/format";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminCommunesPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string; transport?: string; page?: string }> }) {
  await requireAdmin("CATALOG_MANAGE");
  const query = searchParams ? await searchParams : {};
  const q = query.q?.trim() ?? "";
  const status = ["active", "inactive"].includes(query.status ?? "") ? query.status : "all";
  const transport = ["GRAND_ABIDJAN", "PERI_URBAN", "INTERIOR"].includes(query.transport ?? "") ? query.transport : "all";
  const currentPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = 24;
  const where = {
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { zone: { contains: q, mode: "insensitive" as const } },
      { quarters: { some: { name: { contains: q, mode: "insensitive" as const } } } },
      { quarters: { some: { aliases: { contains: q, mode: "insensitive" as const } } } },
    ] } : {}),
    ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    ...(transport !== "all" ? { transportClass: transport as "GRAND_ABIDJAN" | "PERI_URBAN" | "INTERIOR" } : {}),
  };
  const [[communes, filteredTotal, total, active, quarters, activeQuarters, grandAbidjan], settings] = await Promise.all([
    db.$transaction([
      db.commune.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, slug: true, zone: true, transportClass: true,
          transportFeeOverride: true, isActive: true,
          quarters: { orderBy: { name: "asc" }, select: { id: true, name: true, aliases: true, isActive: true } },
          _count: { select: { teachers: true, quarters: true } },
        },
      }),
      db.commune.count({ where }),
      db.commune.count(),
      db.commune.count({ where: { isActive: true } }),
      db.communeQuarter.count(),
      db.communeQuarter.count({ where: { isActive: true, commune: { isActive: true } } }),
      db.commune.count({ where: { transportClass: "GRAND_ABIDJAN", isActive: true } }),
    ]),
    getPlatformRuntimeSettings(),
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status ?? "all");
    if (transport !== "all") params.set("transport", transport ?? "all");
    if (page > 1) params.set("page", String(page));
    const suffix = params.toString();
    return `/admin/communes${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Communes & quartiers" description="Référentiel géographique, disponibilité et calcul automatique des déplacements" rootPage>
        <CommunesClient />
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Communes actives" value={`${active}/${total}`} />
        <Stat label="Quartiers actifs" value={`${activeQuarters}/${quarters}`} />
        <Stat label="Grand Abidjan" value={String(grandAbidjan)} />
        <Stat label="Ville intérieure" value={formatFCFA(settings.transportFees.interior)} />
      </div>

      <Card className="border-[#DDE6F7] bg-white"><CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white"><MapPin className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold text-[#111827]">Matrice de déplacement active</h2><p className="mt-1 text-xs leading-5 text-[#64748B]">Même quartier : 0 FCFA. Les frais sont séparés du cours, sans commission, et reversés au professeur.</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Même commune" value={formatFCFA(settings.transportFees.sameCommune)} compact />
          <Stat label="Commune proche" value={formatFCFA(settings.transportFees.nearCommune)} compact />
          <Stat label="Commune éloignée" value={formatFCFA(settings.transportFees.farCommune)} compact />
          <Stat label="Ville intérieure" value={formatFCFA(settings.transportFees.interior)} compact />
        </div>
      </CardContent></Card>

      <Card className="border-[#DDE6F7] bg-white"><CardContent className="p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_210px_210px_auto]">
          <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" /><Input name="q" defaultValue={q} placeholder="Rechercher une commune ou un quartier" className="pl-9" /></div>
          <select name="status" defaultValue={status} className="h-11 rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111827]"><option value="all">Tous les statuts</option><option value="active">Actives</option><option value="inactive">Inactives</option></select>
          <select name="transport" defaultValue={transport} className="h-11 rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111827]"><option value="all">Toutes les zones</option><option value="GRAND_ABIDJAN">Grand Abidjan</option><option value="PERI_URBAN">Périurbain</option><option value="INTERIOR">Intérieur</option></select>
          <div className="flex gap-2"><Button type="submit" className="min-h-11 bg-[#111B4D] text-white hover:bg-[#0B143D]">Filtrer</Button>{(q || status !== "all" || transport !== "all") && <Button asChild variant="outline" size="icon" className="h-11 w-11"><a href="/admin/communes" aria-label="Réinitialiser"><X className="h-4 w-4" /></a></Button>}</div>
        </form>
      </CardContent></Card>

      {communes.length === 0 ? <EmptyState icon={MapPin} title="Aucun lieu trouvé" description="Modifiez les filtres ou ajoutez une commune." /> : (
        <><div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {communes.map((commune) => (
            <Card key={commune.id} className="border-[#DDE6F7] bg-white"><CardContent className="p-4">
              <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#111827]">{commune.name}</h3><p className="mt-1 truncate text-xs text-[#64748B]">{commune.zone || "Côte d'Ivoire"}</p></div></div><CommunesClient commune={commune} /></div>
              <div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline" className={commune.isActive ? "border-[#111B4D] text-[#111B4D]" : "border-red-200 text-red-700"}>{commune.isActive ? "Active" : "Inactive"}</Badge><Badge variant="outline" className="border-[#DDE6F7] text-[#475569]">{transportLabel(commune.transportClass)}</Badge>{commune.transportFeeOverride !== null && <Badge variant="outline" className="border-[#DDE6F7] text-[#475569]">Forfait {formatFCFA(commune.transportFeeOverride)}</Badge>}</div>
              <div className="mt-4 grid grid-cols-2 gap-2"><Stat label="Quartiers" value={String(commune._count.quarters)} compact /><Stat label="Professeurs" value={String(commune._count.teachers)} compact /></div>
              <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[#64748B]">{commune.quarters.filter((item) => item.isActive).slice(0, 5).map((item) => item.name).join(" · ") || "Aucun quartier enregistré"}</p>
            </CardContent></Card>
          ))}
        </div>{totalPages > 1 && <nav className="flex items-center justify-between rounded-lg border border-[#DDE6F7] bg-white p-3" aria-label="Pagination des communes"><Button asChild variant="outline" className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}><Link href={pageHref(Math.max(1, currentPage - 1))}>Précédent</Link></Button><p className="text-xs font-semibold text-[#64748B]">Page {Math.min(currentPage, totalPages)} sur {totalPages} · {filteredTotal} communes</p><Button asChild variant="outline" className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}><Link href={pageHref(Math.min(totalPages, currentPage + 1))}>Suivant</Link></Button></nav>}</>
      )}
    </div>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) { return <div className={`rounded-lg border border-[#DDE6F7] bg-white ${compact ? "px-3 py-2.5" : "p-4"}`}><p className="text-[10px] font-semibold uppercase text-[#64748B]">{label}</p><p className="mt-1 text-sm font-semibold text-[#111827]">{value}</p></div>; }
function transportLabel(value: string) { return value === "GRAND_ABIDJAN" ? "Grand Abidjan" : value === "PERI_URBAN" ? "Périurbain" : "Intérieur"; }
