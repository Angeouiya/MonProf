import fs from "node:fs";

const checks = [];
const uploadRoute = read("src/app/api/admin/uploads/teacher-photo/route.ts");
const photoRoute = read("src/app/api/teacher-photos/[id]/route.ts");
const teacherForm = read("src/components/admin/teacher-form.tsx");
const clientValidation = read("src/lib/teacher-photo.ts");
const serverValidation = read("src/lib/server/teacher-photo.ts");
const schema = read("prisma/schema.prisma");

check("Teacher uploads never write into the read-only Vercel filesystem", !/writeFile|mkdir|public["',)]\s*,\s*["']uploads/.test(uploadRoute));
check("Teacher uploads are optimized to WEBP", /sharp\(input/.test(uploadRoute) && /\.webp\(\{ quality: 82/.test(uploadRoute));
check("Teacher uploads persist in the database", /db\.teacherPhotoAsset\.create/.test(uploadRoute));
check("Teacher photo responses always expose JSON errors", /\[teacher-photo-upload\]/.test(uploadRoute) && /NextResponse\.json/.test(uploadRoute));
check("Managed teacher photos are served with immutable cache", /Cache-Control/.test(photoRoute) && /immutable/.test(photoRoute));
check("Teacher form tolerates empty or non-JSON infrastructure errors", /const responseText = await res\.text\(\)/.test(teacherForm));
check("Teacher form keeps upload payload below Vercel request limits", /MAX_PHOTO_SIZE = 4 \* 1024 \* 1024/.test(teacherForm));
check("Client and server validators accept managed teacher photo URLs", /api\\\/teacher-photos/.test(clientValidation) && /api\\\/teacher-photos/.test(serverValidation));
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
