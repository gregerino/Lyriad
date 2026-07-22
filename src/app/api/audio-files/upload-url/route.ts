import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ALLOWED_AUDIO_EXTENSIONS,
  getCanonicalMimeType,
  MAX_AUDIO_UPLOAD_BYTES,
} from "@/lib/audio/limits";
import { buildObjectKey, createUploadUrl } from "@/lib/storage";

const requestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid upload request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const mimeType = getCanonicalMimeType(parsed.data.filename);
  if (!mimeType) {
    return NextResponse.json(
      { error: `Unsupported audio type. Allowed: ${ALLOWED_AUDIO_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }

  if (parsed.data.sizeBytes > MAX_AUDIO_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds maximum allowed size of ${MAX_AUDIO_UPLOAD_BYTES} bytes` },
      { status: 400 }
    );
  }

  const r2Key = buildObjectKey(parsed.data.filename);
  const { url, expiresInSeconds } = await createUploadUrl(
    r2Key,
    mimeType,
    parsed.data.sizeBytes
  );

  return NextResponse.json({ uploadUrl: url, r2Key, mimeType, expiresInSeconds });
}
