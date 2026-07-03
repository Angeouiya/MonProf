"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { MoreHorizontal, Check, RotateCcw, Trash2, Loader2 } from "lucide-react";

export function MessagesClient({ filter, message }: { filter?: string; message?: { id: string; handled: boolean } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);

  if (filter !== undefined) {
    const apply = (next: string) => {
      const params = new URLSearchParams(sp.toString());
      if (!next) params.delete("filter");
      else params.set("filter", next);
      router.push(`/admin/messages?${params.toString()}`);
    };
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Filtre</Label>
              <Select value={filter || "all"} onValueChange={(v) => apply(v === "all" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous messages</SelectItem>
                  <SelectItem value="unhandled">Non traités</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!message) return null;

  const markHandled = async (handled: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contact-messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(handled ? "Marqué comme traité" : "Marqué comme non traité");
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
      const res = await fetch(`/api/admin/contact-messages/${message.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Message supprimé");
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
        {!message.handled && (
          <DropdownMenuItem onClick={() => markHandled(true)}><Check className="mr-2 h-4 w-4" /> Marquer traité</DropdownMenuItem>
        )}
        {message.handled && (
          <DropdownMenuItem onClick={() => markHandled(false)}><RotateCcw className="mr-2 h-4 w-4" /> Marquer non traité</DropdownMenuItem>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
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
