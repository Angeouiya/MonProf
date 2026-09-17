import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { inspectTeacherImage } from "@/lib/server/teacher-image-file";
import { storeTeacherMedia } from "@/lib/server/teacher-media-store";

export const runtime = "nodejs";

const MAX_SIZE = 4 * 1024 * 1024;
const MIN_DIMENSION = 240;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdminApi("TEACHERS_MANAGE"))) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucune photo reçue." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Format non autorisé. Utilisez JPG, JPEG, PNG ou WEBP." },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Photo trop lourde. Taille maximale autorisée : 4 Mo." },
        { status: 413 },
      );
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Photo vide ou invalide." }, { status: 400 });
    }

    const input = new Uint8Array(await file.arrayBuffer());
    const inspection = inspectTeacherImage(input, file.type);
    if (!inspection.ok) {
      return NextResponse.json({ error: inspection.error }, { status: 400 });
    }
    if (inspection.width < MIN_DIMENSION || inspection.height < MIN_DIMENSION) {
      return NextResponse.json(
        { error: `Photo trop petite. Utilisez une image d'au moins ${MIN_DIMENSION} × ${MIN_DIMENSION} pixels.` },
        { status: 400 },
      );
    }

    const asset = await storeTeacherMedia({
      bytes: input,
      contentType: inspection.contentType,
      width: inspection.width,
      height: inspection.height,
    });

    return NextResponse.json({
      photoUrl: `/api/teacher-photos/${asset.id}`,
      optimized: inspection.contentType === "image/webp",
      size: asset.size,
      width: asset.width,
      height: asset.height,
    });
  } catch (error) {
    const incidentId = crypto.randomUUID();
    console.error("[teacher-photo-upload]", {
      incidentId,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
    return NextResponse.json(
      { error: `La photo n'a pas pu être enregistrée. Réessayez dans quelques instants. Référence : ${incidentId.slice(0, 8)}.` },
      { status: 500 },
    );
  }
}
