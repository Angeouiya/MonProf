import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";
import { isTeacherCoverCatalogUrl, selectLeastUsedTeacherCover } from "@/lib/teacher-cover";
import { inspectTeacherImage } from "@/lib/server/teacher-image-file";
import { storeTeacherMedia } from "@/lib/server/teacher-media-store";

export const runtime = "nodejs";

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

    const input = new Uint8Array(await file.arrayBuffer());
    const inspection = inspectTeacherImage(input, file.type);
    if (!inspection.ok) {
      return NextResponse.json({ error: inspection.error }, { status: 400 });
    }
    const minimumWidth = action === "custom-cover" ? 900 : 300;
    const minimumHeight = action === "custom-cover" ? 300 : 300;
    if (inspection.width < minimumWidth || inspection.height < minimumHeight) {
      return NextResponse.json({
        error: action === "custom-cover"
          ? "La couverture doit mesurer au moins 900 × 300 pixels."
          : "La photo doit mesurer au moins 300 × 300 pixels.",
      }, { status: 400 });
    }

    const asset = await storeTeacherMedia({
      bytes: input,
      contentType: inspection.contentType,
      width: inspection.width,
      height: inspection.height,
    });
    const mediaUrl = `/api/teacher-photos/${asset.id}`;
    const update = action === "custom-cover" ? { pendingCoverUrl: mediaUrl } : { photoUrl: mediaUrl };
    await updateTeacherMedia(
      teacher.id,
      update,
      action === "custom-cover" ? "Couverture personnalisée envoyée pour validation" : "Photo de profil mise à jour",
    );
    return NextResponse.json({ ok: true, [action === "custom-cover" ? "pendingCoverUrl" : "photoUrl"]: mediaUrl });
  } catch (error) {
    const incidentId = crypto.randomUUID();
    console.error("[professor-profile-media]", {
      incidentId,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
    return NextResponse.json({ error: `L'image n'a pas pu être enregistrée. Référence : ${incidentId.slice(0, 8)}.` }, { status: 500 });
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
