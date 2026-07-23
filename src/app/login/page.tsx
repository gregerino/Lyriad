import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginClient } from "@/components/auth/LoginClient";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (await verifySessionToken(token)) {
    redirect("/");
  }

  return <LoginClient />;
}
