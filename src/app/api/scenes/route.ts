import { NextResponse } from "next/server";
import { z } from "zod";
import { createScene, listScenes } from "@/lib/db/queries";

const createSceneSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const scenes = await listScenes();
  return NextResponse.json({ scenes });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSceneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid scene payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const scene = await createScene({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    campaignId: parsed.data.campaignId ?? null,
  });

  return NextResponse.json({ scene }, { status: 201 });
}
