import { db } from "@/lib/db";
import { persistTeacherMediaToKv } from "@/lib/server/teacher-media-kv";
import type { TeacherImageContentType } from "@/lib/server/teacher-image-file";

export async function storeTeacherMedia(input: {
  bytes: Uint8Array;
  contentType: TeacherImageContentType;
  width: number;
  height: number;
}) {
  const storedBytes: Uint8Array<ArrayBuffer> = new Uint8Array(input.bytes.byteLength);
  storedBytes.set(input.bytes);
  const asset = await db.teacherPhotoAsset.create({
    data: {
      contentType: input.contentType,
      data: storedBytes,
      size: storedBytes.byteLength,
      width: input.width,
      height: input.height,
    },
    select: { id: true, size: true, width: true, height: true, contentType: true },
  });

  try {
    await persistTeacherMediaToKv(asset.id, storedBytes, input.contentType);
    return asset;
  } catch (error) {
    await db.teacherPhotoAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
    throw error;
  }
}
