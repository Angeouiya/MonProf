"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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

  const apply = (next: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.push(`/admin/paiements?${params.toString()}`);
  };

  const reset = () => router.push("/admin/paiements");

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-xs">Méthode</Label>
            <Select value={filters.method || "all"} onValueChange={(v) => apply({ method: v === "all" ? "" : v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes méthodes</SelectItem>
                <SelectItem value="WAVE">Wave</SelectItem>
                <SelectItem value="ORANGE_MONEY">Orange Money</SelectItem>
                <SelectItem value="MTN_MONEY">MTN Money</SelectItem>
                <SelectItem value="MOOV_MONEY">Moov Money</SelectItem>
                <SelectItem value="CARD">Carte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={filters.status || "all"} onValueChange={(v) => apply({ status: v === "all" ? "" : v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="FAILED">Échec</SelectItem>
                <SelectItem value="RECEIVED">Reçu</SelectItem>
                <SelectItem value="BLOCKED">Bloqué</SelectItem>
                <SelectItem value="VALIDATED">Validé</SelectItem>
                <SelectItem value="TO_PAY_TEACHER">À payer prof</SelectItem>
                <SelectItem value="TEACHER_PAID">Prof payé</SelectItem>
                <SelectItem value="DISPUTED">Litige</SelectItem>
                <SelectItem value="REFUNDED">Remboursé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Du</Label>
            <Input type="date" className="mt-1" value={filters.from} onChange={(e) => apply({ from: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Au</Label>
            <Input type="date" className="mt-1" value={filters.to} onChange={(e) => apply({ to: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={reset}><X className="mr-1 h-4 w-4" /> Réinitialiser</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
