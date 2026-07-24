import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// A regulator's read access to a cooperative's data (documents, meetings,
// savings, loans, AI assistant, compliance filings, financial standing) is
// scoped to cooperatives explicitly assigned to them -- generally one state's
// worth, mirroring the Nigerian Co-operative Societies Act's state-level
// Director of Cooperatives structure. SUPER_ADMIN is never scoped this way.
@Injectable()
export class RegulatorAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async isAssigned(regulatorUserId: string, cooperativeId: string) {
    const assignment = await this.prisma.regulatorAssignment.findUnique({
      where: {
        cooperativeId_regulatorUserId: { cooperativeId, regulatorUserId },
      },
    });
    return !!assignment;
  }

  async listAssignedCooperativeIds(regulatorUserId: string) {
    const assignments = await this.prisma.regulatorAssignment.findMany({
      where: { regulatorUserId },
      select: { cooperativeId: true },
    });
    return assignments.map((a) => a.cooperativeId);
  }

  async listForCooperative(cooperativeId: string) {
    return this.prisma.regulatorAssignment.findMany({
      where: { cooperativeId },
      include: {
        regulator: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assign(
    cooperativeId: string,
    regulatorEmail: string,
    assignedByUserId: string,
  ) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    const regulator = await this.prisma.user.findUnique({
      where: { email: regulatorEmail },
    });
    if (!regulator) {
      throw new NotFoundException('No user with that email is registered');
    }
    if (
      regulator.role !== Role.REGULATOR &&
      regulator.role !== Role.SUPER_ADMIN
    ) {
      throw new BadRequestException(
        'That user does not have the REGULATOR platform role',
      );
    }

    const existing = await this.prisma.regulatorAssignment.findUnique({
      where: {
        cooperativeId_regulatorUserId: {
          cooperativeId,
          regulatorUserId: regulator.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'This regulator is already assigned to this cooperative',
      );
    }

    return this.prisma.regulatorAssignment.create({
      data: {
        cooperativeId,
        regulatorUserId: regulator.id,
        assignedByUserId,
      },
    });
  }

  async unassign(assignmentId: string) {
    const assignment = await this.prisma.regulatorAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('Regulator assignment not found');
    }
    await this.prisma.regulatorAssignment.delete({
      where: { id: assignmentId },
    });
  }
}
