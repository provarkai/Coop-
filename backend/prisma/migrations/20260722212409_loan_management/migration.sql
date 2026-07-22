-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "RepaymentInstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "LoanLedgerEntryType" AS ENUM ('DISBURSEMENT', 'REPAYMENT', 'PENALTY');

-- CreateTable
CREATE TABLE "LoanProduct" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "interestRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "maxAmount" DECIMAL(14,2) NOT NULL,
    "maxTermMonths" INTEGER NOT NULL,
    "penaltyRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "requiredGuarantors" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "interestRatePercent" DECIMAL(5,2) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "outstandingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "disbursedByUserId" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanGuarantor" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "guarantorUserId" TEXT NOT NULL,
    "status" "GuarantorStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanGuarantor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepaymentInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalDue" DECIMAL(14,2) NOT NULL,
    "interestDue" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "RepaymentInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "RepaymentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanLedgerEntry" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "type" "LoanLedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "narration" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanProduct_cooperativeId_code_key" ON "LoanProduct"("cooperativeId", "code");

-- CreateIndex
CREATE INDEX "Loan_cooperativeId_idx" ON "Loan"("cooperativeId");

-- CreateIndex
CREATE INDEX "Loan_membershipId_idx" ON "Loan"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanGuarantor_loanId_guarantorUserId_key" ON "LoanGuarantor"("loanId", "guarantorUserId");

-- CreateIndex
CREATE INDEX "RepaymentInstallment_loanId_idx" ON "RepaymentInstallment"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "RepaymentInstallment_loanId_installmentNumber_key" ON "RepaymentInstallment"("loanId", "installmentNumber");

-- CreateIndex
CREATE INDEX "LoanLedgerEntry_loanId_idx" ON "LoanLedgerEntry"("loanId");

-- AddForeignKey
ALTER TABLE "LoanProduct" ADD CONSTRAINT "LoanProduct_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CooperativeMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoanProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanGuarantor" ADD CONSTRAINT "LoanGuarantor_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanGuarantor" ADD CONSTRAINT "LoanGuarantor_guarantorUserId_fkey" FOREIGN KEY ("guarantorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepaymentInstallment" ADD CONSTRAINT "RepaymentInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanLedgerEntry" ADD CONSTRAINT "LoanLedgerEntry_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanLedgerEntry" ADD CONSTRAINT "LoanLedgerEntry_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
