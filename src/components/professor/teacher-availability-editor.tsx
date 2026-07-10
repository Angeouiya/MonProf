"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AvailabilityGrid, createEmptyAvailability, normalizeAvailability, TWO_HOUR_SLOTS, WEEK_DAYS } from "@/lib/scheduling";

function countSlots(availability: AvailabilityGrid) {
  return WEEK_DAYS.reduce((total, day) => (
    total + TWO_HOUR_SLOTS.filter((slot) => availability[day.key]?.[slot.key]).length
  ), 0);
}

export function TeacherAvailabilityEditor({ initialAvailability }: { initialAvailability?: unknown }) {
  const router = useRouter();
  const [availability, setAvailability] = useState<AvailabilityGrid>(() => normalizeAvailability(initialAvailability));
  const [saving, setSaving] = useState(false);
  const selectedSlots = useMemo(() => countSlots(availability), [availability]);
  const selectedHours = selectedSlots * 2;

  function updateSlot(dayKey: string, slotKey: string, value: boolean) {
    setAvailability((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [slotKey]: value,
      },
    }));
  }

  function setDay(dayKey: string, value: boolean) {
    setAvailability((prev) => ({
      ...prev,
      [dayKey]: Object.fromEntries(TWO_HOUR_SLOTS.map((slot) => [slot.key, value])),
    }));
  }

  function setPreset(preset: "weekdays" | "weekends" | "evenings" | "clear") {
    if (preset === "clear") {
      setAvailability(createEmptyAvailability());
      return;
    }
    const next = createEmptyAvailability();
    const dayKeys = preset === "weekdays"
      ? ["mon", "tue", "wed", "thu", "fri"]
      : preset === "weekends"
        ? ["sat", "sun"]
        : WEEK_DAYS.map((day) => day.key);
    const slotKeys = preset === "evenings" ? ["18-20", "20-22"] : TWO_HOUR_SLOTS.map((slot) => slot.key);
    for (const dayKey of dayKeys) {
      for (const slotKey of slotKeys) next[dayKey][slotKey] = true;
    }
    setAvailability(next);
  }

  async function saveAvailability() {
    if (selectedSlots === 0) {
      toast.error("Sélectionnez au moins un créneau de 2h.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/professor/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible");
      toast.success("Disponibilités enregistrées.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg border border-[#E6EAF3] bg-white p-3 min-[520px]:p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div data-professor-availability-metrics className="grid grid-cols-2 gap-2 min-[760px]:grid-cols-3 min-[760px]:gap-3">
          <Metric label="Créneaux ouverts" value={selectedSlots} detail={`${selectedHours}h disponibles`} />
          <Metric label="Durée séance" value="2h" detail="Une séance = deux heures" />
          <div className="col-span-2 min-[760px]:col-span-1">
            <Metric label="Validation" value="Service client" detail="Chaque mise à jour est historisée" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:w-[360px]">
          <Button type="button" variant="outline" className="rounded-lg bg-white" onClick={() => setPreset("weekdays")}>Jours ouvrés</Button>
          <Button type="button" variant="outline" className="rounded-lg bg-white" onClick={() => setPreset("weekends")}>Week-end</Button>
          <Button type="button" variant="outline" className="rounded-lg bg-white" onClick={() => setPreset("evenings")}>Soirs</Button>
          <Button type="button" variant="ghost" className="rounded-lg bg-white" onClick={() => setPreset("clear")}>Tout vider</Button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {WEEK_DAYS.map((day) => {
          const dayCount = TWO_HOUR_SLOTS.filter((slot) => availability[day.key]?.[slot.key]).length;
          return (
            <section key={day.key} className="rounded-lg border border-[#E6EAF3] bg-white p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{day.label}</p>
                  <p className="text-xs font-semibold text-[#64748B]">{dayCount} créneau(x) de 2h</p>
                </div>
                <div className="flex gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg bg-white px-2 text-[11px]" onClick={() => setDay(day.key, true)}>Tout</Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-lg bg-white px-2 text-[11px]" onClick={() => setDay(day.key, false)}>Vider</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
                {TWO_HOUR_SLOTS.map((slot) => {
                  const checked = !!availability[day.key]?.[slot.key];
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() => updateSlot(day.key, slot.key, !checked)}
                      className={`min-h-11 rounded-lg border px-2 py-2 text-center text-xs font-semibold transition ${checked ? "border-[#111B4D] bg-[#111B4D] text-white" : "border-[#E6EAF3] bg-white text-[#475569]"}`}
                      aria-pressed={checked}
                    >
                      {slot.shortLabel}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-[#E6EAF3] bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E6EAF3]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]">Jour</th>
              {TWO_HOUR_SLOTS.map((slot) => (
                <th key={slot.key} className="px-3 py-3 text-center text-xs font-semibold text-[#64748B]">{slot.shortLabel}</th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {WEEK_DAYS.map((day) => (
              <tr key={day.key} className="border-b border-[#EEF2F7] last:border-0">
                <td className="px-4 py-3 font-semibold text-[#111827]">{day.label}</td>
                {TWO_HOUR_SLOTS.map((slot) => (
                  <td key={slot.key} className="px-2 py-3 text-center">
                    <Checkbox
                      checked={!!availability[day.key]?.[slot.key]}
                      onCheckedChange={(value) => updateSlot(day.key, slot.key, !!value)}
                      aria-label={`${day.label} ${slot.shortLabel}`}
                      className="size-10 rounded-lg"
                    />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="rounded-lg bg-white px-2 text-[11px]" onClick={() => setDay(day.key, true)}>Tout</Button>
                    <Button type="button" variant="ghost" size="sm" className="rounded-lg bg-white px-2 text-[11px]" onClick={() => setDay(day.key, false)}>Vider</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-20 z-10 flex justify-end rounded-lg border border-[#E6EAF3] bg-white p-3 lg:bottom-3">
        <Button type="button" onClick={saveAvailability} disabled={saving} className="w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78] min-[640px]:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer les disponibilités
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-[#E6EAF3] bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#111B4D]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#64748B]">{detail}</p>
    </div>
  );
}
