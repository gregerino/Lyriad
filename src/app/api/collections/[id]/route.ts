import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCollection, getCollection, updateCollection } from "@/lib/db/queries";

const updateCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(60).nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "No collection changes to apply",
  });

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }
  return NextResponse.json({ collection });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid collection payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const collection = await updateCollection(id, parsed.data);
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }
  return NextResponse.json({ collection });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const deleted = await deleteCollection(id);
  if (!deleted) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
