import { NextResponse } from "next/server";
import { z } from "zod";
import { collectionExists, setCollectionMembers } from "@/lib/db/queries";

const updateMembersSchema = z.object({
  add: z.array(z.string().uuid()).optional(),
  remove: z.array(z.string().uuid()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateMembersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid members payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (!parsed.data.add?.length && !parsed.data.remove?.length) {
    return NextResponse.json({ error: "No member changes to apply" }, { status: 400 });
  }

  if (!(await collectionExists(id))) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  await setCollectionMembers(id, parsed.data);
  return NextResponse.json({ success: true });
}
