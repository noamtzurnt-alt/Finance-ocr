import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Stateless WebAuthn challenges: issued inside the page render so the client can
 * open Face ID without a separate options round trip (cold start). Valid for
 * CHALLENGE_TTL_MS; the cookie-based challenge from the options route still works.
 */
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const TS_BYTES = 8;
const NONCE_BYTES = 16;
const MAC_BYTES = 32;

function mac(secret: string, data: Buffer) {
  return createHmac("sha256", secret).update("webauthn-challenge:").update(data).digest();
}

export function createSignedChallenge(secret: string, now = Date.now()): string {
  const head = Buffer.alloc(TS_BYTES + NONCE_BYTES);
  head.writeBigUInt64BE(BigInt(now), 0);
  randomBytes(NONCE_BYTES).copy(head, TS_BYTES);
  return Buffer.concat([head, mac(secret, head)]).toString("base64url");
}

export function isValidSignedChallenge(challenge: string, secret: string, now = Date.now()): boolean {
  let raw: Buffer;
  try {
    raw = Buffer.from(challenge, "base64url");
  } catch {
    return false;
  }
  if (raw.length !== TS_BYTES + NONCE_BYTES + MAC_BYTES) return false;
  const head = raw.subarray(0, TS_BYTES + NONCE_BYTES);
  const given = raw.subarray(TS_BYTES + NONCE_BYTES);
  if (!timingSafeEqual(given, mac(secret, head))) return false;
  const issued = Number(head.readBigUInt64BE(0));
  return now - issued >= -60_000 && now - issued <= CHALLENGE_TTL_MS;
}
