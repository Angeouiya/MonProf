"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Banknote, Loader2 } from "lucide-react";
import { formatFCFA } from "@/lib/format";

export function PayAllTeacherButton({
  bookings,
  teacherName,
}: {
  bookings: { id: string; net: number; ref: string }[];
  teacherName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const total = bookings.reduce((s, b) => s + b.net, 0);

  const payAll = async () => {
    setLoading(true);
    let ok = 0;
    let fail = 0;
    for (const b of bookings) {
      try {
        const res = await fetch(`/api/admin/bookings/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pay_teacher" }),
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    if (fail === 0) toast.success(`${ok} paiement(s) libéré(s) pour ${teacherName}`);
    else toast.error(`${ok} réussi(s), ${fail} échec(s)`);
    setLoading(false);
    router.refresh();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Banknote className="mr-1.5 h-4 w-4" />}
          Tout payer ({formatFCFA(total)})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Payer {teacherName} pour {bookings.length} cours ?</AlertDialogTitle>
          <AlertDialogDescription>
            Vous allez libérer <strong>{formatFCFA(total)}</strong> (net) sur {bookings.length} cours. Cette action traite chaque réservation individuellement et est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={payAll}>Tout payer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
