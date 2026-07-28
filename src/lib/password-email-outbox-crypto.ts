import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "crypto";

const OUTBOX_KEY_SALT = Buffer.from("competence-password-email-outbox-v1", "utf8");
const OUTBOX_KEY_CONTEXT = Buffer.from("aes-256-gcm", "utf8");

export type EncryptedPasswordEmailPayload = {
  payloadCiphertext: string;
  payloadIv: string;
  payloadAuthTag: string;
};

export function passwordEmailIdentifier(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function encryptPasswordEmailPayload(
  payload: unknown,
  secret: string,
  associatedData: string,
): EncryptedPasswordEmailPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveOutboxKey(secret), iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return {
    payloadCiphertext: ciphertext.toString("base64url"),
    payloadIv: iv.toString("base64url"),
    payloadAuthTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptPasswordEmailPayload<T>(
  encrypted: EncryptedPasswordEmailPayload,
  secret: string,
  associatedData: string,
): T {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveOutboxKey(secret),
    Buffer.from(encrypted.payloadIv, "base64url"),
  );
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(Buffer.from(encrypted.payloadAuthTag, "base64url"));
  const cleartext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.payloadCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(cleartext) as T;
}

function deriveOutboxKey(secret: string) {
  if (!secret.trim()) throw new Error("PASSWORD_EMAIL_OUTBOX_SECRET_MISSING");
  return Buffer.from(hkdfSync("sha256", secret, OUTBOX_KEY_SALT, OUTBOX_KEY_CONTEXT, 32));
}
