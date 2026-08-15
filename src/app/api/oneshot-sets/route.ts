import { NextResponse } from "next/server";
import { z } from "zod";
import { createOneShotSet, listOneShotSets } from "@/lib/db/queries";

const createSetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** A set made while a group is showing lands in that group. */
  groupName: z.string().trim().min(1).max(50).nullable().optional(),
});

export async function GET() {
  const sets = await listOneShotSets();
  return NextResponse.json({ sets });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid one-shot set payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const set = await createOneShotSet(parsed.data.name, parsed.data.groupName ?? null);
  return NextResponse.json({ set }, { status: 201 });
}
