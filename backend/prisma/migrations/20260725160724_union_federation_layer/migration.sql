-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'UNION_ADMIN';

-- AlterTable
ALTER TABLE "Cooperative" ADD COLUMN     "unionId" TEXT;

-- CreateTable
CREATE TABLE "Union" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Union_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnionAssignment" (
    "id" TEXT NOT NULL,
    "unionId" TEXT NOT NULL,
    "unionAdminUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Union_slug_key" ON "Union"("slug");

-- CreateIndex
CREATE INDEX "UnionAssignment_unionAdminUserId_idx" ON "UnionAssignment"("unionAdminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UnionAssignment_unionId_unionAdminUserId_key" ON "UnionAssignment"("unionId", "unionAdminUserId");

-- CreateIndex
CREATE INDEX "Cooperative_unionId_idx" ON "Cooperative"("unionId");

-- AddForeignKey
ALTER TABLE "Cooperative" ADD CONSTRAINT "Cooperative_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "Union"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnionAssignment" ADD CONSTRAINT "UnionAssignment_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "Union"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnionAssignment" ADD CONSTRAINT "UnionAssignment_unionAdminUserId_fkey" FOREIGN KEY ("unionAdminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnionAssignment" ADD CONSTRAINT "UnionAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
