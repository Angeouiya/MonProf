"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export function BackButton({ fallbackHref, label = "Retour", className }: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const fallback = fallbackHref ?? getDefaultFallback(pathname);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallback);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={goBack}
      className={cn(
        "w-fit rounded-2xl border-[#CAD7F2] bg-white px-3 text-[#111B4D] shadow-sm hover:border-[#111B4D] hover:bg-white",
        className,
      )}
      aria-label="Retour à la page précédente"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}

function getDefaultFallback(pathname: string | null) {
  if (!pathname || pathname === "/") return "/";
  if (pathname === "/admin") return "/";
  if (pathname.startsWith("/admin/")) return "/admin";
  if (pathname === "/client") return "/";
  if (pathname.startsWith("/client/")) return "/client";
  if (pathname === "/professeur") return "/";
  if (pathname.startsWith("/professeur/")) return "/professeur";
  if (pathname.startsWith("/professeurs/")) return "/professeurs";
  return "/";
}
