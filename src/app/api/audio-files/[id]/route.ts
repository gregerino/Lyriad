import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIO_CATEGORIES } from "@/lib/audio/limits";
import { deleteAudioFile, updateAudioFile } from "@/lib/db/queries";
import { deleteObject } from "@/lib/storage";

const updateAudioFileSchema = z.object({
  category: z.enum(AUDIO_CATEGORIES).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateAudioFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid audio file payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const audioFile = await updateAudioFile(id, parsed.data);
  if (!audioFile) {
    return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
  }
  return NextResponse.json({ audioFile });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const deleted = await deleteAudioFile(id);
  if (!deleted) {
    return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
  }

  try {
    await deleteObject(deleted.r2Key);
  } catch (error) {
    console.error(`Failed to delete R2 object ${deleted.r2Key}:`, error);
  }

  return NextResponse.json({ success: true });
}
