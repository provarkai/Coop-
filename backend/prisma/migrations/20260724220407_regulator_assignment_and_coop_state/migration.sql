-- AlterTable
ALTER TABLE "Cooperative" ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "RegulatorAssignment" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "regulatorUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegulatorAssignment_regulatorUserId_idx" ON "RegulatorAssignment"("regulatorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatorAssignment_cooperativeId_regulatorUserId_key" ON "RegulatorAssignment"("cooperativeId", "regulatorUserId");

-- CreateIndex
CREATE INDEX "Cooperative_state_idx" ON "Cooperative"("state");

-- AddForeignKey
ALTER TABLE "RegulatorAssignment" ADD CONSTRAINT "RegulatorAssignment_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatorAssignment" ADD CONSTRAINT "RegulatorAssignment_regulatorUserId_fkey" FOREIGN KEY ("regulatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatorAssignment" ADD CONSTRAINT "RegulatorAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
