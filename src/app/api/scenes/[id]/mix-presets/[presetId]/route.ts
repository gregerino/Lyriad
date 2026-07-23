import { NextResponse } from "next/server";
import { deleteMixPreset } from "@/lib/db/queries";

type RouteParams = { params: Promise<{ id: string; presetId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: sceneId, presetId } = await params;
  const deleted = await deleteMixPreset(sceneId, presetId);
  if (!deleted) {
    return NextResponse.json({ error: "Mix preset not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
