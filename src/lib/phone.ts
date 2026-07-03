const IVORY_COAST_COUNTRY_CODE = "225";

export function normalizeIvorianPhoneForWhatsApp(phone?: string | null) {
  if (!phone) return "";
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "";

  if (digits.startsWith(IVORY_COAST_COUNTRY_CODE)) return digits;

  // Local mobile and landline formats are commonly stored as 10 digits:
  // 07 XX XX XX XX, 05 XX XX XX XX, 01 XX XX XX XX, 27 XX XX XX XX.
  if (digits.length === 10) return `${IVORY_COAST_COUNTRY_CODE}${digits}`;

  // Legacy local mobile numbers can appear as 8 digits in old records.
  if (digits.length === 8) return `${IVORY_COAST_COUNTRY_CODE}${digits}`;

  return digits;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalizedPhone = normalizeIvorianPhoneForWhatsApp(phone);
  const cleanMessage = message.trim();
  if (!normalizedPhone || !cleanMessage) return "";
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(cleanMessage)}`;
}
