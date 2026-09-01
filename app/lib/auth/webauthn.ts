import { headers } from "next/headers";

export function getWebAuthnRelyingParty() {
  return {
    name: process.env.PASSKEY_RP_NAME ?? "Finance",
  };
}

export async function getWebAuthnHost() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").trim();
  // Strip port for rpID
  const rpID = host.replace(/:\d+$/, "");
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() || "https";
  const origin = `${proto}://${rpID}`;
  return { host, rpID, origin };
}

export function toBase64Url(buf: Uint8Array) {
  return Buffer.from(buf).toString("base64url");
}

export function fromBase64Url(s: string) {
  return Buffer.from(s, "base64url");
}

