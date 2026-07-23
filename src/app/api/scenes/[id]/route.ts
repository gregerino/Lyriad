import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteScene, getSceneWithSlots, updateScene } from "@/lib/db/queries";

const updateSceneSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  favorite: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const scene = await getSceneWithSlots(id);
  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }
  return NextResponse.json({ scene });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSceneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid scene payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const scene = await updateScene(id, parsed.data);
  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }
  return NextResponse.json({ scene });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const deleted = await deleteScene(id);
  if (!deleted) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
