import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { analyzeTeacherCv } from "@/lib/teacher-cv-analysis";

const MAX_CV_SIZE = 6 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];
const ALLOWED_MIME_HINTS = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/octet-stream",
];

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun CV reçu." }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "CV vide ou invalide." }, { status: 400 });
  }
  if (file.size > MAX_CV_SIZE) {
    return NextResponse.json({ error: "CV trop lourd. Taille maximale autorisée : 6 Mo." }, { status: 400 });
  }

  const filename = file.name || "cv";
  const lowerFilename = filename.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((extension) => lowerFilename.endsWith(extension));
  const hasAllowedMime = ALLOWED_MIME_HINTS.includes(file.type || "application/octet-stream");
  if (!hasAllowedExtension && !hasAllowedMime) {
    return NextResponse.json(
      { error: "Format non autorisé. Utilisez un CV PDF texte, DOCX, TXT ou MD." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeTeacherCv({
      buffer,
      filename,
      mimeType: file.type || "application/octet-stream",
    });
    return NextResponse.json({
      ...analysis,
      filename,
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
