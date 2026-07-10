const IMAGE_EXTENSION_RE = /\.(jpe?g|png|webp)(?:[?#].*)?$/i;
const MANAGED_TEACHER_PHOTO_RE = /^\/api\/teacher-photos\/[a-z0-9]+$/i;

export function validateTeacherPhotoUrl(value: unknown) {
  const photoUrl = typeof value === "string" ? value.trim() : "";
  if (!photoUrl) {
    return { ok: false as const, error: "La photo réelle du professeur est obligatoire." };
  }

  const isLocalPath = photoUrl.startsWith("/") && !photoUrl.startsWith("//");
  const isRemoteUrl = /^https?:\/\//i.test(photoUrl);
  if (!isLocalPath && !isRemoteUrl) {
    return {
      ok: false as const,
      error: "La photo doit être une URL http(s) ou un chemin local commençant par /.",
    };
  }

  if (!IMAGE_EXTENSION_RE.test(photoUrl) && !MANAGED_TEACHER_PHOTO_RE.test(photoUrl)) {
    return {
      ok: false as const,
      error: "La photo doit être au format JPG, JPEG, PNG ou WEBP.",
    };
  }

  if (isRemoteUrl) {
    try {
      const parsed = new URL(photoUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { ok: false as const, error: "URL de photo non autorisée." };
      }
    } catch {
      return { ok: false as const, error: "URL de photo invalide." };
    }
  }

  return { ok: true as const, photoUrl };
}
