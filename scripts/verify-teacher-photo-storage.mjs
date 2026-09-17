import fs from "node:fs";

const checks = [];
const uploadRoute = read("src/app/api/admin/uploads/teacher-photo/route.ts");
const photoRoute = read("src/app/api/teacher-photos/[id]/route.ts");
const teacherForm = read("src/components/admin/teacher-form.tsx");
const clientValidation = read("src/lib/teacher-photo.ts");
const serverValidation = read("src/lib/server/teacher-photo.ts");
const professorImage = read("src/components/shared/professor-image.tsx");
const teacherCard = read("src/components/shared/teacher-card.tsx");
const teacherProfile = read("src/app/professeurs/[id]/page.tsx");
const professorMediaRoute = read("src/app/api/professor/profile-media/route.ts");
const mediaKv = read("src/lib/server/teacher-media-kv.ts");
const mediaStore = read("src/lib/server/teacher-media-store.ts");
const imageInspection = read("src/lib/server/teacher-image-file.ts");
const clientPreparation = read("src/lib/client/teacher-image-upload.ts");
const cloudflareWorker = read("cloudflare-worker.ts");
const schema = read("prisma/schema.prisma");

check("Teacher uploads never write into the read-only Vercel filesystem", !/writeFile|mkdir|public["',)]\s*,\s*["']uploads/.test(uploadRoute));
check("Teacher uploads avoid native Sharp work inside Cloudflare requests", !/from ["']sharp["']/.test(uploadRoute) && !/from ["']sharp["']/.test(professorMediaRoute));
check("Teacher uploads are optimized in the browser before transfer", /prepareTeacherImageUpload/.test(teacherForm) && /canvas\.toBlob/.test(clientPreparation) && /image\/webp/.test(clientPreparation));
check("Teacher upload bytes are inspected server-side", /inspectTeacherImage/.test(uploadRoute) && /inspectTeacherImage/.test(professorMediaRoute) && /readJpegDimensions/.test(imageInspection));
check("Teacher uploads persist through the atomic media store", /storeTeacherMedia/.test(uploadRoute) && /storeTeacherMedia/.test(professorMediaRoute) && /db\.teacherPhotoAsset\.create/.test(mediaStore));
check("Teacher uploads are copied to Cloudflare KV", /persistTeacherMediaToKv\(asset\.id/.test(mediaStore));
check("Failed KV copies remove the incomplete database asset", /teacherPhotoAsset\.delete/.test(mediaStore));
check("Cloudflare KV media keys are immutable and scoped", /teacher-photos\/\$\{mediaId\}/.test(mediaKv) && /teacherMediaIdFromPath/.test(cloudflareWorker));
check("Cloudflare serves teacher media before Next and PostgreSQL", /serveTeacherMediaFromKv\(request, env\)/.test(cloudflareWorker) && /x-competence-media/.test(cloudflareWorker) && /getWithMetadata/.test(cloudflareWorker));
check("Teacher photo responses always expose JSON errors", /\[teacher-photo-upload\]/.test(uploadRoute) && /NextResponse\.json/.test(uploadRoute));
check("Managed teacher photos are served with immutable cache", /Cache-Control/.test(photoRoute) && /immutable/.test(photoRoute));
check("Teacher form tolerates empty or non-JSON infrastructure errors", /const responseText = await res\.text\(\)/.test(teacherForm));
check("Teacher form keeps upload payload below infrastructure request limits", /MAX_TEACHER_UPLOAD_SIZE = 4 \* 1024 \* 1024/.test(clientPreparation));
check("Client and server validators accept managed teacher photo URLs", /api\\\/teacher-photos/.test(clientValidation) && /api\\\/teacher-photos/.test(serverValidation));
check("Managed database photos bypass the unavailable Cloudflare Next image optimizer", /unoptimized=\{isManagedMedia\}/.test(professorImage));
check("Managed custom covers bypass the unavailable Cloudflare Next image optimizer", /unoptimized=\{isManagedTeacherMediaUrl\(cover\.url\)\}/.test(teacherCard) && /unoptimized=\{isManagedTeacherMediaUrl\(resolvedCover\.url\)\}/.test(teacherProfile));
check("Prisma schema includes persistent teacher photo bytes", /model TeacherPhotoAsset[\s\S]*?data\s+Bytes/.test(schema));

for (const result of checks) {
  console.log(`${result.ok ? "OK" : "FAIL"} ${result.label}`);
}

const failed = checks.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(`FAIL Teacher photo storage verification: ${failed.length} blocking issue(s).`);
  process.exitCode = 1;
} else {
  console.log("OK Teacher photo storage verification passed.");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function check(label, ok) {
  checks.push({ label, ok });
}
