"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";

export function ClientsListClient({ q }: { q: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(q);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (value) params.set("q", value); else params.delete("q");
    router.push(`/admin/clients?${params.toString()}`);
  };

  const reset = () => {
    setValue("");
    router.push("/admin/clients");
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={apply} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Rechercher par nom, email ou téléphone..."
              className="pl-9"
            />
          </div>
          <Button type="submit">Rechercher</Button>
          {q && <Button type="button" variant="ghost" onClick={reset}><X className="mr-1 h-4 w-4" /></Button>}
        </form>
      </CardContent>
    </Card>
  );
}
