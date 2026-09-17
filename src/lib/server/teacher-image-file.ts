export const TEACHER_IMAGE_MAX_PIXELS = 40_000_000;

export type TeacherImageContentType = "image/jpeg" | "image/png" | "image/webp";

export type TeacherImageInspection =
  | {
    ok: true;
    contentType: TeacherImageContentType;
    width: number;
    height: number;
  }
  | {
    ok: false;
    error: string;
  };

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
]);

export function inspectTeacherImage(
  bytes: Uint8Array,
  declaredContentType?: string,
): TeacherImageInspection {
  const detected = detectImage(bytes);
  if (!detected) {
    return { ok: false, error: "Le fichier ne semble pas être une image JPG, PNG ou WEBP valide." };
  }

  const declared = normalizeContentType(declaredContentType);
  if (declared && declared !== detected.contentType) {
    return { ok: false, error: "Le format annoncé ne correspond pas au contenu réel de l'image." };
  }

  const pixels = detected.width * detected.height;
  if (!Number.isSafeInteger(pixels) || pixels <= 0 || pixels > TEACHER_IMAGE_MAX_PIXELS) {
    return { ok: false, error: "Les dimensions de cette image sont trop importantes." };
  }

  return { ok: true, ...detected };
}

function normalizeContentType(value?: string): TeacherImageContentType | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp") {
    return normalized;
  }
  return null;
}

function detectImage(bytes: Uint8Array) {
  return readPngDimensions(bytes)
    ?? readJpegDimensions(bytes)
    ?? readWebpDimensions(bytes);
}

function readPngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 24
    || bytes[0] !== 0x89
    || bytes[1] !== 0x50
    || bytes[2] !== 0x4e
    || bytes[3] !== 0x47
    || bytes[4] !== 0x0d
    || bytes[5] !== 0x0a
    || bytes[6] !== 0x1a
    || bytes[7] !== 0x0a
  ) return null;

  const width = readUint32BigEndian(bytes, 16);
  const height = readUint32BigEndian(bytes, 20);
  return validDimensions(width, height) ? { contentType: "image/png" as const, width, height } : null;
}

function readJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;

    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 1 >= bytes.length) return null;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker) && segmentLength >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return validDimensions(width, height) ? { contentType: "image/jpeg" as const, width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 30
    || ascii(bytes, 0, 4) !== "RIFF"
    || ascii(bytes, 8, 12) !== "WEBP"
  ) return null;

  const chunkType = ascii(bytes, 12, 16);
  let width = 0;
  let height = 0;

  if (chunkType === "VP8X") {
    width = 1 + readUint24LittleEndian(bytes, 24);
    height = 1 + readUint24LittleEndian(bytes, 27);
  } else if (chunkType === "VP8L" && bytes[20] === 0x2f) {
    const packed = readUint32LittleEndian(bytes, 21);
    width = 1 + (packed & 0x3fff);
    height = 1 + ((packed >>> 14) & 0x3fff);
  } else if (
    chunkType === "VP8 "
    && bytes[23] === 0x9d
    && bytes[24] === 0x01
    && bytes[25] === 0x2a
  ) {
    width = ((bytes[27] << 8) | bytes[26]) & 0x3fff;
    height = ((bytes[29] << 8) | bytes[28]) & 0x3fff;
  }

  return validDimensions(width, height) ? { contentType: "image/webp" as const, width, height } : null;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] * 0x1000000)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3]
  ) >>> 0;
}

function validDimensions(width: number, height: number) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0;
}
