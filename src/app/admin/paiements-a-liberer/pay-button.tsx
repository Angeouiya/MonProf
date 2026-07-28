"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Banknote } from "lucide-react";
import { formatFCFA } from "@/lib/format";

export function PayTeacherButton({
  bookingId,
  teacherId,
  amount,
  teacherName,
}: {
  bookingId: string;
  teacherId: string;
  amount: number;
  teacherName: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm">
          <Banknote className="mr-1.5 h-4 w-4" />
          Verser via Jèko
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Payer {teacherName} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le formulaire sécurisé va cibler <strong>{formatFCFA(amount)}</strong> pour {teacherName}. Le solde ne sera débité qu'après confirmation finale de Jèko.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link href={`/admin/professeurs/${teacherId}?tab=paiements&bookingId=${bookingId}`}>
              Ouvrir le versement Jèko
            </Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
