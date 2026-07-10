export const SENSITIVE_SETTING_KEYS = new Set([
  "paydunya_master_key",
  "paydunya_public_key",
  "paydunya_private_key",
  "paydunya_token",
  "web_push_vapid_public_key",
  "web_push_vapid_private_key",
  "web_push_subject",
]);

export function isSensitiveSettingKey(key: string) {
  return SENSITIVE_SETTING_KEYS.has(key);
}

export function settingsForClient(rows: Array<{ key: string; value: string }>, defaults: Record<string, string> = {}) {
  const settings: Record<string, string> = { ...defaults };
  for (const row of rows) {
    if (isSensitiveSettingKey(row.key)) {
      settings[`${row.key}_configured`] = row.value.trim() ? "true" : "false";
      continue;
    }
    settings[row.key] = row.value;
  }
  return settings;
}

export function editableSettingsFromClient(input: Record<string, unknown>) {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveSettingKey(key) || key.endsWith("_configured")) continue;
    clean[key] = String(value);
  }
  return clean;
}
