"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export function PaiementsFiltersClient({ filters }: { filters: { method: string; status: string; from: string; to: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const hasFilters = Boolean(filters.method || filters.status || filters.from || filters.to);
  const hasAdvancedFilters = Boolean(filters.method || filters.from || filters.to);

  const apply = (next: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    params.delete("page");
    params.delete("payoutPage");
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.push(`/admin/paiements${params.size ? `?${params.toString()}` : ""}`);
  };

  const reset = () => router.push("/admin/paiements");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <Label className="text-xs">Statut</Label>
          <Select value={filters.status || "all"} onValueChange={(v) => apply({ status: v === "all" ? "" : v })}>
            <SelectTrigger className="mt-1 min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="FAILED">Échec</SelectItem>
              <SelectItem value="RECEIVED">Reçu</SelectItem>
              <SelectItem value="BLOCKED">Bloqué</SelectItem>
              <SelectItem value="VALIDATED">Validé</SelectItem>
              <SelectItem value="TO_PAY_TEACHER">À payer prof</SelectItem>
              <SelectItem value="TEACHER_PAID">Prof payé</SelectItem>
              <SelectItem value="DISPUTED">Litige</SelectItem>
              <SelectItem value="REFUND_PENDING">Remb. à traiter</SelectItem>
              <SelectItem value="PARTIAL_REFUND_PENDING">Remb. partiel à traiter</SelectItem>
              <SelectItem value="REFUNDED">Remboursé</SelectItem>
              <SelectItem value="PARTIALLY_REFUNDED">Remboursé partiel</SelectItem>
              <SelectItem value="RETAINED">Frais retenus</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters && <Button type="button" variant="outline" onClick={reset} className="min-h-11"><X className="mr-1 h-4 w-4" /> Effacer</Button>}
      </div>
      <details open={hasAdvancedFilters || undefined} className="rounded-lg border border-[#E3E8F2] bg-white p-3">
        <summary className="min-h-8 cursor-pointer text-sm font-semibold text-[#111B4D]">Méthode et dates</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Méthode</Label>
            <Select value={filters.method || "all"} onValueChange={(v) => apply({ method: v === "all" ? "" : v })}>
              <SelectTrigger className="mt-1 min-h-11"><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes méthodes</SelectItem>
                <SelectItem value="WAVE">Wave</SelectItem>
                <SelectItem value="ORANGE_MONEY">Orange Money</SelectItem>
                <SelectItem value="MTN_MONEY">MTN Money</SelectItem>
                <SelectItem value="MOOV_MONEY">Moov Money</SelectItem>
                <SelectItem value="DJAMO">Djamo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Du</Label>
            <Input type="date" className="mt-1 min-h-11" value={filters.from} onChange={(e) => apply({ from: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Au</Label>
            <Input type="date" className="mt-1 min-h-11" value={filters.to} onChange={(e) => apply({ to: e.target.value })} />
          </div>
        </div>
      </details>
    </div>
  );
}
