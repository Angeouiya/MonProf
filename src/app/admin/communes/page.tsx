import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MapPin, Search, X } from "lucide-react";
import { CommunesClient } from "./client";
import { GRAND_ABIDJAN_AREAS, GRAND_ABIDJAN_NEAR_ROUTES, TRANSPORT_FEES } from "@/lib/pricing";
import { formatFCFA } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminCommunesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const sp = searchParams ? await searchParams : {};
  const q = sp.q?.trim() ?? "";
  const communes = await db.commune.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { zone: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Communes & quartiers" description={`${communes.length} commune(s)${q ? ` pour "${q}"` : ""}`} />
      <Card className="border-violet-100 bg-white">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-foreground">Matrice officielle de déplacement</p>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                La réservation calcule automatiquement le trajet professeur vers client. Le déplacement est séparé du cours, reversé au professeur et sans commission plateforme.
              </p>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-3 lg:min-w-[520px]">
              <MatrixPill label="Même zone" value={formatFCFA(TRANSPORT_FEES.SAME_AREA.amount)} />
              <MatrixPill label="Commune proche" value={formatFCFA(TRANSPORT_FEES.NEAR_COMMUNE.amount)} />
              <MatrixPill label="Commune éloignée" value={formatFCFA(TRANSPORT_FEES.FAR_COMMUNE.amount)} />
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-violet-100 bg-violet-50/45 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-950/55">Zones couvertes par la matrice</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {GRAND_ABIDJAN_AREAS.map((area) => (
                  <span key={area} className="rounded-full border border-violet-100 bg-white px-3 py-1 text-xs font-bold text-violet-900">
                    {area}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-950/55">Routes proches à {formatFCFA(TRANSPORT_FEES.NEAR_COMMUNE.amount)}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {GRAND_ABIDJAN_NEAR_ROUTES.slice(0, 12).map(([from, to]) => (
                  <p key={`${from}-${to}`} className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-blue-950">
                    {from} {"->"} {to}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-blue-950/70">
                Les routes proches sont calculées automatiquement. Les villes hors zone de proximité utilisent un forfait interurbain automatique.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <form
        method="GET"
        action="/admin/communes"
        className="grid gap-2 rounded-lg border border-violet-100 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
      >
        <label className="relative block min-w-0">
          <span className="sr-only">Rechercher une ville ou commune</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Saisir une ville, commune ou zone..."
            className="min-h-11 w-full rounded-lg border border-violet-100 bg-white pl-10 pr-3 text-sm font-medium outline-none transition focus:border-[#111B4D] focus:ring-2 focus:ring-violet-100"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white transition hover:bg-[#1E2A78]"
        >
          <Search className="h-4 w-4" />
          Rechercher
        </button>
        {q && (
          <a
            href="/admin/communes"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-violet-100 bg-white px-4 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
          >
            <X className="h-4 w-4" />
            Effacer
          </a>
        )}
      </form>
      {communes.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={q ? "Aucune commune ne correspond à la recherche" : "Aucune commune"}
          description={q ? "Essayez une autre ville, une autre orthographe ou effacez la recherche." : "Ajoutez votre première commune."}
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {communes.map((c) => (
              <Card key={c.id} className="border-violet-100 bg-white">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{c.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Zone : {c.zone ?? "—"}</p>
                    <p className="mt-2 text-xs font-semibold text-violet-800">{c._count.teachers} professeur(s)</p>
                  </div>
                  <CommunesClient commune={c} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Zone</TableHead>
                  <TableHead className="text-right">Professeurs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {communes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.zone ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{c._count.teachers}</TableCell>
                    <TableCell className="text-right"><CommunesClient commune={c} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </CardContent>
          </Card>
        </>
      )}
      <CommunesClient />
    </div>
  );
}

function MatrixPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2">
      <p className="font-bold text-violet-950">{label}</p>
      <p className="mt-0.5 font-black text-[#1E2A78]">{value}</p>
    </div>
  );
}
