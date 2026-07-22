import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { AddCommitteeMemberDto } from './dto/add-committee-member.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

@Injectable()
export class CooperativesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async create(creator: AuthenticatedUser, dto: CreateCooperativeDto) {
    const existingSlug = await this.prisma.cooperative.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(
        'A cooperative with this slug already exists',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const cooperative = await tx.cooperative.create({ data: dto });
      await tx.cooperativeMembership.create({
        data: {
          cooperativeId: cooperative.id,
          userId: creator.userId,
          role: Role.COOPERATIVE_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });
      return cooperative;
    });
  }

  async findAllForUser(user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.cooperative.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.cooperative.findMany({
      where: {
        memberships: {
          some: { userId: user.userId, status: MembershipStatus.ACTIVE },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.getCooperativeOrThrow(cooperativeId);
  }

  async update(cooperativeId: string, dto: UpdateCooperativeDto) {
    await this.getCooperativeOrThrow(cooperativeId);
    return this.prisma.cooperative.update({
      where: { id: cooperativeId },
      data: dto,
    });
  }

  async createBranch(cooperativeId: string, dto: CreateBranchDto) {
    await this.getCooperativeOrThrow(cooperativeId);
    const existing = await this.prisma.branch.findUnique({
      where: { cooperativeId_name: { cooperativeId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException('A branch with this name already exists');
    }
    return this.prisma.branch.create({ data: { ...dto, cooperativeId } });
  }

  async listBranches(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.branch.findMany({
      where: { cooperativeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateBranch(
    cooperativeId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ) {
    await this.getBranchOrThrow(cooperativeId, branchId);
    return this.prisma.branch.update({ where: { id: branchId }, data: dto });
  }

  async removeBranch(cooperativeId: string, branchId: string) {
    await this.getBranchOrThrow(cooperativeId, branchId);
    await this.prisma.branch.delete({ where: { id: branchId } });
  }

  async createCommittee(cooperativeId: string, dto: CreateCommitteeDto) {
    await this.getCooperativeOrThrow(cooperativeId);
    const existing = await this.prisma.committee.findUnique({
      where: { cooperativeId_name: { cooperativeId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException('A committee with this name already exists');
    }
    return this.prisma.committee.create({ data: { ...dto, cooperativeId } });
  }

  async listCommittees(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.committee.findMany({
      where: { cooperativeId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addCommitteeMember(
    cooperativeId: string,
    committeeId: string,
    dto: AddCommitteeMemberDto,
  ) {
    await this.getCommitteeOrThrow(cooperativeId, committeeId);

    const targetUser = await this.users.findByEmail(dto.email);
    if (!targetUser) {
      throw new NotFoundException('No user with that email is registered');
    }

    const targetMembership = await this.prisma.cooperativeMembership.findUnique(
      {
        where: {
          cooperativeId_userId: { cooperativeId, userId: targetUser.id },
        },
      },
    );
    if (
      !targetMembership ||
      targetMembership.status !== MembershipStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'User must be an active cooperative member first',
      );
    }

    const existing = await this.prisma.committeeMember.findUnique({
      where: { committeeId_userId: { committeeId, userId: targetUser.id } },
    });
    if (existing) {
      throw new ConflictException('User is already on this committee');
    }

    return this.prisma.committeeMember.create({
      data: { committeeId, userId: targetUser.id, title: dto.title },
    });
  }

  async removeCommitteeMember(
    cooperativeId: string,
    committeeId: string,
    userId: string,
  ) {
    await this.getCommitteeOrThrow(cooperativeId, committeeId);
    const existing = await this.prisma.committeeMember.findUnique({
      where: { committeeId_userId: { committeeId, userId } },
    });
    if (!existing) {
      throw new NotFoundException('Committee member not found');
    }
    await this.prisma.committeeMember.delete({ where: { id: existing.id } });
  }

  async addMember(cooperativeId: string, dto: AddMemberDto) {
    await this.getCooperativeOrThrow(cooperativeId);

    const targetUser = await this.users.findByEmail(dto.email);
    if (!targetUser) {
      throw new NotFoundException('No user with that email is registered');
    }

    const existing = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: targetUser.id } },
    });
    if (existing) {
      throw new ConflictException(
        'User is already a member of this cooperative',
      );
    }

    return this.prisma.cooperativeMembership.create({
      data: {
        cooperativeId,
        userId: targetUser.id,
        role: dto.role ?? Role.MEMBER,
        category: dto.category ?? 'ORDINARY',
        membershipNumber: dto.membershipNumber,
      },
    });
  }

  async listMembers(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMembership(
    cooperativeId: string,
    userId: string,
    dto: UpdateMembershipDto,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    return this.prisma.cooperativeMembership.update({
      where: { id: membership.id },
      data: dto,
    });
  }

  async removeMembership(cooperativeId: string, userId: string) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    await this.prisma.cooperativeMembership.delete({
      where: { id: membership.id },
    });
  }

  private async getCooperativeOrThrow(cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }
    return cooperative;
  }

  private async getBranchOrThrow(cooperativeId: string, branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch || branch.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  private async getCommitteeOrThrow(
    cooperativeId: string,
    committeeId: string,
  ) {
    const committee = await this.prisma.committee.findUnique({
      where: { id: committeeId },
    });
    if (!committee || committee.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Committee not found');
    }
    return committee;
  }

  private async assertMember(cooperativeId: string, user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }
    await this.assertActiveMembership(
      cooperativeId,
      user.userId,
      'You are not a member of this cooperative',
    );
  }

  private async assertActiveMembership(
    cooperativeId: string,
    userId: string,
    message: string,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(message);
    }
  }
}
