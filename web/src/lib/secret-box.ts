import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { UserError } from "./errors";

const VERSION = "v1";

function secretKey() {
  const secret = process.env.AI_KEY_SECRET;
  if (!secret || secret.length < 32) {
    throw new UserError("Saving AI keys isn't set up on this server yet (AI_KEY_SECRET is missing).");
  }
  // Any long random string works; hashing turns it into exactly 32 bytes for AES-256.
  return createHash("sha256").update(secret).digest();
}

/** Encrypts a secret for storage (AES-256-GCM). */
export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64"))).join(":");
}

export function open(sealed: string) {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unrecognized sealed value.");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
