"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";

type Commune = { id: string; name: string; zone: string | null };

export function CommunesClient({ commune }: { commune?: Commune }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(commune?.name ?? "");
  const [zone, setZone] = useState(commune?.zone ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    try {
      const url = commune ? `/api/admin/communes/${commune.id}` : "/api/admin/communes";
      const method = commune ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, zone: zone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(commune ? "Commune modifiée" : "Commune créée");
      setOpen(false);
      if (!commune) { setName(""); setZone(""); }
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!commune) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/communes/${commune.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Commune supprimée");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!commune) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button><Plus className="mr-2 h-4 w-4" /> Ajouter une commune</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle commune</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cocody" /></div>
            <div><Label>Zone (optionnel)</Label><Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex: Abidjan" /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Annuler</Button></DialogClose>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}><Pencil className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={() => setOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la commune</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Zone</Label><Input value={zone} onChange={(e) => setZone(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="mr-auto text-red-600" disabled={deleting}>
                  {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />} Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette commune ?</AlertDialogTitle>
                  <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={del} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DialogClose asChild><Button variant="ghost">Annuler</Button></DialogClose>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
