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
    if (typeof window !== "undefined" && window.history.length > 1 && canSafelyGoBack(pathname)) {
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
        "w-fit rounded-lg border-[#CAD7F2] bg-white px-3 text-[#111B4D] hover:border-[#111B4D] hover:bg-white",
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

function canSafelyGoBack(pathname: string | null) {
  if (typeof window === "undefined") return false;
  if (!document.referrer) return false;

  try {
    const referrerUrl = new URL(document.referrer);
    if (referrerUrl.origin !== window.location.origin) return false;

    const currentSpace = getNavigationSpace(pathname);
    const referrerSpace = getNavigationSpace(referrerUrl.pathname);
    if (!currentSpace) return true;

    return currentSpace === referrerSpace;
  } catch {
    return false;
  }
}

function getNavigationSpace(pathname: string | null) {
  if (!pathname) return null;
  if (pathname === "/client" || pathname.startsWith("/client/")) return "client";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/professeur" || pathname.startsWith("/professeur/")) return "professeur";
  if (pathname === "/professeurs" || pathname.startsWith("/professeurs/")) return "public-professeurs";
  return null;
}
