-- Additive and nullable: no existing row is rewritten or changed.
ALTER TABLE "Transaction" ADD COLUMN "chargeDate" DATE;

CREATE INDEX "Transaction_userId_chargeDate_idx" ON "Transaction"("userId", "chargeDate");
