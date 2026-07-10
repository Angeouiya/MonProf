import { z } from "zod";

export const COMMUNE_TRANSPORT_CLASSES = ["GRAND_ABIDJAN", "PERI_URBAN", "INTERIOR"] as const;

const optionalText = (maximum: number) => z.union([z.string().trim().max(maximum), z.null()]).optional();
const optionalAmount = z.union([z.coerce.number().int().min(0).max(100_000), z.null()]).optional();

export const communeInputSchema = z.object({
  name: z.string().trim().min(2, "Le nom de la commune est requis.").max(100),
  zone: optionalText(100),
  transportClass: z.enum(COMMUNE_TRANSPORT_CLASSES).default("INTERIOR"),
  transportFeeOverride: optionalAmount,
  isActive: z.boolean().default(true),
});

export const communePatchSchema = communeInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Aucune modification reçue.",
);

export const quarterInputSchema = z.object({
  name: z.string().trim().min(2, "Le nom du quartier est requis.").max(100),
  aliases: optionalText(300),
  isActive: z.boolean().default(true),
});

export const quarterPatchSchema = quarterInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Aucune modification reçue.",
);

export function locationSlug(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nullableText(value: string | null | undefined) {
  return value?.trim() || null;
}
