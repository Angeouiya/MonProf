"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, UserCheck, ClipboardCheck, Banknote, Ban, RefreshCw, ShieldAlert, Loader2, Bell, MessageSquare,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";

type Booking = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  commissionAmount: number;
  teacherNetAmount: number;
  teacher: { id: string; fullName: string; professionalName: string | null; phone: string };
  client: { name: string; phone: string | null };
  subjectName: string;
  levelName: string;
};

export function BookingActionsClient({ booking }: { booking: Booking }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [channel, setChannel] = useState("SMS");
  const [message, setMessage] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDesc, setDisputeDesc] = useState("");
  const didAutoPay = useRef(false);

  const doAction = async (action: string, extra?: Record<string, any>) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Action effectuée");
      setAssignOpen(false);
      setDisputeOpen(false);
      setNotifyOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  // Auto-trigger pay teacher if ?action=pay from URL (dashboard)
  useEffect(() => {
    if (didAutoPay.current) return;
    const action = sp.get("action");
    if (action === "pay" && booking.paymentStatus === "TO_PAY_TEACHER") {
      didAutoPay.current = true;
      doAction("pay_teacher");
    }
  }, [booking.paymentStatus, sp]);

  const sendAssign = () => {
    if (!message.trim()) { toast.error("Message requis"); return; }
    doAction("assign", { channel, message });
  };
  const sendNotify = () => {
    if (!message.trim()) { toast.error("Message requis"); return; }
    doAction("send_teacher_info", { channel, message });
  };
  const openDispute = () => {
    if (!disputeReason.trim()) { toast.error("Raison requise"); return; }
    doAction("dispute", { reason: disputeReason, description: disputeDesc });
  };

  const { status, paymentStatus } = booking;
  const actions: React.ReactNode[] = [];

  if (status === "PENDING_ADMIN_VALIDATION" || status === "PAID") {
    actions.push(
      <Button key="validate" onClick={() => doAction("validate")} disabled={!!loading}>
        {loading === "validate" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
        Valider la réservation
      </Button>
    );
  }
  if (status === "CONFIRMED" || status === "ASSIGNED") {
    actions.push(
      <Button key="assign" onClick={() => { setMessage(`Bonjour ${booking.teacher.professionalName || booking.teacher.fullName}, vous avez été affecté à la réservation ${booking.reference}. Matière: ${booking.subjectName}, niveau ${booking.levelName}. Contact client: ${booking.client.phone ?? "—"}.`); setAssignOpen(true); }}>
        <UserCheck className="mr-1.5 h-4 w-4" /> Affecter au professeur
      </Button>
    );
  }
  if (status === "ASSIGNED" || status === "IN_PROGRESS" || status === "CONFIRMED") {
    actions.push(
      <Button key="done" variant="outline" onClick={() => doAction("mark_done")} disabled={!!loading}>
        {loading === "mark_done" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-4 w-4" />}
        Marquer cours effectué
      </Button>
    );
  }
  if (paymentStatus === "TO_PAY_TEACHER") {
    actions.push(
      <AlertDialog key="pay">
        <AlertDialogTrigger asChild>
          <Button variant="default" disabled={!!loading}>
            {loading === "pay_teacher" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Banknote className="mr-1.5 h-4 w-4" />}
            Payer le professeur ({formatFCFA(booking.teacherNetAmount)} net)
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Payer le professeur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez libérer le paiement de <strong>{formatFCFA(booking.teacherNetAmount)}</strong> (net) à {booking.teacher.professionalName || booking.teacher.fullName}.
              La commission plateforme ({formatFCFA(booking.commissionAmount)}) reste acquise. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => doAction("pay_teacher")}>Confirmer le paiement</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Notifier le prof
  actions.push(
    <Button key="notify" variant="outline" onClick={() => { setMessage(""); setNotifyOpen(true); }}>
      <Bell className="mr-1.5 h-4 w-4" /> Notifier le prof
    </Button>
  );

  // Destructives
  const destructives: React.ReactNode[] = [];
  if (!["CANCELLED", "REFUNDED", "TEACHER_PAID"].includes(status)) {
    destructives.push(
      <AlertDialog key="cancel">
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={!!loading}>
            <Ban className="mr-1.5 h-4 w-4" /> Annuler
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la réservation ?</AlertDialogTitle>
            <AlertDialogDescription>La réservation sera marquée comme annulée.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={() => doAction("cancel")} className="bg-red-600 hover:bg-red-700">Annuler la réservation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  if (paymentStatus === "BLOCKED" || paymentStatus === "VALIDATED" || paymentStatus === "TO_PAY_TEACHER" || paymentStatus === "TEACHER_PAID") {
    destructives.push(
      <AlertDialog key="refund">
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={!!loading}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Rembourser
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rembourser le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le client sera remboursé de <strong>{formatFCFA(booking.totalPrice)}</strong>. Une transaction REFUND sera créée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={() => doAction("refund")} className="bg-red-600 hover:bg-red-700">Rembourser</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  if (!["DISPUTED", "REFUNDED", "CANCELLED"].includes(status)) {
    destructives.push(
      <Button key="dispute" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => { setDisputeReason(""); setDisputeDesc(""); setDisputeOpen(true); }}>
        <ShieldAlert className="mr-1.5 h-4 w-4" /> Ouvrir un litige
      </Button>
    );
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Actions administrateur</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {actions}
          {destructives.length > 0 && (
            <>
              <div className="hidden h-6 w-px bg-border sm:block" />
              {destructives}
            </>
          )}
        </CardContent>
      </Card>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Affecter au professeur</DialogTitle>
            <DialogDescription>Le message sera envoyé (simulé) au professeur via le canal choisi et enregistré dans son historique.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message au professeur</Label>
              <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Annuler</Button>
            <Button onClick={sendAssign} disabled={loading === "assign"}>
              {loading === "assign" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UserCheck className="mr-1.5 h-4 w-4" />}
              Affecter et notifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notifier le professeur</DialogTitle>
            <DialogDescription>Envoi d'un message ponctuel (simulé) au professeur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Bonjour..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotifyOpen(false)}>Annuler</Button>
            <Button onClick={sendNotify} disabled={loading === "send_teacher_info"}>
              {loading === "send_teacher_info" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ouvrir un litige</DialogTitle>
            <DialogDescription>La réservation passe en DISPUTED et les fonds sont gelés jusqu'à résolution.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Raison</Label>
              <Textarea rows={2} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Ex: Professeur absent, cours non conforme..." />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Textarea rows={4} value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisputeOpen(false)}>Annuler</Button>
            <Button onClick={openDispute} disabled={loading === "dispute"} className="bg-amber-600 hover:bg-amber-700">
              {loading === "dispute" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-1.5 h-4 w-4" />}
              Ouvrir le litige
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
