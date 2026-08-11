"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  wrapperClassName?: string;
  defaultVisible?: boolean;
};

export function PasswordInput({ className, wrapperClassName, defaultVisible = false, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(defaultVisible);
  const controlLabel = visible ? "Masquer le mot de passe" : "Afficher le mot de passe";

  return (
    <div
      className={cn("relative", wrapperClassName)}
      data-password-field
      data-password-visible={visible ? "true" : "false"}
    >
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        className={cn("pr-12", className)}
        data-password-input
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 inline-flex min-w-11 items-center justify-center rounded-r-lg text-[#64748B] transition hover:text-[#111B4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9AAAD0]"
        aria-controls={typeof props.id === "string" ? props.id : undefined}
        aria-label={controlLabel}
        aria-pressed={visible}
        data-password-visibility-toggle
        title={controlLabel}
      >
        {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
      </button>
    </div>
  );
}
