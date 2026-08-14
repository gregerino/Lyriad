import { NextResponse } from "next/server";
import { z } from "zod";
import {
  countOneShotSets,
  deleteOneShotSet,
  getOneShotSet,
  sceneExists,
  updateOneShotSet,
} from "@/lib/db/queries";

const updateSetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  position: z.number().int().min(0).max(100).optional(),
});

type RouteParams = { params: Promise<{ id: string; setId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: sceneId, setId } = await params;
  if (!(await sceneExists(sceneId))) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid one-shot set payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const set = await updateOneShotSet(sceneId, setId, parsed.data);
  if (!set) {
    return NextResponse.json({ error: "One-shot set not found" }, { status: 404 });
  }
  return NextResponse.json({ set });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: sceneId, setId } = await params;
  if (!(await sceneExists(sceneId))) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  if (!(await getOneShotSet(sceneId, setId))) {
    return NextResponse.json({ error: "One-shot set not found" }, { status: 404 });
  }

  // A scene without a set has nowhere to put a one-shot at all, and the pad grid
  // would have no tab to show — so the last one stays.
  if ((await countOneShotSets(sceneId)) <= 1) {
    return NextResponse.json(
      { error: "Scenen måste ha minst ett one-shot-set" },
      { status: 409 }
    );
  }

  await deleteOneShotSet(sceneId, setId);
  return NextResponse.json({ success: true });
}
