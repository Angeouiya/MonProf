"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Search, X, MoreHorizontal, Eye, EyeOff, Trash2, Loader2, ClipboardCheck } from "lucide-react";

const reviewStatusOptions = [
  { value: "NEW", label: "Nouveau" },
  { value: "TO_REVIEW", label: "À traiter" },
  { value: "CONTACT_CLIENT", label: "Contacter client" },
  { value: "CONTACT_TEACHER", label: "Contacter professeur" },
  { value: "WARNING_SENT", label: "Avertissement envoyé" },
  { value: "RESOLVED", label: "Résolu" },
  { value: "ESCALATED", label: "Escaladé" },
  { value: "DISMISSED", label: "Écarté" },
] as const;

export function AvisClient({
  filters,
  review,
}: {
  filters?: { rating: number; q: string; status: string };
  review?: { id: string; published: boolean; adminStatus?: string | null; adminNote?: string | null };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(filters?.q ?? "");
  const [loading, setLoading] = useState(false);
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [adminStatus, setAdminStatus] = useState(review?.adminStatus ?? "NEW");
  const [adminNote, setAdminNote] = useState(review?.adminNote ?? "");
  const adminNoteTooLong = adminNote.trim().length > 1200;

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
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <div>
              <Label className="sr-only" htmlFor="q">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher commentaire, client, prof..." className="pl-9" onKeyDown={(e) => { if (e.key === "Enter") apply({ q }); }} />
              </div>
            </div>
            <div>
              <Label className="sr-only">Note</Label>
              <Select value={String(filters.rating || "all")} onValueChange={(v) => apply({ rating: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Note" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes notes</SelectItem>
                  <SelectItem value="5">Note 5/5</SelectItem>
                  <SelectItem value="4">Note 4/5</SelectItem>
                  <SelectItem value="3">Note 3/5</SelectItem>
                  <SelectItem value="2">Note 2/5</SelectItem>
                  <SelectItem value="1">Note 1/5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="sr-only">Statut</Label>
              <Select value={filters.status || "all"} onValueChange={(v) => apply({ status: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="published">Publiés</SelectItem>
                  <SelectItem value="hidden">Masqués</SelectItem>
                  <SelectItem value="low">Faibles notes</SelectItem>
                  <SelectItem value="TO_REVIEW">À traiter</SelectItem>
                  <SelectItem value="CONTACT_CLIENT">Client à contacter</SelectItem>
                  <SelectItem value="CONTACT_TEACHER">Professeur à contacter</SelectItem>
                  <SelectItem value="WARNING_SENT">Avertissement envoyé</SelectItem>
                  <SelectItem value="RESOLVED">Résolus</SelectItem>
                  <SelectItem value="ESCALATED">Escaladés</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => apply({ q })}>
                <Search className="mr-1.5 h-4 w-4" />
                Rechercher
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => router.push("/admin/avis")}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Row actions mode
  if (!review) return null;
  const saveTreatment = async () => {
    if (adminNoteTooLong) {
      toast.error("La note admin ne doit pas dépasser 1200 caractères.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminStatus, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Traitement de l'avis enregistré");
      setTreatmentOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="flex items-center justify-end gap-1.5">
      <Dialog open={treatmentOpen} onOpenChange={setTreatmentOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading} className="h-8 gap-1.5 rounded-xl px-2.5">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden lg:inline">Traiter</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Traitement interne de l'avis</DialogTitle>
            <DialogDescription>
              Cette note reste visible uniquement dans l'administration et dans la fiche du professeur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Statut qualité</Label>
              <Select value={adminStatus} onValueChange={setAdminStatus}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  {reviewStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`adminNote-${review.id}`}>Note admin</Label>
              <Textarea
                id={`adminNote-${review.id}`}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                rows={5}
                placeholder="Décision, appel effectué, explication du professeur, suite à donner..."
              />
              <p className={adminNoteTooLong ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
                {adminNote.trim().length}/1200 caractères
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTreatmentOpen(false)}>Annuler</Button>
            <Button type="button" onClick={saveTreatment} disabled={loading || adminNoteTooLong}>
              {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10" disabled={loading}>
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
    </div>
  );
}
