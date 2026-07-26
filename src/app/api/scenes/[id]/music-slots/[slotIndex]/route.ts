import { NextResponse } from "next/server";
import { z } from "zod";
import { getAudioFile, getMusicSlot, sceneExists, updateMusicSlot } from "@/lib/db/queries";

const MIN_SLOT = 1;
const MAX_SLOT = 10;

const patchSchema = z.object({
  audioFileId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(100).nullable().optional(),
  volume: z.number().min(0).max(1).optional(),
  loop: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ id: string; slotIndex: string }> };

function parseSlotIndex(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (value < MIN_SLOT || value > MAX_SLOT) return null;
  return value;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: sceneId, slotIndex: rawSlotIndex } = await params;

  if (!(await sceneExists(sceneId))) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  const slotIndex = parseSlotIndex(rawSlotIndex);
  if (slotIndex === null) {
    return NextResponse.json(
      { error: `slotIndex must be an integer between ${MIN_SLOT} and ${MAX_SLOT}` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid slot payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const current = await getMusicSlot(sceneId, slotIndex);
  if (!current) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  const assigningAudioFile =
    Object.prototype.hasOwnProperty.call(parsed.data, "audioFileId") &&
    parsed.data.audioFileId !== null;

  if (assigningAudioFile && current.audioFileId !== null) {
    return NextResponse.json(
      { error: "Slot is already occupied; clear it before assigning a new file" },
      { status: 409 }
    );
  }

  if (assigningAudioFile) {
    const audioFile = await getAudioFile(parsed.data.audioFileId as string);
    if (!audioFile) {
      return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
    }
  }

  const slot = await updateMusicSlot(sceneId, slotIndex, parsed.data);

  return NextResponse.json({ slot });
}
