-- CreateTable
CREATE TABLE "MorningWebhookEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "morningDocId" TEXT,
    "morningType" INTEGER,
    "morningNumber" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MorningWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MorningWebhookEvent_userId_createdAt_idx" ON "MorningWebhookEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MorningWebhookEvent_createdAt_idx" ON "MorningWebhookEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "MorningWebhookEvent" ADD CONSTRAINT "MorningWebhookEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
