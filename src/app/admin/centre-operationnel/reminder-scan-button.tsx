"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReminderScanButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const scan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notification-reminders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan impossible.");
      toast.success(
        `${data.relaunched ?? 0} première(s) relance(s), ${data.secondRelaunched ?? 0} deuxième(s) relance(s), ${data.imminentCourseAlerts ?? 0} cours imminent(s), ${data.adminAlerts ?? 0} alerte(s), ${data.replacementTasks ?? 0} tâche(s) critique(s).`
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scan impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={scan} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
      Scanner les relances
    </Button>
  );
}
