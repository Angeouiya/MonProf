import assert from "node:assert/strict";
import sharp from "sharp";
import { inspectTeacherImage } from "@/lib/server/teacher-image-file";

const formats = [
  { contentType: "image/jpeg", encode: (image: ReturnType<typeof sharp>) => image.jpeg({ quality: 80 }) },
  { contentType: "image/png", encode: (image: ReturnType<typeof sharp>) => image.png() },
  { contentType: "image/webp", encode: (image: ReturnType<typeof sharp>) => image.webp({ quality: 80 }) },
] as const;

for (const format of formats) {
  const data = await format.encode(sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 17, g: 27, b: 77 },
    },
  })).toBuffer();
  const inspection = inspectTeacherImage(new Uint8Array(data), format.contentType);
  assert.equal(inspection.ok, true, `${format.contentType} doit être accepté`);
  if (inspection.ok) {
    assert.equal(inspection.contentType, format.contentType);
    assert.equal(inspection.width, 640);
    assert.equal(inspection.height, 480);
  }
}

const invalid = inspectTeacherImage(new Uint8Array([1, 2, 3, 4]), "image/png");
assert.equal(invalid.ok, false, "un faux fichier image doit être refusé");

const jpeg = await sharp({
  create: {
    width: 320,
    height: 320,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
}).jpeg().toBuffer();
const mismatch = inspectTeacherImage(new Uint8Array(jpeg), "image/png");
assert.equal(mismatch.ok, false, "un MIME mensonger doit être refusé");

console.log("OK Teacher image upload parser accepts real JPG, PNG and WEBP files.");
