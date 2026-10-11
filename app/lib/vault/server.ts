import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import type { VaultItemData } from "@/app/lib/vault/items";

/**
 * Vault items are encrypted at rest (AES-256-GCM) with a key derived from
 * VAULT_SECRET, falling back to AUTH_SECRET. Changing that secret makes
 * existing items unreadable.
 */
function vaultKey(): Buffer {
  const secret = process.env.VAULT_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return Buffer.from(hkdfSync("sha256", secret, "nf-vault", "nf-vault-item-v1", 32));
}

function encrypt(data: VaultItemData): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

function decrypt(blob: string): VaultItemData | null {
  try {
    const raw = Buffer.from(blob, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", vaultKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return itemDataSchema.parse(JSON.parse(plain));
  } catch {
    return null;
  }
}

export const itemDataSchema = z.object({
  v: z.literal(1),
  type: z.enum(["login", "card", "note", "other"]),
  title: z.string().trim().min(1).max(200),
  favorite: z.boolean().optional(),
  fields: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().max(200),
        value: z.string().max(20_000),
        kind: z.enum(["text", "email", "secret", "url", "multiline"]),
      }),
    )
    .max(60),
});

export type VaultItemDto = {
  id: string;
  updatedAt: string;
  folderId: string | null;
  deletedAt: string | null;
  data: VaultItemData;
};

const rowSelect = { id: true, data: true, updatedAt: true, folderId: true, deletedAt: true } as const;

function toDto(row: {
  id: string;
  data: string;
  updatedAt: Date;
  folderId: string | null;
  deletedAt: Date | null;
}): VaultItemDto | null {
  const data = decrypt(row.data);
  return data
    ? {
        id: row.id,
        updatedAt: row.updatedAt.toISOString(),
        folderId: row.folderId,
        deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
        data,
      }
    : null;
}

export async function listVaultItems(userId: string): Promise<VaultItemDto[]> {
  const rows = await prisma.vaultItem.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: rowSelect,
  });
  return rows.map(toDto).filter((x): x is VaultItemDto => x !== null);
}

export async function createVaultItem(userId: string, data: VaultItemData, folderId: string | null) {
  const row = await prisma.vaultItem.create({
    data: { userId, data: encrypt(data), folderId },
    select: rowSelect,
  });
  return toDto(row);
}

export async function updateVaultItem(
  userId: string,
  id: string,
  patch: { data?: VaultItemData; deleted?: boolean },
) {
  const res = await prisma.vaultItem.updateMany({
    where: { id, userId },
    data: {
      ...(patch.data ? { data: encrypt(patch.data) } : {}),
      ...(patch.deleted !== undefined ? { deletedAt: patch.deleted ? new Date() : null } : {}),
    },
  });
  if (res.count === 0) return null;
  const row = await prisma.vaultItem.findUniqueOrThrow({ where: { id }, select: rowSelect });
  return toDto(row);
}

export type VaultFolderDto = { id: string; name: string; createdAt: string };

export async function listVaultFolders(userId: string): Promise<VaultFolderDto[]> {
  const rows = await prisma.vaultFolder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, createdAt: true },
  });
  return rows.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt.toISOString() }));
}

export async function ownsVaultFolder(folderId: string, userId: string) {
  const f = await prisma.vaultFolder.findFirst({ where: { id: folderId, userId }, select: { id: true } });
  return Boolean(f);
}
