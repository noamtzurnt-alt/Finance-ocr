-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailReceiptImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailConnectionId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailAttachmentId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "documentId" TEXT,
    "subject" TEXT,
    "sender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailReceiptImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GmailConnection_userId_idx" ON "GmailConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_userId_emailAddress_key" ON "GmailConnection"("userId", "emailAddress");

-- CreateIndex
CREATE INDEX "EmailReceiptImport_userId_createdAt_idx" ON "EmailReceiptImport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailReceiptImport_gmailConnectionId_createdAt_idx" ON "EmailReceiptImport"("gmailConnectionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailReceiptImport_gmailConnectionId_gmailMessageId_gmailAttachmentId_key" ON "EmailReceiptImport"("gmailConnectionId", "gmailMessageId", "gmailAttachmentId");

-- AddForeignKey
ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailReceiptImport" ADD CONSTRAINT "EmailReceiptImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailReceiptImport" ADD CONSTRAINT "EmailReceiptImport_gmailConnectionId_fkey" FOREIGN KEY ("gmailConnectionId") REFERENCES "GmailConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
