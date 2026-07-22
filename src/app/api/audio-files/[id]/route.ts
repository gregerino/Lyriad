import { NextResponse } from "next/server";
import { deleteAudioFile } from "@/lib/db/queries";
import { deleteObject } from "@/lib/storage";

type RouteParams = { params: Promise<{ id: string }> };

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
