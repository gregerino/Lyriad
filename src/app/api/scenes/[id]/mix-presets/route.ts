import { NextResponse } from "next/server";
import { z } from "zod";
import { createMixPreset, listMixPresets, sceneExists } from "@/lib/db/queries";

const createMixPresetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  masterVolume: z.number().min(0).max(1),
  groupVolumes: z.record(z.string(), z.number().min(0).max(1)),
  slotVolumes: z.record(z.string(), z.number().min(0).max(1)),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: sceneId } = await params;
  if (!(await sceneExists(sceneId))) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }
  const presets = await listMixPresets(sceneId);
  return NextResponse.json({ presets });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: sceneId } = await params;
  if (!(await sceneExists(sceneId))) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createMixPresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mix preset payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const preset = await createMixPreset(sceneId, parsed.data);
  return NextResponse.json({ preset }, { status: 201 });
}
