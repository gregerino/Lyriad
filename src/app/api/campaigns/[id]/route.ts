import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCampaign, updateCampaign } from "@/lib/db/queries";

const updateCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    position: z.number().int().min(0).max(1000).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "No campaign changes to apply",
  });

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid campaign payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const campaign = await updateCampaign(id, parsed.data);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}

/** The campaign's scenes are kept — they fall back to "no campaign". */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const deleted = await deleteCampaign(id);
  if (!deleted) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
