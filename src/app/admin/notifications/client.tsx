"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Check, CheckCheck, ExternalLink, Loader2, MoreHorizontal, RefreshCw, ShieldCheck, Trash2, XCircle } from "lucide-react";

export function NotificationsClient({
  mode,
  filter,
  notification,
}: {
  mode: "markAll" | "filter" | "row";
  filter?: string;
  notification?: {
    id: string;
    read: boolean;
    status?: string;
    recipientType?: string;
    bookingId?: string | null;
    teacherId?: string | null;
    clientId?: string | null;
  };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);

  if (mode === "markAll") {
    const markAll = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAllRead: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("Toutes les notifications marquées comme lues");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    return (
      <Button variant="outline" onClick={markAll} disabled={loading}>
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />}
        Tout marquer lu
      </Button>
    );
  }

  if (mode === "filter" && filter !== undefined) {
    const apply = (next: string) => {
      const params = new URLSearchParams(sp.toString());
      if (!next) params.delete("filter");
      else params.set("filter", next);
      router.push(`/admin/notifications?${params.toString()}`);
    };
    return (
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Filtre</Label>
              <Select value={filter || "all"} onValueChange={(v) => apply(v === "all" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="unread">Non lues</SelectItem>
                  <SelectItem value="urgent">Urgentes</SelectItem>
                  <SelectItem value="teacher">Professeurs</SelectItem>
                  <SelectItem value="client">Clients</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="failed">Échecs</SelectItem>
                  <SelectItem value="replacement">Remplacements</SelectItem>
                  <SelectItem value="litige">Litiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "row" && notification) {
    const markRead = async (read: boolean) => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notification.id, read }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
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
        const res = await fetch(`/api/admin/notifications/${notification.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("Notification supprimée");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    const runAction = async (action: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notification.id, action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success(action === "relaunch_teacher" ? "Relance envoyée" : "Notification mise à jour");
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
          {notification.bookingId && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/reservations/${notification.bookingId}`}><ExternalLink className="mr-2 h-4 w-4" /> Voir réservation</Link>
            </DropdownMenuItem>
          )}
          {notification.teacherId && (
            <DropdownMenuItem asChild>
              <Link href={notification.bookingId ? `/admin/professeurs/${notification.teacherId}?tab=cours&bookingId=${notification.bookingId}` : `/admin/professeurs/${notification.teacherId}?tab=historique`}>
                <ExternalLink className="mr-2 h-4 w-4" /> Voir espace professeur
              </Link>
            </DropdownMenuItem>
          )}
          {notification.clientId && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/clients/${notification.clientId}`}><ExternalLink className="mr-2 h-4 w-4" /> Voir client</Link>
            </DropdownMenuItem>
          )}
          {!notification.read && (
            <DropdownMenuItem onClick={() => markRead(true)}><Check className="mr-2 h-4 w-4" /> Marquer comme lue</DropdownMenuItem>
          )}
          {notification.status !== "CONFIRMED" && (
            <DropdownMenuItem onClick={() => runAction("mark_treated")}><ShieldCheck className="mr-2 h-4 w-4" /> Marquer traité</DropdownMenuItem>
          )}
          {notification.recipientType === "TEACHER" && notification.teacherId && (
            <DropdownMenuItem onClick={() => runAction("relaunch_teacher")}><RefreshCw className="mr-2 h-4 w-4" /> Relancer prof</DropdownMenuItem>
          )}
          {notification.status !== "FAILED" && (
            <DropdownMenuItem onClick={() => runAction("mark_failed")}><XCircle className="mr-2 h-4 w-4" /> Marquer échec</DropdownMenuItem>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette notification ?</AlertDialogTitle>
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

  return null;
}
