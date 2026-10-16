import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days (app is Face ID gated natively)

export type SessionPayload = {
  sub: string; // userId
  email: string;
};

function getKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(getKey(secret));
}

export async function verifySessionToken(token: string, secret: string) {
  try {
    const { payload } = await jwtVerify(token, getKey(secret), {
      algorithms: ["HS256"],
    });
    return payload as unknown as Partial<SessionPayload>;
  } catch {
    return null;
  }
}


