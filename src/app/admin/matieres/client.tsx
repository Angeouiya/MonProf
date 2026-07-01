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

type Subject = { id: string; name: string; slug: string; icon: string | null };

export function MatieresClient({ subject }: { subject?: Subject }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subject?.name ?? "");
  const [slug, setSlug] = useState(subject?.slug ?? "");
  const [icon, setIcon] = useState(subject?.icon ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    try {
      const url = subject ? `/api/admin/subjects/${subject.id}` : "/api/admin/subjects";
      const method = subject ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, icon: icon || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(subject ? "Matière modifiée" : "Matière créée");
      setOpen(false);
      if (!subject) { setName(""); setSlug(""); setIcon(""); }
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!subject) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/subjects/${subject.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Matière supprimée");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!subject) {
    // Create button
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button><Plus className="mr-2 h-4 w-4" /> Ajouter une matière</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle matière</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sciences" />
            </div>
            <div>
              <Label>Slug (optionnel)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-généré" />
            </div>
            <div>
              <Label>Icône (Lucide, optionnel)</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Ex: Atom" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Annuler</Button></DialogClose>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Créer
            </Button>
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
          <DialogHeader><DialogTitle>Modifier la matière</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Slug (optionnel)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <div>
              <Label>Icône</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="mr-auto text-red-600" disabled={deleting}>
                  {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette matière ?</AlertDialogTitle>
                  <AlertDialogDescription>Action irréversible. Impossible si des professeurs y sont liés.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={del} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DialogClose asChild><Button variant="ghost">Annuler</Button></DialogClose>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
