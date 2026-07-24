import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComplianceFilingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ReviewFilingDto } from './dto/review-filing.dto';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  listCooperatives() {
    return this.prisma.cooperative.findMany({
      include: {
        _count: { select: { memberships: true, complianceFilings: true } },
      },
      orderBy: { name: 'asc' },
      take: 1000,
    });
  }

  listFilings(status?: ComplianceFilingStatus) {
    return this.prisma.complianceFiling.findMany({
      where: status ? { status } : undefined,
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

  async getFiling(id: string) {
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
}
