import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { analyzeTeacherCv } from "@/lib/teacher-cv-analysis";
import { db } from "@/lib/db";

const MAX_CV_SIZE = 4 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];
const ALLOWED_MIME_HINTS = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/octet-stream",
];

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("TEACHERS_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Fichier illisible ou trop volumineux." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun CV reçu." }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "CV vide ou invalide." }, { status: 400 });
  }
  if (file.size > MAX_CV_SIZE) {
    return NextResponse.json({ error: "CV trop lourd. Taille maximale autorisée : 4 Mo." }, { status: 400 });
  }

  const filename = file.name || "cv";
  const lowerFilename = filename.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((extension) => lowerFilename.endsWith(extension));
  const hasAllowedMime = ALLOWED_MIME_HINTS.includes(file.type || "application/octet-stream");
  if (!hasAllowedExtension || !hasAllowedMime) {
    return NextResponse.json(
      { error: "Format non autorisé. Utilisez un CV PDF texte, DOCX, TXT ou MD." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidFileSignature(buffer, lowerFilename)) {
      return NextResponse.json(
        { error: "Le contenu du fichier ne correspond pas au format annoncé." },
        { status: 400 },
      );
    }
    const analysis = await analyzeTeacherCv({
      buffer,
      filename,
      mimeType: file.type || "application/octet-stream",
    });
    if (analysis.extractedCharacters < 80) {
      return NextResponse.json(
        {
          error: "Le CV ne contient pas assez de texte exploitable. Utilisez un PDF texte ou un DOCX non protégé.",
          warnings: analysis.warnings,
        },
        { status: 422 },
      );
    }
    const asset = await db.teacherCvAsset.create({
      data: {
        originalName: filename.slice(0, 180),
        contentType: file.type || contentTypeForFilename(lowerFilename),
        data: buffer,
        size: buffer.length,
      },
      select: { id: true },
    });
    return NextResponse.json({
      ...analysis,
      filename,
      cvUrl: `/api/admin/teacher-cvs/${asset.id}`,
      analyzedBy: admin.name,
    });
  } catch (error) {
    console.error("Teacher CV analysis failed", error);
    return NextResponse.json(
      { error: "Analyse du CV impossible. Vérifiez que le fichier n'est pas protégé ou scanné en image." },
      { status: 500 },
    );
  }
}

function hasValidFileSignature(buffer: Buffer, filename: string) {
  if (filename.endsWith(".pdf")) return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (filename.endsWith(".docx")) return buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (filename.endsWith(".txt") || filename.endsWith(".md")) {
    return !buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
  }
  return false;
}

function contentTypeForFilename(filename: string) {
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (filename.endsWith(".md")) return "text/markdown";
  return "text/plain";
}
