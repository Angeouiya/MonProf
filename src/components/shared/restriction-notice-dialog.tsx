"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type RestrictionNoticeVariant = "restriction" | "warning" | "info" | "critical";

type RestrictionNoticeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  variant?: RestrictionNoticeVariant;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

const VARIANTS: Record<RestrictionNoticeVariant, {
  icon: typeof AlertTriangle;
  shell: string;
  header: string;
  iconClass: string;
  title: string;
  description: string;
  action: string;
}> = {
  restriction: {
    icon: ShieldAlert,
    shell: "border-[#F3B4B4]",
    header: "border-b border-[#F5C6C6] bg-[#FFF5F5]",
    iconClass: "bg-[#B42318] text-white",
    title: "text-[#7A1B12]",
    description: "text-[#7A1B12]",
    action: "bg-[#111B4D] text-white hover:bg-[#1E2A78]",
  },
  warning: {
    icon: AlertTriangle,
    shell: "border-[#F5C451]",
    header: "border-b border-[#F3E3B1] bg-[#FFF9E8]",
    iconClass: "bg-[#F5C451] text-[#4A3300]",
    title: "text-[#2F2300]",
    description: "text-[#6C550D]",
    action: "bg-[#111B4D] text-white hover:bg-[#1E2A78]",
  },
  info: {
    icon: Info,
    shell: "border-[#CAD7F2]",
    header: "border-b border-[#DDE6F7] bg-[#F8FAFC]",
    iconClass: "bg-[#111B4D] text-white",
    title: "text-[#111B4D]",
    description: "text-[#475569]",
    action: "bg-[#111B4D] text-white hover:bg-[#1E2A78]",
  },
  critical: {
    icon: AlertTriangle,
    shell: "border-[#991B1B]",
    header: "border-b border-[#FCA5A5] bg-[#FEF2F2]",
    iconClass: "bg-[#991B1B] text-white",
    title: "text-[#7F1D1D]",
    description: "text-[#7F1D1D]",
    action: "bg-[#991B1B] text-white hover:bg-[#7F1D1D]",
  },
};

export function RestrictionNoticeDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "restriction",
  primaryLabel = "OK",
  onPrimary,
  secondaryLabel,
  onSecondary,
}: RestrictionNoticeDialogProps) {
  const style = VARIANTS[variant];
  const Icon = style.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={`max-w-xl p-0 ${style.shell}`} data-restriction-notice-card>
        <AlertDialogHeader className={`p-5 text-left ${style.header}`}>
          <div className="flex items-start gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconClass}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <AlertDialogTitle className={style.title}>{title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className={`mt-2 text-sm font-semibold leading-6 ${style.description}`}>
                  {description}
                </div>
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t border-[#E6EAF3] p-5">
          {secondaryLabel && (
            <AlertDialogCancel
              onClick={onSecondary}
              className="min-h-11"
            >
              {secondaryLabel}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={onPrimary}
            className={`min-h-11 ${style.action}`}
          >
            {primaryLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { RestrictionNoticeVariant };
