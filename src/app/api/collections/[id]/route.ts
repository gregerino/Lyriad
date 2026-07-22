import { NextResponse } from "next/server";
import { deleteCollection } from "@/lib/db/queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const deleted = await deleteCollection(id);
  if (!deleted) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
