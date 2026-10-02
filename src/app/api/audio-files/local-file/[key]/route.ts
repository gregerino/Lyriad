import { NextResponse } from "next/server";
import { decodeLocalFileParam, readLocalObject } from "@/lib/storage";

type RouteParams = { params: Promise<{ key: string }> };

/**
 * Dev-only stand-in for a presigned R2 GET URL; serves files from local disk.
 *
 * Answers byte-range requests the way R2 does. Without them a media element
 * can't seek, and that includes the seek back to 0 that `loop` depends on: a
 * looping track would simply stop at its end.
 */
export async function GET(request: Request, { params }: RouteParams) {
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

  const size = object.data.byteLength;
  const baseHeaders = {
    "Content-Type": object.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };

  const range = parseRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    return new NextResponse(null, {
      status: 416,
      headers: { ...baseHeaders, "Content-Range": `bytes */${size}` },
    });
  }
  if (range) {
    const { start, end } = range;
    return new NextResponse(new Uint8Array(object.data.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  return new NextResponse(new Uint8Array(object.data), {
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}

/**
 * Reads a single `bytes=` range (all a media element ever asks for). Anything
 * malformed or multi-range is ignored, which per spec means sending the whole
 * file.
 */
function parseRange(
  header: string | null,
  size: number
): { start: number; end: number } | "unsatisfiable" | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  let start: number;
  let end: number;
  if (rawStart === "") {
    // Suffix form: the last N bytes.
    start = Math.max(0, size - Number(rawEnd));
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}
