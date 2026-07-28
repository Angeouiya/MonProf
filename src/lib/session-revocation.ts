export function isCurrentSessionVersion(tokenVersion: unknown, storedVersion: number) {
  return typeof tokenVersion === "number"
    && Number.isSafeInteger(tokenVersion)
    && tokenVersion >= 0
    && tokenVersion === storedVersion;
}
