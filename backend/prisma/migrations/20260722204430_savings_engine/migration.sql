-- CreateEnum
CREATE TYPE "SavingsAccountStatus" AS ENUM ('ACTIVE', 'DORMANT', 'CLOSED');

-- CreateEnum
CREATE TYPE "SavingsTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'INTEREST');

-- CreateTable
CREATE TABLE "SavingsProduct" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "interestRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "minimumBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsAccount" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "SavingsAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastInterestAccrualAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "SavingsTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "narration" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavingsProduct_cooperativeId_code_key" ON "SavingsProduct"("cooperativeId", "code");

-- CreateIndex
CREATE INDEX "SavingsAccount_membershipId_idx" ON "SavingsAccount"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsAccount_cooperativeId_accountNumber_key" ON "SavingsAccount"("cooperativeId", "accountNumber");

-- CreateIndex
CREATE INDEX "SavingsTransaction_accountId_idx" ON "SavingsTransaction"("accountId");

-- AddForeignKey
ALTER TABLE "SavingsProduct" ADD CONSTRAINT "SavingsProduct_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CooperativeMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SavingsProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsTransaction" ADD CONSTRAINT "SavingsTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SavingsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsTransaction" ADD CONSTRAINT "SavingsTransaction_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
