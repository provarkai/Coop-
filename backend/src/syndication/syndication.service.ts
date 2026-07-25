import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  MilestoneStatus,
  ParcelStatus,
  ReservationStatus,
  Role,
  SyndicationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RegulatorAssignmentsService } from '../regulator-assignments/regulator-assignments.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { EXCO_ROLES } from '../cooperatives/roles.constants';
import { FundEscrowDto } from './dto/fund-escrow.dto';
import { VerifyMilestoneDto } from './dto/verify-milestone.dto';
import { RecordAllocationDto } from './dto/record-allocation.dto';

// Default milestone schedule and release weighting for a new syndication.
// Kesa never holds the escrowed funds itself -- fundEscrow just records
// that money moved to an external licensed trustee, and each milestone
// release is a coordination/documentation step, not a real fund transfer.
const DEFAULT_MILESTONES: { name: string; percent: number }[] = [
  { name: 'Title Transfer Completion', percent: 0.5 },
  { name: 'Survey & Subdivision Completion', percent: 0.3 },
  { name: 'Final Allocation & Handover', percent: 0.2 },
];

const MEMBER_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

@Injectable()
export class SyndicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly auditLog: AuditLogService,
    private readonly regulatorAssignments: RegulatorAssignmentsService,
  ) {}

  async initiateSyndication(
    cooperativeId: string,
    reservationId: string,
    actor: AuthenticatedUser,
  ) {
    const reservation = await this.prisma.parcelReservation.findUnique({
      where: { id: reservationId },
      include: { parcel: true, group: true, syndication: true },
    });
    if (!reservation || reservation.parcel.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Reservation not found');
    }
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only a confirmed reservation (target fund reached) can start a syndication',
      );
    }
    if (reservation.syndication) {
      throw new ConflictException('This reservation already has a syndication');
    }

    const price = Number(reservation.parcel.priceNaira);
    return this.prisma.$transaction(async (tx) => {
      const syndication = await tx.syndication.create({
        data: {
          cooperativeId,
          parcelId: reservation.parcelId,
          reservationId: reservation.id,
          groupId: reservation.groupId,
        },
      });
      await tx.syndicationMilestone.createMany({
        data: DEFAULT_MILESTONES.map((m, index) => ({
          syndicationId: syndication.id,
          order: index + 1,
          name: m.name,
          releaseAmount: Math.round(price * m.percent),
        })),
      });
      await this.auditLog.record({
        cooperativeId,
        actorUserId: actor.userId,
        action: 'syndication.initiated',
        targetType: 'Syndication',
        targetId: syndication.id,
        metadata: {
          parcelId: reservation.parcelId,
          groupId: reservation.groupId,
        },
      });
      return syndication;
    });
  }

  async fundEscrow(
    cooperativeId: string,
    syndicationId: string,
    actor: AuthenticatedUser,
    dto: FundEscrowDto,
  ) {
    const syndication = await this.getSyndicationOrThrow(
      cooperativeId,
      syndicationId,
    );
    if (syndication.status !== SyndicationStatus.ESCROW_PENDING) {
      throw new BadRequestException(
        'This syndication is not awaiting escrow funding',
      );
    }
    const updated = await this.prisma.syndication.update({
      where: { id: syndicationId },
      data: {
        escrowPartnerRef: dto.escrowPartnerRef,
        totalEscrowed: dto.amount,
        status: SyndicationStatus.ESCROW_FUNDED,
      },
    });
    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'syndication.escrow_funded',
      targetType: 'Syndication',
      targetId: syndicationId,
      metadata: { escrowPartnerRef: dto.escrowPartnerRef, amount: dto.amount },
    });
    return updated;
  }

  async verifyMilestone(
    cooperativeId: string,
    syndicationId: string,
    milestoneId: string,
    actor: AuthenticatedUser,
    dto: VerifyMilestoneDto,
  ) {
    const syndication = await this.getSyndicationOrThrow(
      cooperativeId,
      syndicationId,
    );
    if (syndication.status === SyndicationStatus.ESCROW_PENDING) {
      throw new BadRequestException('Fund escrow before verifying milestones');
    }
    const milestone = await this.getMilestoneOrThrow(
      syndicationId,
      milestoneId,
    );
    if (milestone.status !== MilestoneStatus.PENDING) {
      throw new BadRequestException('Only a pending milestone can be verified');
    }
    const updated = await this.prisma.syndicationMilestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.VERIFIED,
        proofNotes: dto.proofNotes,
        verifiedByUserId: actor.userId,
        verifiedAt: new Date(),
      },
    });
    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'syndication.milestone_verified',
      targetType: 'SyndicationMilestone',
      targetId: milestoneId,
      metadata: { syndicationId },
    });
    return updated;
  }

  async releaseMilestone(
    cooperativeId: string,
    syndicationId: string,
    milestoneId: string,
    actor: AuthenticatedUser,
  ) {
    const syndication = await this.getSyndicationOrThrow(
      cooperativeId,
      syndicationId,
    );
    const milestone = await this.getMilestoneOrThrow(
      syndicationId,
      milestoneId,
    );
    if (milestone.status !== MilestoneStatus.VERIFIED) {
      throw new BadRequestException(
        'Only a verified milestone can be released',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedMilestone = await tx.syndicationMilestone.update({
        where: { id: milestoneId },
        data: { status: MilestoneStatus.RELEASED, releasedAt: new Date() },
      });

      const allMilestones = await tx.syndicationMilestone.findMany({
        where: { syndicationId },
      });
      const allReleased = allMilestones.every(
        (m) => m.id === milestoneId || m.status === MilestoneStatus.RELEASED,
      );

      if (allReleased) {
        await tx.syndication.update({
          where: { id: syndicationId },
          data: { status: SyndicationStatus.COMPLETED },
        });
        await tx.landParcel.update({
          where: { id: syndication.parcelId },
          data: { status: ParcelStatus.SOLD },
        });
      } else if (syndication.status === SyndicationStatus.ESCROW_FUNDED) {
        await tx.syndication.update({
          where: { id: syndicationId },
          data: { status: SyndicationStatus.IN_PROGRESS },
        });
      }

      await this.auditLog.record({
        cooperativeId,
        actorUserId: actor.userId,
        action: 'syndication.milestone_released',
        targetType: 'SyndicationMilestone',
        targetId: milestoneId,
        metadata: { syndicationId, allReleased },
      });

      return updatedMilestone;
    });
  }

  async recordAllocation(
    cooperativeId: string,
    syndicationId: string,
    actor: AuthenticatedUser,
    dto: RecordAllocationDto,
  ) {
    const syndication = await this.getSyndicationOrThrow(
      cooperativeId,
      syndicationId,
    );
    if (syndication.status !== SyndicationStatus.COMPLETED) {
      throw new BadRequestException(
        'Allocations can only be recorded once the syndication is completed',
      );
    }
    const targetUser = await this.users.findByEmail(dto.memberEmail);
    if (!targetUser) {
      throw new NotFoundException('No user with that email is registered');
    }
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: targetUser.id } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException(
        'The member must be an active cooperative member',
      );
    }
    const existing = await this.prisma.allocation.findUnique({
      where: {
        syndicationId_membershipId: {
          syndicationId,
          membershipId: membership.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'This member already has an allocation recorded',
      );
    }

    const allocation = await this.prisma.allocation.create({
      data: {
        syndicationId,
        membershipId: membership.id,
        plotRef: dto.plotRef,
        documentIds: dto.documentIds ?? [],
      },
    });
    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'syndication.allocation_recorded',
      targetType: 'Allocation',
      targetId: allocation.id,
      metadata: { syndicationId, plotRef: dto.plotRef },
    });
    return allocation;
  }

  async listSyndications(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.syndication.findMany({
      where: { cooperativeId },
      include: { parcel: true, group: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSyndication(
    cooperativeId: string,
    syndicationId: string,
    user: AuthenticatedUser,
  ) {
    const syndication = await this.getSyndicationOrThrow(
      cooperativeId,
      syndicationId,
    );
    await this.assertGroupMemberOrGovernance(
      cooperativeId,
      syndication.groupId,
      user,
    );
    return this.prisma.syndication.findUnique({
      where: { id: syndicationId },
      include: {
        parcel: true,
        group: { select: { id: true, name: true } },
        milestones: { orderBy: { order: 'asc' } },
        allocations: {
          include: {
            membership: { include: { user: { select: MEMBER_USER_SELECT } } },
          },
        },
      },
    });
  }

  private async getSyndicationOrThrow(
    cooperativeId: string,
    syndicationId: string,
  ) {
    const syndication = await this.prisma.syndication.findUnique({
      where: { id: syndicationId },
    });
    if (!syndication || syndication.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Syndication not found');
    }
    return syndication;
  }

  private async getMilestoneOrThrow(
    syndicationId: string,
    milestoneId: string,
  ) {
    const milestone = await this.prisma.syndicationMilestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone || milestone.syndicationId !== syndicationId) {
      throw new NotFoundException('Milestone not found');
    }
    return milestone;
  }

  private async assertGroupMemberOrGovernance(
    cooperativeId: string,
    groupId: string,
    user: AuthenticatedUser,
  ) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (user.role === Role.REGULATOR) {
      const assigned = await this.regulatorAssignments.isAssigned(
        user.userId,
        cooperativeId,
      );
      if (!assigned) {
        throw new ForbiddenException(
          'You are not assigned to this cooperative',
        );
      }
      return;
    }
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: user.userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this cooperative');
    }
    if ((EXCO_ROLES as readonly Role[]).includes(membership.role)) return;
    const isGroupMember = await this.prisma.contributionGroupMember.findUnique({
      where: { groupId_membershipId: { groupId, membershipId: membership.id } },
    });
    if (!isGroupMember) {
      throw new ForbiddenException(
        "You are not a member of this syndication's group",
      );
    }
  }

  private async assertMember(cooperativeId: string, user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (user.role === Role.REGULATOR) {
      const assigned = await this.regulatorAssignments.isAssigned(
        user.userId,
        cooperativeId,
      );
      if (!assigned) {
        throw new ForbiddenException(
          'You are not assigned to this cooperative',
        );
      }
      return;
    }
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: user.userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this cooperative');
    }
  }
}
