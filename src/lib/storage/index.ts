import { randomUUID } from "node:crypto";
import * as local from "./local";
import * as r2 from "./r2";

/** Unique, collision-free object key derived from the original filename. */
export function buildObjectKey(filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `audio/${randomUUID()}-${safeName}`;
}

/**
 * Storage backend is picked automatically: real R2 when R2_ACCOUNT_ID is
 * configured, otherwise local disk so development doesn't need any cloud
 * dependency. See ARCHITECTURE.md §4.
 */
export async function createUploadUrl(
  key: string,
  contentType: string,
  maxBytes: number
): Promise<{ url: string; expiresInSeconds: number }> {
  if (r2.isR2Configured()) {
    return r2.createUploadUrl(key, contentType);
  }
  return local.createUploadUrl(key, maxBytes);
}

export async function createDownloadUrl(key: string): Promise<string> {
  if (r2.isR2Configured()) {
    return r2.createDownloadUrl(key);
  }
  return local.createDownloadUrl(key);
}

export async function deleteObject(key: string): Promise<void> {
  if (r2.isR2Configured()) {
    return r2.deleteObject(key);
  }
  return local.deleteObject(key);
}

export { isR2Configured } from "./r2";
export { decodeLocalFileParam, readObject as readLocalObject, verifyUploadToken, writeObject as writeLocalObject } from "./local";
