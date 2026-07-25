-- CreateEnum
CREATE TYPE "ContributionGroupType" AS ENUM ('ROTATING', 'TARGET');

-- CreateEnum
CREATE TYPE "ContributionFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ContributionGroupStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContributionGroupMemberStatus" AS ENUM ('ACTIVE', 'EXITED');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'LATE', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('UNDER_REVIEW', 'PUBLISHED', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyndicationStatus" AS ENUM ('ESCROW_PENDING', 'ESCROW_FUNDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'VERIFIED', 'RELEASED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LAND_DESK_OFFICER';

-- CreateTable
CREATE TABLE "ContributionGroup" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContributionGroupType" NOT NULL,
    "coordinatorMembershipId" TEXT NOT NULL,
    "contributionAmount" DECIMAL(14,2) NOT NULL,
    "frequency" "ContributionFrequency" NOT NULL,
    "targetAmount" DECIMAL(14,2),
    "status" "ContributionGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "rotationOrder" INTEGER,
    "status" "ContributionGroupMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandParcel" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "coordinatesMinna" TEXT,
    "coordinatesWgs84" TEXT,
    "priceNaira" DECIMAL(14,2) NOT NULL,
    "sizeSqm" DECIMAL(10,2),
    "titleStatus" TEXT,
    "disputeCheckNotes" TEXT,
    "verificationScore" INTEGER NOT NULL DEFAULT 0,
    "status" "ParcelStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "listedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandParcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelReservation" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Syndication" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "escrowPartnerRef" TEXT,
    "totalEscrowed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "SyndicationStatus" NOT NULL DEFAULT 'ESCROW_PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Syndication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyndicationMilestone" (
    "id" TEXT NOT NULL,
    "syndicationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "releaseAmount" DECIMAL(14,2) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "proofNotes" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "SyndicationMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "syndicationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "plotRef" TEXT NOT NULL,
    "documentIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContributionGroup_cooperativeId_idx" ON "ContributionGroup"("cooperativeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionGroup_cooperativeId_name_key" ON "ContributionGroup"("cooperativeId", "name");

-- CreateIndex
CREATE INDEX "ContributionGroupMember_groupId_idx" ON "ContributionGroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionGroupMember_groupId_membershipId_key" ON "ContributionGroupMember"("groupId", "membershipId");

-- CreateIndex
CREATE INDEX "Contribution_groupId_idx" ON "Contribution"("groupId");

-- CreateIndex
CREATE INDEX "Contribution_membershipId_idx" ON "Contribution"("membershipId");

-- CreateIndex
CREATE INDEX "LandParcel_cooperativeId_idx" ON "LandParcel"("cooperativeId");

-- CreateIndex
CREATE INDEX "ParcelReservation_parcelId_idx" ON "ParcelReservation"("parcelId");

-- CreateIndex
CREATE INDEX "ParcelReservation_groupId_idx" ON "ParcelReservation"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelReservation_parcelId_groupId_key" ON "ParcelReservation"("parcelId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Syndication_reservationId_key" ON "Syndication"("reservationId");

-- CreateIndex
CREATE INDEX "Syndication_cooperativeId_idx" ON "Syndication"("cooperativeId");

-- CreateIndex
CREATE INDEX "SyndicationMilestone_syndicationId_idx" ON "SyndicationMilestone"("syndicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SyndicationMilestone_syndicationId_order_key" ON "SyndicationMilestone"("syndicationId", "order");

-- CreateIndex
CREATE INDEX "Allocation_syndicationId_idx" ON "Allocation"("syndicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Allocation_syndicationId_membershipId_key" ON "Allocation"("syndicationId", "membershipId");

-- AddForeignKey
ALTER TABLE "ContributionGroup" ADD CONSTRAINT "ContributionGroup_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionGroup" ADD CONSTRAINT "ContributionGroup_coordinatorMembershipId_fkey" FOREIGN KEY ("coordinatorMembershipId") REFERENCES "CooperativeMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionGroupMember" ADD CONSTRAINT "ContributionGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContributionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionGroupMember" ADD CONSTRAINT "ContributionGroupMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CooperativeMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContributionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CooperativeMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_listedByUserId_fkey" FOREIGN KEY ("listedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelReservation" ADD CONSTRAINT "ParcelReservation_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelReservation" ADD CONSTRAINT "ParcelReservation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContributionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syndication" ADD CONSTRAINT "Syndication_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syndication" ADD CONSTRAINT "Syndication_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syndication" ADD CONSTRAINT "Syndication_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "ParcelReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syndication" ADD CONSTRAINT "Syndication_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContributionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicationMilestone" ADD CONSTRAINT "SyndicationMilestone_syndicationId_fkey" FOREIGN KEY ("syndicationId") REFERENCES "Syndication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyndicationMilestone" ADD CONSTRAINT "SyndicationMilestone_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_syndicationId_fkey" FOREIGN KEY ("syndicationId") REFERENCES "Syndication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CooperativeMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
