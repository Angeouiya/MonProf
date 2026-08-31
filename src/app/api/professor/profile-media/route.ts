import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";
import { isTeacherCoverCatalogUrl, selectLeastUsedTeacherCover } from "@/lib/teacher-cover";
import { persistTeacherMediaToKv } from "@/lib/server/teacher-media-kv";

export const runtime = "nodejs";

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.length >= 8
      && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
      && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireTeacherApi();
    if (!teacher) return NextResponse.json({ error: "Session professeur invalide." }, { status: 401 });

    const formData = await request.formData();
    const action = String(formData.get("action") ?? "");

    if (action === "automatic-cover") {
      const otherCovers = await db.teacher.findMany({
        where: { id: { not: teacher.id } },
        select: { coverUrl: true },
      });
      const automaticCover = selectLeastUsedTeacherCover(
        otherCovers.map((item) => item.coverUrl),
        teacher.id,
      );
      await updateTeacherMedia(
        teacher.id,
        { coverUrl: automaticCover.url, pendingCoverUrl: null },
        "Couverture automatique activée",
      );
      return NextResponse.json({ ok: true, coverUrl: automaticCover.url });
    }

    if (action === "catalog-cover") {
      const coverUrl = formData.get("coverUrl");
      if (!isTeacherCoverCatalogUrl(coverUrl)) {
        return NextResponse.json({ error: "Couverture du catalogue invalide." }, { status: 400 });
      }
      await updateTeacherMedia(teacher.id, { coverUrl, pendingCoverUrl: null }, "Couverture du catalogue sélectionnée");
      return NextResponse.json({ ok: true, coverUrl });
    }

    if (action !== "profile-photo" && action !== "custom-cover") {
      return NextResponse.json({ error: "Action média invalide." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Utilisez une image JPG, PNG ou WEBP." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json({ error: "L'image doit peser moins de 4 Mo." }, { status: 413 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageSignature(input, file.type)) {
      return NextResponse.json({ error: "Le contenu du fichier image est invalide." }, { status: 400 });
    }

    const metadata = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
    const minimumWidth = action === "custom-cover" ? 900 : 300;
    const minimumHeight = action === "custom-cover" ? 300 : 300;
    if (!metadata.width || !metadata.height || metadata.width < minimumWidth || metadata.height < minimumHeight) {
      return NextResponse.json({
        error: action === "custom-cover"
          ? "La couverture doit mesurer au moins 900 × 300 pixels."
          : "La photo doit mesurer au moins 300 × 300 pixels.",
      }, { status: 400 });
    }

    const dimensions = action === "custom-cover"
      ? { width: 1920, height: 640 }
      : { width: 1000, height: 1000 };
    const { data, info } = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        ...dimensions,
        fit: action === "custom-cover" ? "contain" : "cover",
        position: action === "custom-cover" ? "centre" : "attention",
        background: { r: 17, g: 27, b: 77, alpha: 1 },
        withoutEnlargement: false,
      })
      .webp({ quality: action === "custom-cover" ? 82 : 86, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    const asset = await db.teacherPhotoAsset.create({
      data: {
        contentType: "image/webp",
        data: Uint8Array.from(data),
        size: data.length,
        width: info.width,
        height: info.height,
      },
      select: { id: true },
    });
    await persistTeacherMediaToKv(asset.id, Uint8Array.from(data));
    const mediaUrl = `/api/teacher-photos/${asset.id}`;
    const update = action === "custom-cover" ? { pendingCoverUrl: mediaUrl } : { photoUrl: mediaUrl };
    await updateTeacherMedia(
      teacher.id,
      update,
      action === "custom-cover" ? "Couverture personnalisée envoyée pour validation" : "Photo de profil mise à jour",
    );
    return NextResponse.json({ ok: true, [action === "custom-cover" ? "pendingCoverUrl" : "photoUrl"]: mediaUrl });
  } catch (error) {
    console.error("[professor-profile-media]", error);
    return NextResponse.json({ error: "L'image n'a pas pu être enregistrée." }, { status: 500 });
  }
}

async function updateTeacherMedia(
  teacherId: string,
  data: { photoUrl?: string; coverUrl?: string | null; pendingCoverUrl?: string | null },
  message: string,
) {
  await db.$transaction([
    db.teacher.update({ where: { id: teacherId }, data: { ...data, lastActivityAt: new Date() } }),
    db.teacherNotification.create({
      data: {
        teacherId,
        title: "Profil visuel mis à jour",
        message: `${message}. La nouvelle présentation est visible sur votre fiche publique.`,
        channel: "INTERNAL",
        sent: true,
        status: "SENT",
      },
    }),
  ]);
}
