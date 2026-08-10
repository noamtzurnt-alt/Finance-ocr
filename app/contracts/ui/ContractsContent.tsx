import { prisma } from "@/app/lib/prisma";
import ContractsClient from "./ContractsClient";

export default async function ContractsContent(props: { userId: string }) {
  const initial = await prisma.contract.findMany({
    where: { userId: props.userId },
    orderBy: [{ clientName: "asc" }, { contractDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      clientName: true,
      clientEmail: true,
      contractDate: true,
      details: true,
      fileName: true,
      fileMime: true,
      fileSize: true,
      emailHtmlKey: true,
      gmailMessageId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <ContractsClient
      initial={initial.map((c) => ({
        id: c.id,
        clientName: c.clientName,
        clientEmail: c.clientEmail,
        details: c.details,
        fileName: c.fileName,
        fileMime: c.fileMime,
        fileSize: c.fileSize,
        hasEmailHtml: Boolean(c.emailHtmlKey),
        importedFromGmail: Boolean(c.gmailMessageId),
        contractDate: c.contractDate?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}
