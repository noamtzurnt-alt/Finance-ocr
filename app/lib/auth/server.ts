import { cookies } from "next/headers";
import { isAllowedAccountEmail } from "@/app/lib/auth/accounts";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/app/lib/auth/session";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  return await verifySessionToken(token, secret);
}

export async function requireUser() {
  const session = await getSession();
  const userId = session?.sub;
  const email = session?.email ?? "";
  if (!userId || (email && !isAllowedAccountEmail(email))) return null;

  // Avoid hitting the DB on every request just to load the user.
  // The session token is already verified and contains the email.
  return {
    id: userId,
    email,
  };
}
