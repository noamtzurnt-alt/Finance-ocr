import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { listVaultFolders, listVaultItems } from "@/app/lib/vault/server";
import { VAULT_SCOPE_COOKIE } from "@/app/lib/vault/items";
import VaultClient from "./ui/VaultClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "סיסמאות" };

export default async function VaultPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/vault");

  const [initial, folders, jar] = await Promise.all([
    listVaultItems(user.id),
    listVaultFolders(user.id),
    cookies(),
  ]);
  const last = jar.get(VAULT_SCOPE_COOKIE)?.value;
  const initialFolderId = last && folders.some((f) => f.id === last) ? last : null;

  return <VaultClient initial={initial} folders={folders} initialFolderId={initialFolderId} />;
}
