"use client";

import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  wrapperClassName?: string;
  defaultVisible?: boolean;
};

export function PasswordInput({ className, wrapperClassName, defaultVisible = false, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(defaultVisible);
  const generatedId = useId();
  const inputId = typeof props.id === "string" && props.id.trim() ? props.id : `password-${generatedId}`;
  const controlLabel = visible ? "Masquer le mot de passe" : "Afficher le mot de passe";
  const controlText = visible ? "Masquer" : "Voir";

  return (
    <div
      className={cn("relative", wrapperClassName)}
      data-password-field
      data-password-can-verify="true"
      data-password-visible={visible ? "true" : "false"}
    >
      <Input
        {...props}
        id={inputId}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        className={cn(className, "pr-24")}
        data-password-input
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1.5 top-1/2 inline-flex h-8 min-w-[4.6rem] -translate-y-1/2 items-center justify-center gap-1 rounded-md border border-[#DDE6F7] bg-white px-2 text-xs font-black text-[#111B4D] shadow-sm transition hover:border-[#9AAAD0] hover:bg-[#F8FAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9AAAD0]"
        aria-controls={inputId}
        aria-label={controlLabel}
        aria-pressed={visible}
        data-password-visibility-toggle
        data-password-visibility-label={controlText.toLowerCase()}
        title={controlLabel}
      >
        {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
        <span>{controlText}</span>
      </button>
    </div>
  );
}
