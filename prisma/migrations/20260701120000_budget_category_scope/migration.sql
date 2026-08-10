-- CreateEnum
CREATE TYPE "BudgetScope" AS ENUM ('personal', 'business');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "budgetScope" "BudgetScope";

-- AlterTable
ALTER TABLE "FinancialProfile" ADD COLUMN "personalCategories" JSONB;
ALTER TABLE "FinancialProfile" ADD COLUMN "businessCategories" JSONB;
