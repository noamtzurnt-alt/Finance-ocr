-- CreateTable
CREATE TABLE "ReminderList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "icon" TEXT NOT NULL DEFAULT 'list',
    "kind" TEXT NOT NULL DEFAULT 'standard',
    "sortMode" TEXT NOT NULL DEFAULT 'manual',
    "showCompleted" BOOLEAN NOT NULL DEFAULT false,
    "viewMode" TEXT NOT NULL DEFAULT 'list',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "sectionId" TEXT,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "dueDate" TEXT,
    "dueTime" TEXT,
    "earlyMinutes" INTEGER,
    "recurrence" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderList_userId_idx" ON "ReminderList"("userId");
CREATE INDEX "ReminderSection_listId_idx" ON "ReminderSection"("listId");
CREATE INDEX "Reminder_userId_completed_idx" ON "Reminder"("userId", "completed");
CREATE INDEX "Reminder_listId_idx" ON "Reminder"("listId");
CREATE INDEX "Reminder_parentId_idx" ON "Reminder"("parentId");

-- AddForeignKey
ALTER TABLE "ReminderList" ADD CONSTRAINT "ReminderList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderSection" ADD CONSTRAINT "ReminderSection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderSection" ADD CONSTRAINT "ReminderSection_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ReminderList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ReminderList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ReminderSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Block Supabase's public REST API (Prisma connects as owner and bypasses RLS).
ALTER TABLE "ReminderList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReminderSection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;
