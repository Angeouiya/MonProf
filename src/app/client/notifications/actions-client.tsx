"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClientNotificationActions({
  mode,
  id,
  read,
  status,
}: {
  mode: "all" | "row";
  id?: string;
  read?: boolean;
  status?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patch(body: Record<string, unknown>, success: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/client/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible.");
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "all") {
    return (
      <Button variant="outline" onClick={() => patch({ markAllRead: true }, "Notifications marquées comme lues")} disabled={loading} className="min-h-10 self-start rounded-lg px-3 text-xs min-[460px]:min-h-11 min-[460px]:text-sm">
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />}
        Tout marquer lu
      </Button>
    );
  }

  if (!id) return null;
  const confirmed = status === "CONFIRMED";

  return (
    <div className="flex w-full flex-col gap-2 min-[640px]:w-auto min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-end">
      {!confirmed && (
        <Button
          variant="default"
          size="sm"
          onClick={() => patch({ id, action: "confirm" }, "Notification confirmée")}
          disabled={loading}
          className="min-h-11 w-full rounded-lg min-[640px]:w-auto"
        >
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />}
          Confirmer réception
        </Button>
      )}
      <Button
        variant={read ? "outline" : "secondary"}
        size="sm"
        onClick={() => patch({ id, read: !read }, read ? "Notification remise en non lue" : "Notification marquée comme lue")}
        disabled={loading}
        className="min-h-11 w-full rounded-lg min-[640px]:w-auto"
      >
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : read ? <Bell className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
        {read ? "Remettre non lue" : "Marquer lue"}
      </Button>
    </div>
  );
}
