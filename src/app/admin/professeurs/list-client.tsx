"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";

export function ProfesseursListClient({
  filters,
  subjects,
  communes,
}: {
  filters: { q: string; status: string; subject: string; commune: string; badge: string };
  subjects: { id: string; name: string; slug: string }[];
  communes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(filters.q);

  const buildHref = (next: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    return `/admin/professeurs?${params.toString()}`;
  };

  const apply = (next: Record<string, string>) => router.push(buildHref(next));
  const applyQ = (e: React.FormEvent) => {
    e.preventDefault();
    apply({ q });
  };

  const reset = () => router.push("/admin/professeurs");

  const hasFilters = useMemo(() => filters.q || filters.status || filters.subject || filters.commune || filters.badge, [filters]);

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={applyQ} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label htmlFor="q" className="sr-only">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, email, téléphone..."
                className="pl-9"
              />
            </div>
          </div>

          <Select value={filters.status || "all"} onValueChange={(v) => apply({ status: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="ACTIVE">Actif</SelectItem>
              <SelectItem value="INACTIVE">Inactif</SelectItem>
              <SelectItem value="SUSPENDED">Suspendu</SelectItem>
              <SelectItem value="PENDING">En attente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.subject || "all"} onValueChange={(v) => apply({ subject: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes matières</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.commune || "all"} onValueChange={(v) => apply({ commune: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Commune" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes communes</SelectItem>
              {communes.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.badge || "all"} onValueChange={(v) => apply({ badge: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Badge" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous badges</SelectItem>
              <SelectItem value="verified">Vérifié</SelectItem>
              <SelectItem value="recommended">Recommandé</SelectItem>
              <SelectItem value="new">Nouveau</SelectItem>
              <SelectItem value="popular">Populaire</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="featured">Mis en avant</SelectItem>
            </SelectContent>
          </Select>
        </form>

        {hasFilters && (
          <div className="mt-3 flex items-center justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <X className="mr-1.5 h-4 w-4" /> Réinitialiser
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
