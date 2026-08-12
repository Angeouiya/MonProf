import { CheckCircle2 } from "lucide-react";
import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type PasswordRule = {
  label: string;
  ok: boolean;
};

type PasswordRuleListProps = HTMLAttributes<HTMLDivElement> & {
  rules: readonly PasswordRule[];
  columnsClassName?: string;
};

export function PasswordRuleList({
  rules,
  className,
  columnsClassName,
  ...props
}: PasswordRuleListProps) {
  const ready = rules.length > 0 && rules.every((rule) => rule.ok);

  return (
    <div
      {...props}
      role="list"
      aria-label="Vérification du mot de passe"
      data-password-rule-list
      data-password-rule-list-ready={ready ? "true" : "false"}
      className={cn(
        "grid gap-2 rounded-lg border border-[#E3E8F2] bg-white p-2.5 text-xs font-semibold leading-5 text-[#64748B]",
        columnsClassName,
        className,
      )}
    >
      {rules.map((rule) => (
        <p
          key={rule.label}
          role="listitem"
          className={cn(
            "flex min-w-0 items-start gap-2",
            rule.ok ? "text-[#111B4D]" : "text-[#64748B]",
          )}
          data-password-rule={rule.ok ? "ok" : "pending"}
        >
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
              rule.ok ? "bg-[#EEF2FF] text-[#111B4D]" : "bg-[#EEF2F7] text-[#94A3B8]",
            )}
            aria-hidden="true"
          >
            {rule.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          <span className="min-w-0">{rule.label}</span>
        </p>
      ))}
    </div>
  );
}
