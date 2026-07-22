import { NextResponse } from "next/server";
import { z } from "zod";
import { buildObjectKey, createUploadUrl } from "@/lib/storage";

const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
]);

const requestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1),
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

  if (!ALLOWED_MIME_TYPES.has(parsed.data.contentType)) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 400 });
  }

  const r2Key = buildObjectKey(parsed.data.filename);
  const { url, expiresInSeconds } = await createUploadUrl(r2Key, parsed.data.contentType);

  return NextResponse.json({ uploadUrl: url, r2Key, expiresInSeconds });
}
