-- CreateEnum
CREATE TYPE "ComplianceFilingType" AS ENUM ('ANNUAL_RETURN', 'FINANCIAL_STATEMENT', 'AGM_MINUTES', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceFilingStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'REGULATOR';

-- CreateTable
CREATE TABLE "ComplianceFiling" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "type" "ComplianceFilingType" NOT NULL,
    "period" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "documentUrl" TEXT,
    "status" "ComplianceFilingStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceFiling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceFiling_cooperativeId_idx" ON "ComplianceFiling"("cooperativeId");

-- CreateIndex
CREATE INDEX "ComplianceFiling_status_idx" ON "ComplianceFiling"("status");

-- AddForeignKey
ALTER TABLE "ComplianceFiling" ADD CONSTRAINT "ComplianceFiling_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFiling" ADD CONSTRAINT "ComplianceFiling_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFiling" ADD CONSTRAINT "ComplianceFiling_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
