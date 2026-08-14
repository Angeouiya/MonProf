import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

export const PLATFORM_SETTING_DEFAULTS = {
  platform_name: "Compétence",
  default_commission: "30",
  support_phone: "+225 01 61 39 39 39",
  support_email: "contact@competence.ci",
  teacher_payout_min_hours: "1",
  teacher_payout_max_hours: "72",
  transport_same_commune_fee: "1000",
  transport_near_commune_fee: "2500",
  transport_far_commune_fee: "4500",
  transport_interior_fee: "8000",
  schedule_same_neighborhood_buffer_minutes: "30",
  schedule_same_commune_buffer_minutes: "30",
  schedule_near_commune_buffer_minutes: "60",
  schedule_far_commune_buffer_minutes: "90",
  schedule_outside_grand_abidjan_buffer_minutes: "90",
  schedule_home_online_buffer_minutes: "30",
  notification_cron_enabled: "true",
  notification_delivery_enabled: "true",
  notification_from_name: "Compétence",
  loyalty_gifts_enabled: "true",
  loyalty_gifts_cycle_enabled: "true",
  loyalty_minimum_margin_percent: "5",
  loyalty_gift_2_rate: "12",
  loyalty_gift_2_days: "9",
  loyalty_gift_3_rate: "9",
  loyalty_gift_3_days: "7",
  loyalty_gift_4_rate: "10",
  loyalty_gift_4_days: "12",
  loyalty_gift_5_rate: "13",
  loyalty_gift_5_days: "10",
  loyalty_gift_6_rate: "8",
  loyalty_gift_6_days: "8",
  loyalty_gift_7_rate: "15",
  loyalty_gift_7_days: "7",
} as const;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const numericSetting = (minimum: number, maximum: number) => z.union([z.string(), z.number()])
  .transform((value) => Number(value))
  .pipe(z.number().finite().int().min(minimum).max(maximum));

export const platformSettingsInputSchema = z.object({
  platform_name: text(2, 80),
  default_commission: numericSetting(0, 60),
  support_phone: text(8, 30),
  support_email: z.string().trim().email().max(160),
  teacher_payout_min_hours: numericSetting(1, 72),
  teacher_payout_max_hours: numericSetting(1, 72),
  transport_same_commune_fee: numericSetting(0, 50_000),
  transport_near_commune_fee: numericSetting(0, 50_000),
  transport_far_commune_fee: numericSetting(0, 50_000),
  transport_interior_fee: numericSetting(0, 100_000),
  schedule_same_neighborhood_buffer_minutes: numericSetting(0, 180),
  schedule_same_commune_buffer_minutes: numericSetting(0, 180),
  schedule_near_commune_buffer_minutes: numericSetting(0, 180),
  schedule_far_commune_buffer_minutes: numericSetting(0, 180),
  schedule_outside_grand_abidjan_buffer_minutes: numericSetting(0, 180),
  schedule_home_online_buffer_minutes: numericSetting(0, 180),
  notification_cron_enabled: z.enum(["true", "false"]),
  notification_delivery_enabled: z.enum(["true", "false"]),
  notification_from_name: text(2, 80),
  loyalty_gifts_enabled: z.enum(["true", "false"]),
  loyalty_gifts_cycle_enabled: z.enum(["true", "false"]),
  loyalty_minimum_margin_percent: numericSetting(0, 20),
  loyalty_gift_2_rate: numericSetting(8, 15),
  loyalty_gift_2_days: numericSetting(7, 14),
  loyalty_gift_3_rate: numericSetting(8, 15),
  loyalty_gift_3_days: numericSetting(7, 14),
  loyalty_gift_4_rate: numericSetting(8, 15),
  loyalty_gift_4_days: numericSetting(7, 14),
  loyalty_gift_5_rate: numericSetting(8, 15),
  loyalty_gift_5_days: numericSetting(7, 14),
  loyalty_gift_6_rate: numericSetting(8, 15),
  loyalty_gift_6_days: numericSetting(7, 14),
  loyalty_gift_7_rate: numericSetting(8, 15),
  loyalty_gift_7_days: numericSetting(7, 14),
}).superRefine((value, context) => {
  if (value.teacher_payout_max_hours < value.teacher_payout_min_hours) {
    context.addIssue({
      code: "custom",
      path: ["teacher_payout_max_hours"],
      message: "Le délai maximum doit être supérieur ou égal au délai minimum.",
    });
  }
  if (value.transport_near_commune_fee < value.transport_same_commune_fee) {
    context.addIssue({ code: "custom", path: ["transport_near_commune_fee"], message: "Le forfait proche ne peut pas être inférieur au forfait local." });
  }
  if (value.transport_far_commune_fee < value.transport_near_commune_fee) {
    context.addIssue({ code: "custom", path: ["transport_far_commune_fee"], message: "Le forfait éloigné ne peut pas être inférieur au forfait proche." });
  }
  if (value.transport_interior_fee < value.transport_far_commune_fee) {
    context.addIssue({ code: "custom", path: ["transport_interior_fee"], message: "Le forfait intérieur ne peut pas être inférieur au forfait éloigné." });
  }
  if (value.schedule_same_commune_buffer_minutes < value.schedule_same_neighborhood_buffer_minutes) {
    context.addIssue({ code: "custom", path: ["schedule_same_commune_buffer_minutes"], message: "Le temps même commune ne peut pas être inférieur au même quartier." });
  }
  if (value.schedule_near_commune_buffer_minutes < value.schedule_same_commune_buffer_minutes) {
    context.addIssue({ code: "custom", path: ["schedule_near_commune_buffer_minutes"], message: "Le temps commune proche ne peut pas être inférieur au même commune." });
  }
  if (value.schedule_far_commune_buffer_minutes < value.schedule_near_commune_buffer_minutes) {
    context.addIssue({ code: "custom", path: ["schedule_far_commune_buffer_minutes"], message: "Le temps commune éloignée ne peut pas être inférieur au proche." });
  }
  if (value.schedule_outside_grand_abidjan_buffer_minutes < value.schedule_far_commune_buffer_minutes) {
    context.addIssue({ code: "custom", path: ["schedule_outside_grand_abidjan_buffer_minutes"], message: "Le temps hors Grand Abidjan ne peut pas être inférieur à une commune éloignée." });
  }
});

