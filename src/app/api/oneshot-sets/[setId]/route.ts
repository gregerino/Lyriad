import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteOneShotSet, updateOneShotSet } from "@/lib/db/queries";

const updateSetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  /** Null files the set under "Utan grupp"; a group with no sets left stops existing. */
  groupName: z.string().trim().min(1).max(50).nullable().optional(),
  position: z.number().int().min(0).max(100).optional(),
});

type RouteParams = { params: Promise<{ setId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { setId } = await params;

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

  const set = await updateOneShotSet(setId, parsed.data);
  if (!set) {
    return NextResponse.json({ error: "One-shot set not found" }, { status: 404 });
  }
  return NextResponse.json({ set });
}

/**
 * Sets belong to no scene, so there is no last one to protect: deleting them all
 * leaves the pad grid offering to make the first one, same as a fresh install.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { setId } = await params;

  if (!(await deleteOneShotSet(setId))) {
    return NextResponse.json({ error: "One-shot set not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
