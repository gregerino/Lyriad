import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { jwtVerify, SignJWT } from "jose";
import { getCanonicalMimeType } from "@/lib/audio/limits";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

function getStorageRoot(): string {
  const dir = process.env.LOCAL_STORAGE_DIR || ".local-storage";
  return path.resolve(process.cwd(), dir);
}

function getTokenSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set");
  return new TextEncoder().encode(secret);
}

/** Resolves a storage key to an absolute path, refusing to escape the storage root. */
function resolveObjectPath(key: string): string {
  const root = getStorageRoot();
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to resolve object key outside storage root: ${key}`);
  }
  return resolved;
}

export type LocalUploadTokenPayload = {
  key: string;
  maxBytes: number;
};

export async function createUploadUrl(
  key: string,
  maxBytes: number
): Promise<{ url: string; expiresInSeconds: number }> {
  const token = await new SignJWT({ key, maxBytes } satisfies LocalUploadTokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${UPLOAD_URL_TTL_SECONDS}s`)
    .sign(getTokenSecret());

  return {
    url: `/api/audio-files/local-upload/${token}`,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  };
}

export async function verifyUploadToken(token: string): Promise<LocalUploadTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getTokenSecret());
    if (typeof payload.key !== "string" || typeof payload.maxBytes !== "number") return null;
    return { key: payload.key, maxBytes: payload.maxBytes };
  } catch {
    return null;
  }
}

export async function writeObject(key: string, maxBytes: number, data: ArrayBuffer): Promise<void> {
  if (data.byteLength > maxBytes) {
    throw new Error(`File exceeds maximum allowed size of ${maxBytes} bytes`);
  }
  const filePath = resolveObjectPath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Buffer.from(data));
}

export async function readObject(
  key: string
): Promise<{ data: Buffer; contentType: string } | null> {
  const filePath = resolveObjectPath(key);
  try {
    await stat(filePath);
  } catch {
    return null;
  }
  const data = await readFile(filePath);
  const contentType = getCanonicalMimeType(key) ?? "application/octet-stream";
  return { data, contentType };
}

/** Local dev stand-in for a presigned download URL — same-origin, auth-gated by the app's proxy. */
export async function createDownloadUrl(key: string): Promise<string> {
  return `/api/audio-files/local-file/${encodeURIComponent(Buffer.from(key).toString("base64url"))}`;
}

export function decodeLocalFileParam(param: string): string {
  return Buffer.from(param, "base64url").toString("utf8");
}

export async function deleteObject(key: string): Promise<void> {
  const filePath = resolveObjectPath(key);
  await rm(filePath, { force: true });
}