export type PlatformSettingsInput = z.infer<typeof platformSettingsInputSchema>;

export function platformSettingsForForm(rows: Array<{ key: string; value: string }>) {
  const values: Record<string, string> = { ...PLATFORM_SETTING_DEFAULTS };
  for (const row of rows) {
    if (row.key in PLATFORM_SETTING_DEFAULTS) values[row.key] = row.value;
  }
  return values;
}

export function platformSettingsInputToRows(input: PlatformSettingsInput) {
  return Object.entries(input).map(([key, value]) => ({ key, value: String(value) }));
}

export const getPlatformRuntimeSettings = unstable_cache(
  async () => {
    const rows = await db.setting.findMany({
      where: { key: { in: Object.keys(PLATFORM_SETTING_DEFAULTS) } },
      select: { key: true, value: true },
    });
    const values = platformSettingsForForm(rows);
    const commissionPercent = integer(values.default_commission, 30, 0, 60);
    return {
      platformName: values.platform_name,
      commissionPercent,
      teacherPercent: 100 - commissionPercent,
      supportPhone: values.support_phone,
      supportEmail: values.support_email,
      payoutDelay: {
        minimumHours: integer(values.teacher_payout_min_hours, 1, 1, 72),
        maximumHours: integer(values.teacher_payout_max_hours, 72, 1, 72),
      },
      transportFees: {
        sameCommune: integer(values.transport_same_commune_fee, 1000, 0, 50_000),
        nearCommune: integer(values.transport_near_commune_fee, 2500, 0, 50_000),
        farCommune: integer(values.transport_far_commune_fee, 4500, 0, 50_000),
        interior: integer(values.transport_interior_fee, 8000, 0, 100_000),
      },
      scheduleBuffers: {
        sameNeighborhood: integer(values.schedule_same_neighborhood_buffer_minutes, 30, 0, 180),
        sameCommune: integer(values.schedule_same_commune_buffer_minutes, 30, 0, 180),
        nearCommune: integer(values.schedule_near_commune_buffer_minutes, 60, 0, 180),
        farCommune: integer(values.schedule_far_commune_buffer_minutes, 90, 0, 180),
        outsideGrandAbidjan: integer(values.schedule_outside_grand_abidjan_buffer_minutes, 90, 0, 180),
        homeOnline: integer(values.schedule_home_online_buffer_minutes, 30, 0, 180),
        onlineOnline: 0,
      },
    };
  },
  ["platform-runtime-settings-v2"],
  { revalidate: 60, tags: ["platform-settings"] },
);

function integer(value: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}
