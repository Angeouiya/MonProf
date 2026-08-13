"use client";

import { Banknote, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";

export function PayAllTeacherButton({
  total,
  count,
  teacherName,
  payoutPending = false,
}: {
  teacherId: string;
  total: number;
  count: number;
  teacherName: string;
  teacherPhone?: string | null;
  pendingRetentions?: number;
  retainedTotal?: number;
  payoutPending?: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-[#DDE6F7] bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" aria-hidden />
        <div>
          <p className="font-black text-[#111827]">Suivi comptable uniquement</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
            {teacherName} retire désormais directement via Jèko. L'administration ne valide plus le dépôt.
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" disabled className="justify-start">
        <Banknote className="mr-1.5 h-4 w-4" aria-hidden />
        {payoutPending
          ? "Confirmation Jèko en cours"
          : `${formatFCFA(total)} visible · ${count} ligne(s)`}
      </Button>
    </div>
  );
}
