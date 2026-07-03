"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, CheckCircle2, RefreshCw, XCircle, Loader2 } from "lucide-react";

export function DisputeActionsClient({ disputeId, status }: { disputeId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [openAction, setOpenAction] = useState<string | null>(null);

  const doAction = async (action: string) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resolution }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Action effectuée");
      setOpenAction(null);
      setResolution("");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  const actions = [
    { key: "investigate", label: "Investiguer", icon: Search, tone: "amber", needResolution: false, show: ["OPEN"].includes(status) },
    { key: "resolve", label: "Résoudre (libérer)", icon: CheckCircle2, tone: "primary", needResolution: true, show: ["OPEN","INVESTIGATING"].includes(status) },
    { key: "refund", label: "Rembourser client", icon: RefreshCw, tone: "red", needResolution: true, show: ["OPEN","INVESTIGATING"].includes(status) },
    { key: "reject", label: "Rejeter le litige", icon: XCircle, tone: "gray", needResolution: true, show: ["OPEN","INVESTIGATING"].includes(status) },
  ].filter((a) => a.show);

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Ce litige est déjà traité. Aucune action supplémentaire n'est disponible.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Actions sur le litige</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Commentaire de résolution (optionnel pour Investiguer, requis pour Résoudre/Rembourser/Rejeter)</Label>
          <Textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Expliquez la décision..." className="mt-1.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => {
            const toneCls = {
              amber: "border-amber-200 text-amber-700 hover:bg-amber-50",
              primary: "border-violet-200 text-violet-700 hover:bg-violet-50",
              red: "border-red-200 text-red-700 hover:bg-red-50",
              gray: "border-slate-200 text-slate-700 hover:bg-slate-50",
            }[a.tone];
            const needRes = a.needResolution && !resolution.trim();
            return (
              <AlertDialog key={a.key} open={openAction === a.key} onOpenChange={(o) => setOpenAction(o ? a.key : null)}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className={toneCls} disabled={!!loading || needRes}>
                    {loading === a.key ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <a.icon className="mr-1.5 h-4 w-4" />}
                    {a.label}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{a.label} ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {a.key === "resolve" && "Le litige sera résolu, le paiement sera libéré au professeur."}
                      {a.key === "refund" && "Le client sera remboursé. La réservation passera au statut Remboursée."}
                      {a.key === "reject" && "Le litige sera rejeté. Le paiement retourne en attente de libération au professeur."}
                      {a.key === "investigate" && "Le litige passe en cours d'investigation."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => doAction(a.key)}>Confirmer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
