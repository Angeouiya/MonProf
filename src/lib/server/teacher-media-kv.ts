import { getCloudflareContext } from "@opennextjs/cloudflare";

type TeacherMediaKv = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: { metadata?: Record<string, string | number> },
  ): Promise<void>;
};

export async function persistTeacherMediaToKv(
  mediaId: string,
  data: Uint8Array,
  contentType = "image/webp",
) {
  const namespace = getTeacherMediaNamespace();
  if (!namespace) {
    if (isCloudflareProduction()) {
      throw new Error("Le stockage média Cloudflare KV n'est pas configuré.");
    }
    return false;
  }

  await namespace.put(`teacher-photos/${mediaId}`, data, {
    metadata: { contentType, size: data.byteLength },
  });
  return true;
}

function getTeacherMediaNamespace() {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { TEACHER_MEDIA_KV?: TeacherMediaKv }).TEACHER_MEDIA_KV ?? null;
  } catch {
    return null;
  }
}

function isCloudflareProduction() {
  return process.env.APP_DEPLOYMENT_PLATFORM === "cloudflare"
    && process.env.APP_DEPLOYMENT_ENV === "production";
}
