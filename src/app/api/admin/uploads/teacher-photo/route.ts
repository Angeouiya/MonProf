import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export const runtime = "nodejs";

const MAX_SIZE = 4 * 1024 * 1024;
const MIN_DIMENSION = 240;
const OUTPUT_DIMENSION = 1200;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

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

    const input = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageSignature(input, file.type)) {
      return NextResponse.json(
        { error: "Le fichier ne semble pas être une image valide JPG, PNG ou WEBP." },
        { status: 400 },
      );
    }

    const sourceMetadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    }).metadata();
    if (!sourceMetadata.width || !sourceMetadata.height) {
      return NextResponse.json({ error: "Dimensions de photo impossibles à lire." }, { status: 400 });
    }
    if (sourceMetadata.width < MIN_DIMENSION || sourceMetadata.height < MIN_DIMENSION) {
      return NextResponse.json(
        { error: `Photo trop petite. Utilisez une image d'au moins ${MIN_DIMENSION} × ${MIN_DIMENSION} pixels.` },
        { status: 400 },
      );
    }

    const { data, info } = await sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize({
        width: OUTPUT_DIMENSION,
        height: OUTPUT_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    const asset = await db.teacherPhotoAsset.create({
      data: {
        contentType: "image/webp",
        data: Uint8Array.from(data),
        size: data.length,
        width: info.width,
        height: info.height,
      },
      select: { id: true, size: true, width: true, height: true },
    });

    return NextResponse.json({
      photoUrl: `/api/teacher-photos/${asset.id}`,
      optimized: true,
      size: asset.size,
      width: asset.width,
      height: asset.height,
    });
  } catch (error) {
    console.error("[teacher-photo-upload]", error);
    return NextResponse.json(
      { error: "La photo n'a pas pu être enregistrée. Réessayez avec une image JPG, PNG ou WEBP." },
      { status: 500 },
    );
  }
}
