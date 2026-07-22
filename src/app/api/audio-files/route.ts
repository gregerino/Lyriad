import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIO_CATEGORIES, getCanonicalMimeType, MAX_AUDIO_UPLOAD_BYTES } from "@/lib/audio/limits";
import {
  bulkUpdateAudioFileTags,
  createAudioFile,
  listAudioFileCollectionIds,
  listAudioFiles,
} from "@/lib/db/queries";
import { createDownloadUrl } from "@/lib/storage";
import type { AudioFileWithMeta } from "@/types/domain";

const registerSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  r2Key: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  category: z.enum(AUDIO_CATEGORIES).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

const bulkUpdateTagsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  add: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  remove: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export async function GET() {
  const [files, collectionIdsByFile] = await Promise.all([
    listAudioFiles(),
    listAudioFileCollectionIds(),
  ]);
  const audioFiles: AudioFileWithMeta[] = await Promise.all(
    files.map(async (file) => ({
      ...file,
      playbackUrl: await createDownloadUrl(file.r2Key),
      collectionIds: collectionIdsByFile.get(file.id) ?? [],
    }))
  );
  return NextResponse.json({ audioFiles });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bulkUpdateTagsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid bulk update payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (!parsed.data.add?.length && !parsed.data.remove?.length) {
    return NextResponse.json({ error: "No tag changes to apply" }, { status: 400 });
  }

  const audioFiles = await bulkUpdateAudioFileTags(parsed.data.ids, {
    add: parsed.data.add,
    remove: parsed.data.remove,
  });
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
