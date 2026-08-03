import { NextResponse } from "next/server";
import { z } from "zod";
import { createCollection, listCollections } from "@/lib/db/queries";

const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(60).nullable().optional(),
});

export async function GET() {
  const collections = await listCollections();
  return NextResponse.json({ collections });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid collection payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const collection = await createCollection({
    name: parsed.data.name,
    category: parsed.data.category ?? null,
  });
  return NextResponse.json({ collection }, { status: 201 });
}
