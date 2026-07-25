import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComplianceFilingStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RegulatorAssignmentsService } from '../regulator-assignments/regulator-assignments.service';
import { ReportsService } from '../reports/reports.service';
import { MeetingsService } from '../meetings/meetings.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ReviewFilingDto } from './dto/review-filing.dto';
import { AssignRegulatorDto } from './dto/assign-regulator.dto';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly regulatorAssignments: RegulatorAssignmentsService,
    private readonly reports: ReportsService,
    private readonly meetings: MeetingsService,
  ) {}

  // undefined means "unscoped" (SUPER_ADMIN sees every cooperative); a
  // REGULATOR is scoped to only the cooperatives assigned to them.
  private async scopedCooperativeIds(
    user: AuthenticatedUser,
  ): Promise<string[] | undefined> {
    if (user.role === Role.SUPER_ADMIN) {
      return undefined;
    }
    return this.regulatorAssignments.listAssignedCooperativeIds(user.userId);
  }

  async listCooperatives(user: AuthenticatedUser) {
    const scopedIds = await this.scopedCooperativeIds(user);
    return this.prisma.cooperative.findMany({
      where: scopedIds ? { id: { in: scopedIds } } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        state: true,
        registrationNumber: true,
        email: true,
        phone: true,
        address: true,
        bylaws: true,
        logoMimeType: true,
        financialYearStartMonth: true,
        financialYearStartDay: true,
        currency: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { memberships: true, complianceFilings: true } },
      },
      orderBy: { name: 'asc' },
      take: 1000,
    });
  }

  async listFilings(user: AuthenticatedUser, status?: ComplianceFilingStatus) {
    const scopedIds = await this.scopedCooperativeIds(user);
    return this.prisma.complianceFiling.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(scopedIds ? { cooperativeId: { in: scopedIds } } : {}),
      },
      include: {
        cooperative: { select: { id: true, name: true, slug: true } },
        submittedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  async getFiling(id: string, user: AuthenticatedUser) {
    const filing = await this.prisma.complianceFiling.findUnique({
      where: { id },
      include: {
        cooperative: { select: { id: true, name: true, slug: true } },
        submittedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    if (!filing) {
      throw new NotFoundException('Filing not found');
    }
    await this.assertRegulatorAccess(filing.cooperativeId, user);
    return filing;
  }

  async reviewFiling(
    id: string,
    reviewer: AuthenticatedUser,
    dto: ReviewFilingDto,
  ) {
    const filing = await this.prisma.complianceFiling.findUnique({
      where: { id },
    });
    if (!filing) {
      throw new NotFoundException('Filing not found');
    }
    await this.assertRegulatorAccess(filing.cooperativeId, reviewer);
    if (
      filing.status === ComplianceFilingStatus.APPROVED ||
      filing.status === ComplianceFilingStatus.REJECTED
    ) {
      throw new BadRequestException('This filing has already been reviewed');
    }

    const status =
      dto.status === 'APPROVED'
        ? ComplianceFilingStatus.APPROVED
        : ComplianceFilingStatus.REJECTED;
    const updated = await this.prisma.complianceFiling.update({
      where: { id },
      data: {
        status,
        reviewedByUserId: reviewer.userId,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes,
      },
    });

    await this.auditLog.record({
      cooperativeId: filing.cooperativeId,
      actorUserId: reviewer.userId,
      action: 'compliance.filing_reviewed',
      targetType: 'ComplianceFiling',
      targetId: filing.id,
      metadata: { status },
    });

    return updated;
  }

  async getFinancialStanding(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertRegulatorAccess(cooperativeId, user);
    return this.reports.computeDashboard(cooperativeId);
  }

  getMeetings(cooperativeId: string, user: AuthenticatedUser) {
    // MeetingsService.listMeetings already enforces the same
    // SUPER_ADMIN/assigned-REGULATOR/member check internally.
    return this.meetings.listMeetings(cooperativeId, user);
  }

  async assignRegulator(
    dto: AssignRegulatorDto,
    assignedBy: AuthenticatedUser,
  ) {
    return this.regulatorAssignments.assign(
      dto.cooperativeId,
      dto.regulatorEmail,
      assignedBy.userId,
    );
  }

  async unassignRegulator(assignmentId: string) {
    await this.regulatorAssignments.unassign(assignmentId);
  }

  async listAssignments(cooperativeId: string) {
    return this.regulatorAssignments.listForCooperative(cooperativeId);
  }

  private async assertRegulatorAccess(
    cooperativeId: string,
    user: AuthenticatedUser,
  ) {
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }
    const assigned = await this.regulatorAssignments.isAssigned(
      user.userId,
      cooperativeId,
    );
    if (!assigned) {
      throw new ForbiddenException('You are not assigned to this cooperative');
    }
  }
}
