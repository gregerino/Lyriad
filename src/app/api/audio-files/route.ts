import { NextResponse } from "next/server";
import { z } from "zod";
import { getCanonicalMimeType, MAX_AUDIO_UPLOAD_BYTES } from "@/lib/audio/limits";
import { createAudioFile, listAudioFiles } from "@/lib/db/queries";
import { createDownloadUrl } from "@/lib/storage";
import type { AudioFileWithPlaybackUrl } from "@/types/domain";

const registerSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  r2Key: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  category: z.string().trim().max(100).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export async function GET() {
  const files = await listAudioFiles();
  const audioFiles: AudioFileWithPlaybackUrl[] = await Promise.all(
    files.map(async (file) => ({
      ...file,
      playbackUrl: await createDownloadUrl(file.r2Key),
    }))
  );
  return NextResponse.json({ audioFiles });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid audio file payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const canonicalMimeType = getCanonicalMimeType(parsed.data.filename);
  if (!canonicalMimeType) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 400 });
  }

  if (parsed.data.sizeBytes > MAX_AUDIO_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds maximum allowed size of ${MAX_AUDIO_UPLOAD_BYTES} bytes` },
      { status: 400 }
    );
  }

  const audioFile = await createAudioFile({
    filename: parsed.data.filename,
    sizeBytes: parsed.data.sizeBytes,
    r2Key: parsed.data.r2Key,
    mimeType: canonicalMimeType,
    category: parsed.data.category ?? null,
    tags: parsed.data.tags ?? [],
  });

  return NextResponse.json({ audioFile }, { status: 201 });
}
