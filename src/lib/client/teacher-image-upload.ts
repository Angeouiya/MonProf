const MAX_SOURCE_SIZE = 16 * 1024 * 1024;
export const MAX_TEACHER_UPLOAD_SIZE = 4 * 1024 * 1024;
const SERVER_SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type UploadImageKind = "profile" | "cover";

export async function prepareTeacherImageUpload(file: File, kind: UploadImageKind) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Sélectionnez une vraie photo depuis votre appareil.");
  }
  if (file.size <= 0) throw new Error("La photo sélectionnée est vide.");
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("Photo trop lourde. Sélectionnez une image de moins de 16 Mo.");
  }

  try {
    const prepared = await renderForUpload(file, kind);
    if (prepared.size > MAX_TEACHER_UPLOAD_SIZE) {
      throw new Error("La photo reste trop lourde après optimisation. Choisissez une autre image.");
    }
    return prepared;
  } catch (error) {
    if (error instanceof Error && /trop lourde|vraie photo|vide/i.test(error.message)) throw error;
    if (SERVER_SUPPORTED_TYPES.has(file.type) && file.size <= MAX_TEACHER_UPLOAD_SIZE) return file;
    throw new Error("Cette image ne peut pas être lue. Utilisez une photo JPG, PNG ou WEBP.");
  }
}

async function renderForUpload(file: File, kind: UploadImageKind) {
  const source = await loadImage(file);
  try {
    const canvas = document.createElement("canvas");
    const geometry = kind === "cover"
      ? coverGeometry(source.width, source.height)
      : profileGeometry(source.width, source.height);
    canvas.width = geometry.canvasWidth;
    canvas.height = geometry.canvasHeight;

    const context = canvas.getContext("2d", { alpha: kind !== "cover" });
    if (!context) throw new Error("Canvas indisponible");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (kind === "cover") {
      context.fillStyle = "#111B4D";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(source.image, geometry.x, geometry.y, geometry.width, geometry.height);

    let blob = await canvasBlob(canvas, "image/webp", 0.84);
    if (blob.size > MAX_TEACHER_UPLOAD_SIZE) blob = await canvasBlob(canvas, "image/webp", 0.68);
    const extension = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp";
    const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "photo-professeur";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: Date.now() });
  } finally {
    source.close();
  }
}

async function loadImage(file: File): Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await image.decode();
  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(objectUrl),
  };
}

function profileGeometry(sourceWidth: number, sourceHeight: number) {
  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return { canvasWidth: width, canvasHeight: height, x: 0, y: 0, width, height };
}

function coverGeometry(sourceWidth: number, sourceHeight: number) {
  const canvasWidth = 1920;
  const canvasHeight = 640;
  const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return {
    canvasWidth,
    canvasHeight,
    x: Math.round((canvasWidth - width) / 2),
    y: Math.round((canvasHeight - height) / 2),
    width,
    height,
  };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || !SERVER_SUPPORTED_TYPES.has(blob.type)) {
        reject(new Error("Encodage image indisponible"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}
