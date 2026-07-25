import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LoanLedgerEntryType,
  LoanStatus,
  MembershipStatus,
  Prisma,
  Role,
  SavingsAccountStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateUnionDto } from './dto/create-union.dto';
import { AssignUnionAdminDto } from './dto/assign-union-admin.dto';

const COOPERATIVE_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  state: true,
  isActive: true,
};

@Injectable()
export class UnionsService {
  constructor(private readonly prisma: PrismaService) {}

  async isAssigned(unionAdminUserId: string, unionId: string) {
    const assignment = await this.prisma.unionAssignment.findUnique({
      where: { unionId_unionAdminUserId: { unionId, unionAdminUserId } },
    });
    return !!assignment;
  }

  private async assertAccess(unionId: string, user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }
    if (user.role === Role.UNION_ADMIN) {
      const assigned = await this.isAssigned(user.userId, unionId);
      if (!assigned) {
        throw new ForbiddenException('You are not assigned to this union');
      }
      return;
    }
    throw new ForbiddenException('You do not have access to this union');
  }

  async create(dto: CreateUnionDto) {
    const existing = await this.prisma.union.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('A union with that slug already exists');
    }
    return this.prisma.union.create({ data: dto });
  }

  async findAllForUser(user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.union.findMany({ orderBy: { name: 'asc' } });
    }
    if (user.role === Role.UNION_ADMIN) {
      return this.prisma.union.findMany({
        where: { assignments: { some: { unionAdminUserId: user.userId } } },
        orderBy: { name: 'asc' },
      });
    }
    return [];
  }

  private async getUnionOrThrow(unionId: string) {
    const union = await this.prisma.union.findUnique({
      where: { id: unionId },
    });
    if (!union) {
      throw new NotFoundException('Union not found');
    }
    return union;
  }

  async findOne(unionId: string, user: AuthenticatedUser) {
    const union = await this.getUnionOrThrow(unionId);
    await this.assertAccess(unionId, user);
    const cooperatives = await this.prisma.cooperative.findMany({
      where: { unionId },
      select: COOPERATIVE_SUMMARY_SELECT,
      orderBy: { name: 'asc' },
    });
    return { ...union, cooperatives };
  }

  async addCooperative(unionId: string, cooperativeId: string) {
    await this.getUnionOrThrow(unionId);
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }
    if (cooperative.unionId) {
      throw new BadRequestException(
        cooperative.unionId === unionId
          ? 'This cooperative already belongs to this union'
          : 'This cooperative already belongs to a different union',
      );
    }
    return this.prisma.cooperative.update({
      where: { id: cooperativeId },
      data: { unionId },
      select: COOPERATIVE_SUMMARY_SELECT,
    });
  }

  async removeCooperative(unionId: string, cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative || cooperative.unionId !== unionId) {
      throw new NotFoundException(
        'This cooperative is not a member of this union',
      );
    }
    await this.prisma.cooperative.update({
      where: { id: cooperativeId },
      data: { unionId: null },
    });
  }

  async listAssignments(unionId: string) {
    await this.getUnionOrThrow(unionId);
    return this.prisma.unionAssignment.findMany({
      where: { unionId },
      include: {
        unionAdmin: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assign(
    unionId: string,
    dto: AssignUnionAdminDto,
    assignedByUserId: string,
  ) {
    await this.getUnionOrThrow(unionId);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException('No user with that email is registered');
    }
    if (user.role !== Role.UNION_ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'That user does not have the UNION_ADMIN platform role',
      );
    }
    const existing = await this.prisma.unionAssignment.findUnique({
      where: {
        unionId_unionAdminUserId: { unionId, unionAdminUserId: user.id },
      },
    });
    if (existing) {
      throw new ConflictException(
        'This user is already assigned to this union',
      );
    }
    return this.prisma.unionAssignment.create({
      data: { unionId, unionAdminUserId: user.id, assignedByUserId },
    });
  }

  async unassign(unionId: string, assignmentId: string) {
    const assignment = await this.prisma.unionAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment || assignment.unionId !== unionId) {
      throw new NotFoundException('Union assignment not found');
    }
    await this.prisma.unionAssignment.delete({ where: { id: assignmentId } });
  }

  async getDashboard(unionId: string, user: AuthenticatedUser) {
    await this.getUnionOrThrow(unionId);
    await this.assertAccess(unionId, user);

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const cooperatives = await this.prisma.cooperative.findMany({
      where: { unionId },
      select: { id: true, name: true, slug: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    const cooperativeIds = cooperatives.map((c) => c.id);

    if (cooperativeIds.length === 0) {
      return {
        cooperativeCount: 0,
        activeMembers: 0,
        pendingApplications: 0,
        totalSavingsBalance: '0.00',
        totalOutstandingLoans: '0.00',
        loansDisbursedThisMonth: '0.00',
        cooperatives: [],
        generatedAt: now.toISOString(),
      };
    }

    const [
      activeMembersByCoop,
      pendingApplications,
      savingsByCoop,
      loansByCoop,
      disbursedAgg,
    ] = await Promise.all([
      this.prisma.cooperativeMembership.groupBy({
        by: ['cooperativeId'],
        where: {
          cooperativeId: { in: cooperativeIds },
          status: MembershipStatus.ACTIVE,
        },
        _count: { _all: true },
      }),
      this.prisma.cooperativeMembership.count({
        where: {
          cooperativeId: { in: cooperativeIds },
          status: MembershipStatus.PENDING,
        },
      }),
      this.prisma.savingsAccount.groupBy({
        by: ['cooperativeId'],
        where: {
          cooperativeId: { in: cooperativeIds },
          status: SavingsAccountStatus.ACTIVE,
        },
        _sum: { balance: true },
      }),
      this.prisma.loan.groupBy({
        by: ['cooperativeId'],
        where: {
          cooperativeId: { in: cooperativeIds },
          status: LoanStatus.ACTIVE,
        },
        _sum: { outstandingBalance: true },
      }),
      this.prisma.loanLedgerEntry.aggregate({
        where: {
          type: LoanLedgerEntryType.DISBURSEMENT,
          createdAt: { gte: monthStart, lt: monthEnd },
          loan: { cooperativeId: { in: cooperativeIds } },
        },
        _sum: { amount: true },
      }),
    ]);

    const membersByCoop = new Map(
      activeMembersByCoop.map((r) => [r.cooperativeId, r._count._all]),
    );
    const savingsMap = new Map(
      savingsByCoop.map((r) => [
        r.cooperativeId,
        r._sum.balance ?? new Prisma.Decimal(0),
      ]),
    );
    const loansMap = new Map(
      loansByCoop.map((r) => [
        r.cooperativeId,
        r._sum.outstandingBalance ?? new Prisma.Decimal(0),
      ]),
    );

    const cooperativeBreakdown = cooperatives.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.isActive,
      activeMembers: membersByCoop.get(c.id) ?? 0,
      totalSavingsBalance: (
        savingsMap.get(c.id) ?? new Prisma.Decimal(0)
      ).toFixed(2),
      totalOutstandingLoans: (
        loansMap.get(c.id) ?? new Prisma.Decimal(0)
      ).toFixed(2),
    }));

    const totalActiveMembers = activeMembersByCoop.reduce(
      (sum, r) => sum + r._count._all,
      0,
    );
    const totalSavingsBalance = savingsByCoop.reduce(
      (sum, r) => sum.plus(r._sum.balance ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );
    const totalOutstandingLoans = loansByCoop.reduce(
      (sum, r) => sum.plus(r._sum.outstandingBalance ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );

    return {
      cooperativeCount: cooperatives.length,
      activeMembers: totalActiveMembers,
      pendingApplications,
      totalSavingsBalance: totalSavingsBalance.toFixed(2),
      totalOutstandingLoans: totalOutstandingLoans.toFixed(2),
      loansDisbursedThisMonth: (
        disbursedAgg._sum.amount ?? new Prisma.Decimal(0)
      ).toFixed(2),
      cooperatives: cooperativeBreakdown,
      generatedAt: now.toISOString(),
    };
  }
}
