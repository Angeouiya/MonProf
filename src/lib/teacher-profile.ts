export function parseTeacherProfileList(value?: string | null): string[] {
  if (!value) return [];
  const raw = value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    }
  } catch {
    // Plain multiline text is the default input format in the admin form.
  }

  return raw
    .split(/\r?\n|;/)
    .map((item) => item.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export function previewTeacherProfileList(value?: string | null, limit = 3) {
  return parseTeacherProfileList(value).slice(0, limit);
}

export function normalizeTeacherProfileText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return cleaned || null;
}
