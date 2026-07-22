import { NextResponse } from "next/server";
import { decodeLocalFileParam, readLocalObject } from "@/lib/storage";

type RouteParams = { params: Promise<{ key: string }> };

/** Dev-only stand-in for a presigned R2 GET URL; serves files from local disk. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { key: encodedKey } = await params;

  let key: string;
  try {
    key = decodeLocalFileParam(encodedKey);
  } catch {
    return NextResponse.json({ error: "Invalid file reference" }, { status: 400 });
  }

  const object = await readLocalObject(key);
  if (!object) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(object.data), {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.data.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
