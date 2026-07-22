import { NextResponse } from "next/server";
import { verifyUploadToken, writeLocalObject } from "@/lib/storage";

type RouteParams = { params: Promise<{ token: string }> };

/**
 * Dev-only stand-in for a presigned R2 PUT URL: writes the request body
 * straight to local disk. Only reachable when the local storage driver is
 * active (no R2_ACCOUNT_ID configured) — see src/lib/storage/index.ts.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { token } = await params;

  const payload = await verifyUploadToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Upload URL is invalid or expired" }, { status: 403 });
  }

  const data = await request.arrayBuffer();

  try {
    await writeLocalObject(payload.key, payload.maxBytes, data);
  } catch {
    return NextResponse.json({ error: "File exceeds maximum allowed size" }, { status: 413 });
  }

  return NextResponse.json({ success: true });
}
