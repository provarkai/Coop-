import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionGroupType,
  ContributionStatus,
  MembershipStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RegulatorAssignmentsService } from '../regulator-assignments/regulator-assignments.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  EXCO_ROLES,
  MANAGE_GROUP_ROLES,
} from '../cooperatives/roles.constants';
import { CreateContributionGroupDto } from './dto/create-contribution-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { RecordContributionPeriodDto } from './dto/record-contribution-period.dto';
import { FlagContributionDto } from './dto/flag-contribution.dto';

const MEMBER_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

export interface TrustScore {
  score: number;
  rating: 'BELOW_THRESHOLD' | 'STANDARD' | 'HIGH';
  totalPeriods: number;
  confirmedCount: number;
  lateCount: number;
  defaultedCount: number;
}

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly auditLog: AuditLogService,
    private readonly regulatorAssignments: RegulatorAssignmentsService,
  ) {}

  async createGroup(cooperativeId: string, dto: CreateContributionGroupDto) {
    const existing = await this.prisma.contributionGroup.findUnique({
      where: { cooperativeId_name: { cooperativeId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(
        'A contribution group with this name already exists',
      );
    }

    const coordinatorUser = await this.users.findByEmail(dto.coordinatorEmail);
    if (!coordinatorUser) {
      throw new NotFoundException('No user with that email is registered');
    }
    const coordinatorMembership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      coordinatorUser.id,
      'The coordinator must be an active cooperative member',
    );

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.contributionGroup.create({
        data: {
          cooperativeId,
          name: dto.name,
          type: dto.type,
          coordinatorMembershipId: coordinatorMembership.id,
          contributionAmount: dto.contributionAmount,
          frequency: dto.frequency,
          targetAmount: dto.targetAmount,
        },
      });
      await tx.contributionGroupMember.create({
        data: {
          groupId: group.id,
          membershipId: coordinatorMembership.id,
          rotationOrder: dto.type === ContributionGroupType.ROTATING ? 1 : null,
        },
      });
      return group;
    });
  }

  async listGroups(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.contributionGroup.findMany({
      where: { cooperativeId },
      include: {
        coordinatorMembership: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGroup(
    cooperativeId: string,
    groupId: string,
    user: AuthenticatedUser,
  ) {
    const group = await this.getGroupOrThrow(cooperativeId, groupId);
    await this.assertGroupMemberOrGovernance(cooperativeId, group, user);
    return this.prisma.contributionGroup.findUnique({
      where: { id: groupId },
      include: {
        coordinatorMembership: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
        members: {
          where: { status: 'ACTIVE' },
          include: {
            membership: { include: { user: { select: MEMBER_USER_SELECT } } },
          },
          orderBy: { rotationOrder: 'asc' },
        },
      },
    });
  }

  async addMember(
    cooperativeId: string,
    groupId: string,
    actor: AuthenticatedUser,
    dto: AddGroupMemberDto,
  ) {
    const group = await this.getGroupOrThrow(cooperativeId, groupId);
    await this.assertCoordinatorOrGovernance(cooperativeId, group, actor);

    const targetUser = await this.users.findByEmail(dto.email);
    if (!targetUser) {
      throw new NotFoundException('No user with that email is registered');
    }
    const membership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      targetUser.id,
      'User must be an active cooperative member first',
    );

    const existing = await this.prisma.contributionGroupMember.findUnique({
      where: { groupId_membershipId: { groupId, membershipId: membership.id } },
    });
    if (existing) {
      throw new ConflictException('User is already in this group');
    }

    const activeCount = await this.prisma.contributionGroupMember.count({
      where: { groupId, status: 'ACTIVE' },
    });

    return this.prisma.contributionGroupMember.create({
      data: {
        groupId,
        membershipId: membership.id,
        rotationOrder:
          group.type === ContributionGroupType.ROTATING
            ? activeCount + 1
            : null,
      },
    });
  }

  async removeMember(
    cooperativeId: string,
    groupId: string,
    membershipId: string,
    actor: AuthenticatedUser,
  ) {
    const group = await this.getGroupOrThrow(cooperativeId, groupId);
    await this.assertCoordinatorOrGovernance(cooperativeId, group, actor);
    const groupMember = await this.prisma.contributionGroupMember.findUnique({
      where: { groupId_membershipId: { groupId, membershipId } },
    });
    if (!groupMember) {
      throw new NotFoundException('Group member not found');
    }
    await this.prisma.contributionGroupMember.update({
      where: { id: groupMember.id },
      data: { status: 'EXITED' },
    });
  }

  async recordContributionPeriod(
    cooperativeId: string,
    groupId: string,
    actor: AuthenticatedUser,
    dto: RecordContributionPeriodDto,
  ) {
    const group = await this.getGroupOrThrow(cooperativeId, groupId);
    await this.assertCoordinatorOrGovernance(cooperativeId, group, actor);

    const members = await this.prisma.contributionGroupMember.findMany({
      where: { groupId, status: 'ACTIVE' },
    });
    if (members.length === 0) {
      throw new BadRequestException('This group has no active members');
    }

    const amount = dto.amount ?? Number(group.contributionAmount);
    const dueDate = new Date(dto.dueDate);

    const created = await this.prisma.$transaction(
      members.map((m) =>
        this.prisma.contribution.create({
          data: { groupId, membershipId: m.membershipId, amount, dueDate },
        }),
      ),
    );

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'contribution.period_recorded',
      targetType: 'ContributionGroup',
      targetId: groupId,
      metadata: { dueDate: dto.dueDate, memberCount: members.length, amount },
    });

    return created;
  }

  async confirmContribution(
    cooperativeId: string,
    groupId: string,
    contributionId: string,
    actor: AuthenticatedUser,
  ) {
    const group = await this.getGroupOrThrow(cooperativeId, groupId);
    await this.assertCoordinatorOrGovernance(cooperativeId, group, actor);
    const contribution = await this.getContributionOrThrow(
      groupId,
      contributionId,
    );
    if (contribution.status === ContributionStatus.CONFIRMED) {
      throw new BadRequestException('This contribution is already confirmed');
    }

    const updated = await this.prisma.contribution.update({
      where: { id: contributionId },
      data: {
        status: ContributionStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedByUserId: actor.userId,
      },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'contribution.confirmed',
      targetType: 'Contribution',
      targetId: contributionId,
      metadata: { groupId },
    });

    return updated;
  }

  async flagContribution(
    cooperativeId: string,
    groupId: string,
    contributionId: string,
    actor: AuthenticatedUser,
    dto: FlagContributionDto,
  ) {
    const group = await this.getGroupOrThrow(cooperativeId, groupId);
    await this.assertCoordinatorOrGovernance(cooperativeId, group, actor);
    const contribution = await this.getContributionOrThrow(
      groupId,
      contributionId,
    );
    if (contribution.status === ContributionStatus.CONFIRMED) {
      throw new BadRequestException(
        'Cannot flag an already-confirmed contribution',
      );
    }

    const updated = await this.prisma.contribution.update({
      where: { id: contributionId },
      data: { status: dto.status },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'contribution.flagged',
      targetType: 'Contribution',
      targetId: contributionId,
      metadata: { groupId, status: dto.status },
    });

    return updated;
  }

  async listContributions(
    cooperativeId: string,
    groupId: string,
    user: AuthenticatedUser,
  ) {
    const group = await this.getGroupOrThrow(cooperativeId, groupId);
    await this.assertGroupMemberOrGovernance(cooperativeId, group, user);
    return this.prisma.contribution.findMany({
      where: { groupId },
      include: {
        membership: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
      orderBy: { dueDate: 'desc' },
    });
  }

  async getMemberTrustScore(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
  ): Promise<TrustScore> {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);
    return this.computeTrustScore(membership.id);
  }

  async getGroupTrustScore(
    cooperativeId: string,
    groupId: string,
    user: AuthenticatedUser,
  ) {
    const group = await this.getGroupOrThrow(cooperativeId, groupId);
    await this.assertGroupMemberOrGovernance(cooperativeId, group, user);
    const members = await this.prisma.contributionGroupMember.findMany({
      where: { groupId, status: 'ACTIVE' },
    });
    const scores = await Promise.all(
      members.map((m) => this.computeTrustScore(m.membershipId)),
    );
    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
      : 0;
    return {
      groupId,
      memberCount: members.length,
      averageScore,
      rating: this.ratingForScore(averageScore),
    };
  }

  // Land Banking checks a group's eligibility to reserve a parcel against
  // this same number -- exported so LandBankingService can call it directly
  // rather than duplicating the trust-score formula.
  async computeGroupTrustScoreValue(groupId: string): Promise<number> {
    const members = await this.prisma.contributionGroupMember.findMany({
      where: { groupId, status: 'ACTIVE' },
    });
    if (members.length === 0) return 0;
    const scores = await Promise.all(
      members.map((m) => this.computeTrustScore(m.membershipId)),
    );
    return Math.round(
      scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
    );
  }

  async computeGroupSavedTotal(groupId: string): Promise<number> {
    const agg = await this.prisma.contribution.aggregate({
      where: { groupId, status: ContributionStatus.CONFIRMED },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  private async computeTrustScore(membershipId: string): Promise<TrustScore> {
    const contributions = await this.prisma.contribution.findMany({
      where: { membershipId },
    });
    const total = contributions.length;
    if (total === 0) {
      return {
        score: 0,
        rating: 'BELOW_THRESHOLD',
        totalPeriods: 0,
        confirmedCount: 0,
        lateCount: 0,
        defaultedCount: 0,
      };
    }
    const confirmedCount = contributions.filter(
      (c) => c.status === ContributionStatus.CONFIRMED,
    ).length;
    const lateCount = contributions.filter(
      (c) => c.status === ContributionStatus.LATE,
    ).length;
    const defaultedCount = contributions.filter(
      (c) => c.status === ContributionStatus.DEFAULTED,
    ).length;

    const reliabilityRate = confirmedCount / total;
    const tenureBonus = (Math.min(confirmedCount, 25) / 25) * 20;
    const raw =
      reliabilityRate * 80 + tenureBonus - lateCount * 3 - defaultedCount * 10;
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    return {
      score,
      rating: this.ratingForScore(score),
      totalPeriods: total,
      confirmedCount,
      lateCount,
      defaultedCount,
    };
  }

  private ratingForScore(score: number): TrustScore['rating'] {
    if (score >= 75) return 'HIGH';
    if (score >= 40) return 'STANDARD';
    return 'BELOW_THRESHOLD';
  }

  private async getGroupOrThrow(cooperativeId: string, groupId: string) {
    const group = await this.prisma.contributionGroup.findUnique({
      where: { id: groupId },
    });
    if (!group || group.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Contribution group not found');
    }
    return group;
  }

  private async getContributionOrThrow(
    groupId: string,
    contributionId: string,
  ) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
    });
    if (!contribution || contribution.groupId !== groupId) {
      throw new NotFoundException('Contribution not found');
    }
    return contribution;
  }

  private async getActiveMembershipOrThrow(
    cooperativeId: string,
    userId: string,
    message: string,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException(message);
    }
    return membership;
  }

  private async assertCoordinatorOrGovernance(
    cooperativeId: string,
    group: { coordinatorMembershipId: string },
    actor: AuthenticatedUser,
  ) {
    if (actor.role === Role.SUPER_ADMIN) return;
    const actorMembership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: actor.userId } },
    });
    if (
      actorMembership &&
      actorMembership.status === MembershipStatus.ACTIVE &&
      (actorMembership.id === group.coordinatorMembershipId ||
        (MANAGE_GROUP_ROLES as readonly Role[]).includes(actorMembership.role))
    ) {
      return;
    }
    throw new ForbiddenException(
      "Only this group's coordinator or governance can do this",
    );
  }

  private async assertGroupMemberOrGovernance(
    cooperativeId: string,
    group: { id: string; coordinatorMembershipId: string },
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
      where: {
        groupId_membershipId: {
          groupId: group.id,
          membershipId: membership.id,
        },
      },
    });
    if (!isGroupMember) {
      throw new ForbiddenException('You are not a member of this group');
    }
  }

  private async assertSelfOrGovernance(
    cooperativeId: string,
    targetUserId: string,
    requester: AuthenticatedUser,
  ) {
    if (
      requester.userId === targetUserId ||
      requester.role === Role.SUPER_ADMIN
    ) {
      return;
    }
    const requesterMembership =
      await this.prisma.cooperativeMembership.findUnique({
        where: {
          cooperativeId_userId: { cooperativeId, userId: requester.userId },
        },
      });
    const hasAccess =
      !!requesterMembership &&
      requesterMembership.status === MembershipStatus.ACTIVE &&
      (EXCO_ROLES as readonly Role[]).includes(requesterMembership.role);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to view this');
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
