"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, X, MoreHorizontal, Eye, EyeOff, Trash2, Loader2 } from "lucide-react";

export function AvisClient({
  filters,
  review,
}: {
  filters?: { rating: number; q: string };
  review?: { id: string; published: boolean };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(filters?.q ?? "");
  const [loading, setLoading] = useState(false);

  // Filter mode
  if (filters) {
    const apply = (next: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (!v) params.delete(k);
        else params.set(k, v);
      }
      router.push(`/admin/avis?${params.toString()}`);
    };
    return (
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label className="sr-only" htmlFor="q">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher commentaire, client, prof..." className="pl-9" onKeyDown={(e) => { if (e.key === "Enter") apply({ q }); }} />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={String(filters.rating || "all")} onValueChange={(v) => apply({ rating: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Note" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes notes</SelectItem>
                  <SelectItem value="5">5 étoiles</SelectItem>
                  <SelectItem value="4">4 étoiles</SelectItem>
                  <SelectItem value="3">3 étoiles</SelectItem>
                  <SelectItem value="2">2 étoiles</SelectItem>
                  <SelectItem value="1">1 étoile</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" onClick={() => router.push("/admin/avis")}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Row actions mode
  if (!review) return null;
  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !review.published }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(review.published ? "Avis masqué" : "Avis publié");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  const del = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Avis supprimé");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={toggle}>
          {review.published ? <><EyeOff className="mr-2 h-4 w-4" /> Masquer</> : <><Eye className="mr-2 h-4 w-4" /> Publier</>}
        </DropdownMenuItem>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cet avis ?</AlertDialogTitle>
              <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={del} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
