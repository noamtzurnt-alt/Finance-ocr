import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import { parseNotesPlace } from "@/app/lib/notes/place";
import LiveRefresh from "@/app/ui/LiveRefresh";
import { listFolders, listNotes } from "@/app/lib/notes/server";
import NotesClient from "./ui/NotesClient";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const [initial, folders, placeRow] = await Promise.all([
    listNotes(user.id),
    listFolders(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { notesPlace: true } }),
  ]);

  return (
    <div className="notes-page">
      <LiveRefresh />
      <NotesClient initial={initial} folders={folders} savedPlace={parseNotesPlace(placeRow?.notesPlace)} />
    </div>
  );
}
