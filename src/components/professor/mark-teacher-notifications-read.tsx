"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MarkTeacherNotificationsReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markRead() {
    setLoading(true);
    try {
      const res = await fetch("/api/professor/notifications/read", { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible");
      toast.success("Notifications marquées comme lues.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={markRead}
      disabled={disabled || loading}
      className="rounded-lg bg-white"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
      Marquer comme lues
    </Button>
  );
}
