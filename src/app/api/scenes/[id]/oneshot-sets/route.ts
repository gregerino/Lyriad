import { NextResponse } from "next/server";
import { z } from "zod";
import { createOneShotSet, sceneExists } from "@/lib/db/queries";

const createSetSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id: sceneId } = await params;
  if (!(await sceneExists(sceneId))) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid one-shot set payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const set = await createOneShotSet(sceneId, parsed.data.name);
  return NextResponse.json({ set }, { status: 201 });
}
