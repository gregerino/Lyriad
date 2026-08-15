import { NextResponse } from "next/server";
import { z } from "zod";
import { createCampaign, listCampaigns } from "@/lib/db/queries";

const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET() {
  const campaigns = await listCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid campaign payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const campaign = await createCampaign({ name: parsed.data.name });
  return NextResponse.json({ campaign }, { status: 201 });
}
