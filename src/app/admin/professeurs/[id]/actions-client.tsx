"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bell, Ban, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export function TeacherActionsClient({ teacherId, teacherName }: { teacherId: string; teacherName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("SMS");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [suspending, setSuspending] = useState(false);

  const sendNotif = async () => {
    if (!message.trim()) {
      toast.error("Message requis");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/teacher-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, channel, message, title: `Notification ${channel}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Notification envoyée (simulée)");
      setOpen(false);
      setMessage("");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const suspend = async () => {
    setSuspending(true);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Professeur suspendu");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSuspending(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Bell className="mr-1.5 h-4 w-4" /> Notifier
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notifier {teacherName}</DialogTitle>
            <DialogDescription>Envoi simulé (SMS, WhatsApp ou Email). Le message est enregistré dans l'historique.</DialogDescription>
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
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Bonjour, vous avez un cours..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={sendNotif} disabled={sending}>
              {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700">
            <Ban className="mr-1.5 h-4 w-4" /> Suspendre
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspendre {teacherName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le professeur ne sera plus visible publiquement et ne pourra plus recevoir de réservations. Cette action est réversible (modifier le statut en Actif).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={suspend}
              disabled={suspending}
              className="bg-red-600 hover:bg-red-700"
            >
              {suspending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Suspendre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
