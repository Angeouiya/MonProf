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
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, PackagePlus } from "lucide-react";

type Subject = { id: string; name: string; slug: string; icon: string | null };

export function MatieresClient({ subject }: { subject?: Subject }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subject?.name ?? "");
  const [slug, setSlug] = useState(subject?.slug ?? "");
  const [icon, setIcon] = useState(subject?.icon ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    setNotice("");
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
      setNotice(subject ? "Matière modifiée." : "Matière créée.");
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
      setConfirmDeleteOpen(false);
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!subject) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            setNotice("");
            setImporting(true);
            try {
              const res = await fetch("/api/admin/subjects/presets", { method: "POST" });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Import impossible");
              setNotice(`${data.imported} matière(s) importée(s), ${data.skipped} déjà présente(s).`);
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Import impossible");
            } finally {
              setImporting(false);
            }
          }}
          disabled={importing}
        >
          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}
          Importer catalogue ouvert
        </Button>
        <InlineCatalogNotice message={notice} />
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
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}><Pencil className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <InlineCatalogNotice message={notice} compact />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette matière ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible. Impossible si des professeurs y sont liés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-red-600 hover:bg-red-700" disabled={deleting}>
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <Button type="button" variant="outline" className="mr-auto text-red-600" disabled={deleting} onClick={() => setConfirmDeleteOpen(true)}>
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Supprimer
            </Button>
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

function InlineCatalogNotice({ message, compact = false }: { message: string; compact?: boolean }) {
  if (!message) return null;

  return (
    <p
      className={compact
        ? "mt-1 max-w-40 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800"
        : "inline-flex min-h-10 items-center rounded-lg border border-emerald-100 bg-emerald-50 px-3 text-xs font-bold text-emerald-800"}
      data-admin-catalog-inline-status
    >
      {message}
    </p>
  );
}
