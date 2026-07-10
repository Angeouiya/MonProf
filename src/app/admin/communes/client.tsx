"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, MapPin, MoreHorizontal, Pencil, Plus, Save, Search, ToggleLeft, Trash2 } from "lucide-react";

type Quarter = { id: string; name: string; aliases: string | null; isActive: boolean };
type Commune = {
  id: string; name: string; slug: string | null; zone: string | null;
  transportClass: "GRAND_ABIDJAN" | "PERI_URBAN" | "INTERIOR";
  transportFeeOverride: number | null; isActive: boolean; quarters: Quarter[];
  _count: { teachers: number; quarters: number };
};

export function CommunesClient({ commune }: { commune?: Commune }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: commune?.name ?? "", zone: commune?.zone ?? "",
    transportClass: commune?.transportClass ?? "INTERIOR",
    transportFeeOverride: commune?.transportFeeOverride?.toString() ?? "",
    isActive: commune?.isActive ?? true,
  });

  const request = async (url: string, method: string, body?: unknown) => {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Action impossible.");
    return data;
  };

  const save = async () => {
    setSaving(true);
    try {
      await request(commune ? `/api/admin/communes/${commune.id}` : "/api/admin/communes", commune ? "PATCH" : "POST", {
        name: form.name, zone: form.zone || null, transportClass: form.transportClass,
        transportFeeOverride: form.transportFeeOverride === "" ? null : Number(form.transportFeeOverride),
        isActive: form.isActive,
      });
      toast.success(commune ? "Commune mise à jour" : "Commune créée");
      setOpen(false); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Action impossible."); }
    finally { setSaving(false); }
  };

  const toggle = async () => {
    if (!commune) return;
    try { await request(`/api/admin/communes/${commune.id}`, "PATCH", { isActive: !commune.isActive }); toast.success(commune.isActive ? "Commune désactivée" : "Commune activée"); router.refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Action impossible."); }
  };

  const remove = async () => {
    if (!commune) return;
    setSaving(true);
    try { await request(`/api/admin/communes/${commune.id}`, "DELETE"); toast.success("Commune supprimée"); setConfirmDelete(false); router.refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Action impossible."); }
    finally { setSaving(false); }
  };

  return <>
    {commune ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10" aria-label={`Actions pour ${commune.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setOpen(true)}><Pencil className="mr-2 h-4 w-4" />Modifier et gérer les quartiers</DropdownMenuItem><DropdownMenuItem onClick={toggle}><ToggleLeft className="mr-2 h-4 w-4" />{commune.isActive ? "Désactiver" : "Activer"}</DropdownMenuItem><DropdownMenuItem className="text-red-600" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <Button onClick={() => setOpen(true)} className="min-h-11 bg-[#111B4D] text-white hover:bg-[#0B143D]"><Plus className="mr-2 h-4 w-4" />Ajouter une commune</Button>}

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{commune ? `Gérer ${commune.name}` : "Nouvelle commune"}</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex. Cocody" /></Field>
        <Field label="Région ou district"><Input value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} placeholder="Ex. District d'Abidjan" /></Field>
        <Field label="Classe de déplacement"><select value={form.transportClass} onChange={(event) => setForm({ ...form, transportClass: event.target.value as Commune["transportClass"] })} className="h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold"><option value="GRAND_ABIDJAN">Grand Abidjan</option><option value="PERI_URBAN">Périurbain</option><option value="INTERIOR">Ville intérieure</option></select></Field>
        <Field label="Forfait particulier (FCFA)"><Input type="number" min={0} step={500} value={form.transportFeeOverride} onChange={(event) => setForm({ ...form, transportFeeOverride: event.target.value })} placeholder="Vide = matrice générale" /></Field>
        <Field label="Disponibilité publique"><select value={form.isActive ? "true" : "false"} onChange={(event) => setForm({ ...form, isActive: event.target.value === "true" })} className="h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold"><option value="true">Active</option><option value="false">Inactive</option></select></Field>
      </div>
      {commune && <QuarterManager commune={commune} request={request} onChanged={() => router.refresh()} />}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={save} disabled={saving || form.name.trim().length < 2} className="bg-[#111B4D] text-white hover:bg-[#0B143D]">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Enregistrer</Button></DialogFooter>
    </DialogContent></Dialog>

    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer {commune?.name} ?</AlertDialogTitle><AlertDialogDescription>La suppression est autorisée uniquement si aucun professeur et aucun quartier ne sont liés. Sinon, désactivez la commune pour conserver l'historique.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-red-600 text-white hover:bg-red-700">Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

function QuarterManager({ commune, request, onChanged }: { commune: Commune; request: (url: string, method: string, body?: unknown) => Promise<any>; onChanged: () => void }) {
  const [query, setQuery] = useState(""); const [name, setName] = useState(""); const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => commune.quarters.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [commune.quarters, query]);
  const create = async () => { setBusy(true); try { await request(`/api/admin/communes/${commune.id}/quarters`, "POST", { name, isActive: true }); setName(""); toast.success("Quartier ajouté"); onChanged(); } catch (error) { toast.error(error instanceof Error ? error.message : "Action impossible."); } finally { setBusy(false); } };
  return <section className="mt-2 border-t border-[#E7ECF5] pt-5"><div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111B4D] text-white"><MapPin className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-[#111827]">Quartiers ({commune.quarters.length})</h3><p className="mt-1 text-xs text-[#64748B]">Ces valeurs alimentent les recherches client et le calcul du même quartier.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ajouter un quartier" /><Button onClick={create} disabled={busy || name.trim().length < 2} className="bg-[#111B4D] text-white hover:bg-[#0B143D]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Ajouter</Button></div><div className="relative mt-3"><Search className="absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans les quartiers" className="pl-9" /></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{filtered.length ? filtered.map((quarter) => <QuarterRow key={quarter.id} communeId={commune.id} quarter={quarter} request={request} onChanged={onChanged} />) : <p className="rounded-lg border border-dashed border-[#DDE6F7] p-4 text-center text-xs text-[#64748B]">Aucun quartier trouvé.</p>}</div></section>;
}

function QuarterRow({ communeId, quarter, request, onChanged }: { communeId: string; quarter: Quarter; request: (url: string, method: string, body?: unknown) => Promise<any>; onChanged: () => void }) {
  const [name, setName] = useState(quarter.name); const [busy, setBusy] = useState(false); const base = `/api/admin/communes/${communeId}/quarters/${quarter.id}`;
  const act = async (method: string, body?: unknown) => { setBusy(true); try { await request(base, method, body); toast.success(method === "DELETE" ? "Quartier supprimé" : "Quartier mis à jour"); onChanged(); } catch (error) { toast.error(error instanceof Error ? error.message : "Action impossible."); } finally { setBusy(false); } };
  return <div className="grid gap-2 rounded-lg border border-[#DDE6F7] p-2 sm:grid-cols-[minmax(0,1fr)_auto]"><Input value={name} onChange={(event) => setName(event.target.value)} className={quarter.isActive ? "" : "text-[#94A3B8] line-through"} /><div className="flex gap-1"><Button variant="outline" size="icon" disabled={busy || name.trim().length < 2 || name === quarter.name} onClick={() => act("PATCH", { name })} aria-label="Enregistrer le quartier"><Save className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={busy} onClick={() => act("PATCH", { isActive: !quarter.isActive })} aria-label={quarter.isActive ? "Désactiver" : "Activer"}><ToggleLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={busy} onClick={() => act("DELETE")} className="text-red-600" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-2 block text-xs font-semibold uppercase text-[#475569]">{label}</Label>{children}</div>; }
