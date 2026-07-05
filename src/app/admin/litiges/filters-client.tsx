"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function LitigesFiltersClient({ status }: { status: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const apply = (next: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.push(`/admin/litiges?${params.toString()}`);
  };

  return (
    <Card className="overflow-hidden border-violet-100 bg-white">
      <CardContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={status || "all"} onValueChange={(v) => apply({ status: v === "all" ? "" : v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="OPEN">Ouvert</SelectItem>
                <SelectItem value="INVESTIGATING">Investigation</SelectItem>
                <SelectItem value="RESOLVED">Résolu</SelectItem>
                <SelectItem value="REFUNDED">Remboursé</SelectItem>
                <SelectItem value="REJECTED">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
