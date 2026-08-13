"use client";

import Link from "next/link";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <Button asChild size="sm" variant="outline">
      <Link href={`/admin/professeurs/${teacherId}?tab=paiements&bookingId=${bookingId}`} title={`Suivre ${formatFCFA(amount)} pour ${teacherName}`}>
        <Banknote className="mr-1.5 h-4 w-4" />
        Suivre retrait Jèko
      </Link>
    </Button>
  );
}
