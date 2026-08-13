"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Loader2, Trash2 } from "lucide-react";
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
  const [notice, setNotice] = useState("");

  async function patch(body: Record<string, unknown>, success: string) {
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch("/api/client/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible.");
      setNotice(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "all") {
    return (
      <div className="grid gap-1.5">
        <Button variant="outline" onClick={() => patch({ markAllRead: true }, "Notifications marquées comme lues")} disabled={loading} className="min-h-11 w-full rounded-lg px-3 text-xs min-[460px]:w-auto min-[460px]:text-sm">
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />}
          Tout marquer lu
        </Button>
        <InlineNotificationStatus message={notice} />
      </div>
    );
  }

  async function deleteNotification() {
    if (!id) return;
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch(`/api/client/notifications/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Suppression impossible.");
      setNotice("Notification supprimée de votre centre.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setLoading(false);
    }
  }

  if (!id) return null;
  const confirmed = status === "CONFIRMED";

  return (
    <div className="grid w-full grid-cols-1 gap-2">
      <div className="grid w-full grid-cols-1 gap-2 min-[460px]:grid-cols-2 min-[720px]:grid-cols-1">
        {!confirmed && (
          <Button
            variant="default"
            size="sm"
            onClick={() => patch({ id, action: "confirm" }, "Notification confirmée")}
            disabled={loading}
            className="min-h-11 w-full rounded-lg"
          >
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />}
            Confirmer réception
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => patch({ id, read: !read }, read ? "Notification remise en non lue" : "Notification marquée comme lue")}
          disabled={loading}
          className="min-h-11 w-full rounded-lg"
        >
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : read ? <Bell className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
          {read ? "Remettre non lue" : "Marquer lue"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={deleteNotification}
          disabled={loading}
          className="min-h-11 w-full rounded-lg border-red-100 text-red-700 hover:border-red-200"
        >
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
          Supprimer
        </Button>
      </div>
      <InlineNotificationStatus message={notice} />
    </div>
  );
}

function InlineNotificationStatus({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p
      className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold leading-5 text-emerald-800"
      role="status"
      aria-live="polite"
      data-client-notification-inline-status
    >
      {message}
    </p>
  );
}
