import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyEnvPassword,
} from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Lösenord krävs" }, { status: 400 });
  }

  let valid: boolean;
  try {
    valid = verifyEnvPassword(parsed.data.password);
  } catch {
    return NextResponse.json(
      { error: "Servern är inte konfigurerad för autentisering" },
      { status: 500 }
    );
  }

  if (!valid) {
    return NextResponse.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
  return response;
}
