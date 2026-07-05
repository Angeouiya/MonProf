"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ImportantActionConfirmProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  badge?: string;
  notices?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
};

export function ImportantActionConfirm({
  trigger,
  title,
  description,
  badge = "Action importante",
  notices = [],
  confirmLabel = "Confirmer",
  cancelLabel = "Continuer ici",
  onConfirm,
  danger = false,
}: ImportantActionConfirmProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="bg-white sm:max-w-xl">
        <AlertDialogHeader>
          <div className="mb-1 flex justify-center sm:justify-start">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                danger
                  ? "border-[#F3B8B3] bg-white text-[#B42318]"
                  : "border-[#DDE6F7] bg-white text-[#111B4D]",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {badge}
            </span>
          </div>
          <AlertDialogTitle className="text-[#111827]">{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-[#64748B]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {notices.length > 0 && (
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-sm text-[#111827]">
            <div className="flex items-center gap-2 font-semibold text-[#111B4D]">
              <ShieldCheck className="h-4 w-4" />
              À vérifier avant de continuer
            </div>
            <ul className="mt-2 space-y-2 text-xs font-medium leading-5 text-[#475569]">
              {notices.map((notice) => (
                <li key={notice} className="flex gap-2">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
                  <span>{notice}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11 rounded-lg" disabled={submitting}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            className={cn(
              "min-h-11 rounded-lg",
              danger ? "bg-[#B42318] text-white hover:bg-[#971B12]" : "bg-[#111B4D] text-white hover:bg-[#1E2A78]",
            )}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {submitting ? "Traitement..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ImportantActionNotice({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-[#DDE6F7] bg-white px-3 py-2.5 text-sm", className)}>
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#111B4D] text-white">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-[#111827]">{title}</p>
          <p className="mt-0.5 line-clamp-3 text-xs font-medium leading-5 text-[#64748B] sm:line-clamp-none">{description}</p>
        </div>
      </div>
    </div>
  );
}
