"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReminderRunResult = {
  ok: boolean;
  relaunched: number;
  secondRelaunched: number;
  adminAlerts: number;
  replacementTasks: number;
  imminentCourseAlerts: number;
};

export function RunNotificationRemindersClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function runReminders() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notification-reminders", { method: "POST" });
      const data = (await res.json()) as Partial<ReminderRunResult> & { error?: string };
      if (!res.ok) throw new Error(data.error || "Relances automatiques impossibles.");

      const relaunched = data.relaunched ?? 0;
      const secondRelaunched = data.secondRelaunched ?? 0;
      const adminAlerts = data.adminAlerts ?? 0;
      const replacementTasks = data.replacementTasks ?? 0;
      const imminentCourseAlerts = data.imminentCourseAlerts ?? 0;

      toast.success(
        [
          `${relaunched + secondRelaunched} relance(s) professeur`,
          `${adminAlerts} alerte(s) admin`,
          `${replacementTasks} tâche(s) remplacement`,
          `${imminentCourseAlerts} cours imminent(s)`,
        ].join(" • "),
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Relances automatiques impossibles.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={runReminders} disabled={loading}>
      {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
      Exécuter relances
    </Button>
  );
}
