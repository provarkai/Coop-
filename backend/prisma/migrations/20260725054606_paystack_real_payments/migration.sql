-- AlterTable
ALTER TABLE "Cooperative" ADD COLUMN     "paystackSubaccountAccountName" TEXT,
ADD COLUMN     "paystackSubaccountAccountNumber" TEXT,
ADD COLUMN     "paystackSubaccountBankCode" TEXT,
ADD COLUMN     "paystackSubaccountCode" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "authorizationUrl" TEXT;
