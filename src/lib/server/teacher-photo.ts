import { access } from "fs/promises";
import path from "path";
import { validateTeacherPhotoUrl } from "@/lib/teacher-photo";
import { db } from "@/lib/db";

export async function validateTeacherPhotoUrlForStorage(value: unknown) {
  const validation = validateTeacherPhotoUrl(value);
  if (!validation.ok) return validation;

  const { photoUrl } = validation;
  if (/^https?:\/\//i.test(photoUrl)) {
    return validation;
  }

  const managedPhotoMatch = photoUrl.match(/^\/api\/teacher-photos\/([a-z0-9]+)$/i);
  if (managedPhotoMatch) {
    const asset = await db.teacherPhotoAsset.findUnique({
      where: { id: managedPhotoMatch[1] },
      select: { id: true },
    });
    return asset
      ? validation
      : { ok: false as const, error: "La photo importée est introuvable. Importez-la à nouveau." };
  }

  let decodedPath = photoUrl;
  try {
    decodedPath = decodeURIComponent(photoUrl);
  } catch {
    return { ok: false as const, error: "Chemin de photo invalide." };
  }

  const publicRoot = path.resolve(process.cwd(), "public");
  const relativePath = decodedPath.replace(/^\/+/, "");
  const resolvedPath = path.resolve(publicRoot, relativePath);

  if (resolvedPath !== publicRoot && !resolvedPath.startsWith(`${publicRoot}${path.sep}`)) {
    return { ok: false as const, error: "Chemin de photo non autorisé." };
  }

  try {
    await access(resolvedPath);
  } catch {
    return {
      ok: false as const,
      error: "Le fichier photo indiqué est introuvable. Importez une vraie photo ou choisissez une image existante.",
    };
  }

  return validation;
}
