import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GuarantorStatus,
  MembershipStatus,
  Prisma,
  Role,
} from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RegulatorAssignmentsService } from '../regulator-assignments/regulator-assignments.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';
import { UpdateCooperativeLogoDto } from './dto/update-cooperative-logo.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { AddCommitteeMemberDto } from './dto/add-committee-member.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { ApplyDto } from './dto/apply.dto';
import { AddGuarantorDto } from './dto/add-guarantor.dto';
import { RespondGuarantorDto } from './dto/respond-guarantor.dto';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { CreateComplianceFilingDto } from './dto/create-compliance-filing.dto';
import {
  MANAGE_COOPERATIVE_ROLES,
  MANAGE_GOVERNANCE_ROLES,
} from './roles.constants';
import { PdfService } from '../pdf/pdf.service';

// Excludes the (potentially large) logo bytes from every general cooperative
// read -- the dedicated logo endpoint is the only place that fetches them.
const COOPERATIVE_SELECT = {
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
};

@Injectable()
export class CooperativesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
    private readonly pdf: PdfService,
    private readonly regulatorAssignments: RegulatorAssignmentsService,
  ) {}

  // Only SUPER_ADMIN can call this (enforced at the controller): the platform
  // team creates a cooperative on a regulator's request, per the Nigerian
  // Co-operative Societies Act's registration process -- it is not
  // self-service. The creator never becomes the cooperative's admin;
  // initialAdminEmail (an already-registered user) does.
  async create(creator: AuthenticatedUser, dto: CreateCooperativeDto) {
    const existingSlug = await this.prisma.cooperative.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(
        'A cooperative with this slug already exists',
      );
    }

    const initialAdmin = await this.users.findByEmail(dto.initialAdminEmail);
    if (!initialAdmin) {
      throw new NotFoundException(
        'No user with that initial admin email is registered. They must create an account first.',
      );
    }

    let regulator: Awaited<ReturnType<typeof this.users.findByEmail>> = null;
    if (dto.regulatorEmail) {
      regulator = await this.users.findByEmail(dto.regulatorEmail);
      if (!regulator) {
        throw new NotFoundException(
          'No user with that regulator email is registered',
        );
      }
      if (
        regulator.role !== Role.REGULATOR &&
        regulator.role !== Role.SUPER_ADMIN
      ) {
        throw new BadRequestException(
          'That user does not have the REGULATOR platform role',
        );
      }
    }

    const cooperativeData = {
      name: dto.name,
      slug: dto.slug,
      state: dto.state,
      registrationNumber: dto.registrationNumber,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
    };

    return this.prisma.$transaction(async (tx) => {
      const cooperative = await tx.cooperative.create({
        data: cooperativeData,
        select: COOPERATIVE_SELECT,
      });
      await tx.cooperativeMembership.create({
        data: {
          cooperativeId: cooperative.id,
          userId: initialAdmin.id,
          role: Role.COOPERATIVE_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });
      if (regulator) {
        await tx.regulatorAssignment.create({
          data: {
            cooperativeId: cooperative.id,
            regulatorUserId: regulator.id,
            assignedByUserId: creator.userId,
          },
        });
      }
      return cooperative;
    });
  }

  async findAllForUser(user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.cooperative.findMany({
        select: COOPERATIVE_SELECT,
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.cooperative.findMany({
      where: {
        memberships: {
          some: { userId: user.userId, status: MembershipStatus.ACTIVE },
        },
      },
      select: COOPERATIVE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.getCooperativeOrThrow(cooperativeId);
  }

  async getPreview(cooperativeId: string) {
    const cooperative = await this.getCooperativeOrThrow(cooperativeId);
    return {
      id: cooperative.id,
      name: cooperative.name,
      slug: cooperative.slug,
    };
  }

  async update(cooperativeId: string, dto: UpdateCooperativeDto) {
    await this.getCooperativeOrThrow(cooperativeId);
    return this.prisma.cooperative.update({
      where: { id: cooperativeId },
      data: dto,
      select: COOPERATIVE_SELECT,
    });
  }

  async updateLogo(cooperativeId: string, dto: UpdateCooperativeLogoDto) {
    await this.getCooperativeOrThrow(cooperativeId);
    await this.prisma.cooperative.update({
      where: { id: cooperativeId },
      data: {
        logo: Buffer.from(dto.contentBase64, 'base64'),
        logoMimeType: dto.mimeType,
      },
      select: { id: true },
    });
  }

  async getLogo(cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
      select: { logo: true, logoMimeType: true },
    });
    if (!cooperative || !cooperative.logo || !cooperative.logoMimeType) {
      throw new NotFoundException('No logo uploaded for this cooperative');
    }
    return { content: cooperative.logo, mimeType: cooperative.logoMimeType };
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

  async addMember(
    cooperativeId: string,
    actor: AuthenticatedUser,
    dto: AddMemberDto,
  ) {
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

    const membership = await this.prisma.cooperativeMembership.create({
      data: {
        cooperativeId,
        userId: targetUser.id,
        role: dto.role ?? Role.MEMBER,
        category: dto.category ?? 'ORDINARY',
        membershipNumber: dto.membershipNumber,
      },
    });

    const withNumber = membership.membershipNumber
      ? membership
      : await this.assignMembershipNumber(cooperativeId, membership.id);

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'membership.added',
      targetType: 'CooperativeMembership',
      targetId: membership.id,
      metadata: { userId: targetUser.id, role: withNumber.role },
    });

    return withNumber;
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
    actor: AuthenticatedUser,
    dto: UpdateMembershipDto,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    const governingRoles = MANAGE_COOPERATIVE_ROLES as readonly Role[];
    await this.assertNotStrandingCooperative(
      cooperativeId,
      userId,
      membership.status === MembershipStatus.ACTIVE &&
        governingRoles.includes(membership.role),
      (dto.status ?? membership.status) === MembershipStatus.ACTIVE &&
        governingRoles.includes(dto.role ?? membership.role),
    );
    const updated = await this.prisma.cooperativeMembership.update({
      where: { id: membership.id },
      data: dto,
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'membership.updated',
      targetType: 'CooperativeMembership',
      targetId: membership.id,
      metadata: { userId, changes: dto as Prisma.InputJsonValue },
    });

    return updated;
  }

  async removeMembership(
    cooperativeId: string,
    userId: string,
    actor: AuthenticatedUser,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    const governingRoles = MANAGE_COOPERATIVE_ROLES as readonly Role[];
    await this.assertNotStrandingCooperative(
      cooperativeId,
      userId,
      membership.status === MembershipStatus.ACTIVE &&
        governingRoles.includes(membership.role),
      false,
    );
    await this.prisma.cooperativeMembership.delete({
      where: { id: membership.id },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'membership.removed',
      targetType: 'CooperativeMembership',
      targetId: membership.id,
      metadata: { userId },
    });
  }

  async apply(
    cooperativeId: string,
    applicant: AuthenticatedUser,
    dto: ApplyDto,
  ) {
    await this.getCooperativeOrThrow(cooperativeId);

    const existing = await this.prisma.cooperativeMembership.findUnique({
      where: {
        cooperativeId_userId: { cooperativeId, userId: applicant.userId },
      },
    });
    if (existing) {
      throw new ConflictException(
        'You already have a membership (or application) for this cooperative',
      );
    }

    const membership = await this.prisma.cooperativeMembership.create({
      data: {
        cooperativeId,
        userId: applicant.userId,
        role: Role.MEMBER,
        status: MembershipStatus.PENDING,
        category: dto.category ?? 'ORDINARY',
      },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: applicant.userId,
      action: 'membership.applied',
      targetType: 'CooperativeMembership',
      targetId: membership.id,
    });

    return membership;
  }

  async approveMembership(
    cooperativeId: string,
    userId: string,
    actor: AuthenticatedUser,
  ) {
    const membership = await this.getPendingMembershipOrThrow(
      cooperativeId,
      userId,
    );

    const approved = await this.prisma.cooperativeMembership.update({
      where: { id: membership.id },
      data: { status: MembershipStatus.ACTIVE },
    });
    const withNumber = approved.membershipNumber
      ? approved
      : await this.assignMembershipNumber(cooperativeId, approved.id);

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'membership.approved',
      targetType: 'CooperativeMembership',
      targetId: membership.id,
      metadata: { userId },
    });

    return withNumber;
  }

  async rejectMembership(
    cooperativeId: string,
    userId: string,
    actor: AuthenticatedUser,
  ) {
    const membership = await this.getPendingMembershipOrThrow(
      cooperativeId,
      userId,
    );

    const rejected = await this.prisma.cooperativeMembership.update({
      where: { id: membership.id },
      data: { status: MembershipStatus.REJECTED },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'membership.rejected',
      targetType: 'CooperativeMembership',
      targetId: membership.id,
      metadata: { userId },
    });

    return rejected;
  }

  async getMembershipCard(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);

    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
      include: { user: true, cooperative: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException('No active membership found');
    }

    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${appUrl}/verify-membership?cooperative=${cooperativeId}&member=${userId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);

    return {
      membershipNumber: membership.membershipNumber,
      role: membership.role,
      category: membership.category,
      joinedAt: membership.joinedAt,
      member: {
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email,
      },
      cooperative: {
        id: membership.cooperative.id,
        name: membership.cooperative.name,
        slug: membership.cooperative.slug,
      },
      qrCodeDataUrl,
    };
  }

  async getMembershipCardPdf(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
  ) {
    const card = await this.getMembershipCard(cooperativeId, userId, requester);
    return this.pdf.generateMembershipCardPdf({
      cooperativeName: card.cooperative.name,
      memberName: `${card.member.firstName} ${card.member.lastName}`,
      membershipNumber: card.membershipNumber,
      role: card.role,
      category: card.category,
      joinedAt: new Date(card.joinedAt),
      qrCodeDataUrl: card.qrCodeDataUrl,
    });
  }

  async addGuarantor(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
    dto: AddGuarantorDto,
  ) {
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);
    const membership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      userId,
    );

    const guarantorUser = await this.users.findByEmail(dto.email);
    if (!guarantorUser) {
      throw new NotFoundException('No user with that email is registered');
    }
    if (guarantorUser.id === userId) {
      throw new BadRequestException('A member cannot guarantee themselves');
    }
    await this.assertActiveMembership(
      cooperativeId,
      guarantorUser.id,
      'The proposed guarantor must be an active cooperative member',
    );

    const existing = await this.prisma.guarantor.findUnique({
      where: {
        membershipId_guarantorUserId: {
          membershipId: membership.id,
          guarantorUserId: guarantorUser.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'This guarantor has already been nominated for this membership',
      );
    }

    return this.prisma.guarantor.create({
      data: { membershipId: membership.id, guarantorUserId: guarantorUser.id },
    });
  }

  async listGuarantors(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);
    const membership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      userId,
    );

    return this.prisma.guarantor.findMany({
      where: { membershipId: membership.id },
      include: {
        guarantorUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async respondToGuarantorRequest(
    cooperativeId: string,
    guarantorId: string,
    requester: AuthenticatedUser,
    dto: RespondGuarantorDto,
  ) {
    const guarantor = await this.prisma.guarantor.findUnique({
      where: { id: guarantorId },
      include: { membership: true },
    });
    if (!guarantor || guarantor.membership.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Guarantor request not found');
    }
    if (guarantor.guarantorUserId !== requester.userId) {
      throw new ForbiddenException(
        'Only the nominated guarantor can respond to this request',
      );
    }

    return this.prisma.guarantor.update({
      where: { id: guarantorId },
      data: {
        status:
          dto.status === 'APPROVED'
            ? GuarantorStatus.APPROVED
            : GuarantorStatus.DECLINED,
      },
    });
  }

  async removeGuarantor(
    cooperativeId: string,
    userId: string,
    guarantorId: string,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);
    const membership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      userId,
    );

    const guarantor = await this.prisma.guarantor.findUnique({
      where: { id: guarantorId },
    });
    if (!guarantor || guarantor.membershipId !== membership.id) {
      throw new NotFoundException('Guarantor not found');
    }
    await this.prisma.guarantor.delete({ where: { id: guarantorId } });
  }

  async addBeneficiary(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
    dto: CreateBeneficiaryDto,
  ) {
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);
    const membership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      userId,
    );

    return this.prisma.beneficiary.create({
      data: { ...dto, membershipId: membership.id },
    });
  }

  async listBeneficiaries(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);
    const membership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      userId,
    );

    return this.prisma.beneficiary.findMany({
      where: { membershipId: membership.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateBeneficiary(
    cooperativeId: string,
    userId: string,
    beneficiaryId: string,
    requester: AuthenticatedUser,
    dto: UpdateBeneficiaryDto,
  ) {
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);
    const membership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      userId,
    );

    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
    });
    if (!beneficiary || beneficiary.membershipId !== membership.id) {
      throw new NotFoundException('Beneficiary not found');
    }

    return this.prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: dto,
    });
  }

  async removeBeneficiary(
    cooperativeId: string,
    userId: string,
    beneficiaryId: string,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrGovernance(cooperativeId, userId, requester);
    const membership = await this.getActiveMembershipOrThrow(
      cooperativeId,
      userId,
    );

    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
    });
    if (!beneficiary || beneficiary.membershipId !== membership.id) {
      throw new NotFoundException('Beneficiary not found');
    }
    await this.prisma.beneficiary.delete({ where: { id: beneficiaryId } });
  }

  async listAuditLogs(cooperativeId: string) {
    await this.getCooperativeOrThrow(cooperativeId);
    return this.auditLog.listForCooperative(cooperativeId);
  }

  async createComplianceFiling(
    cooperativeId: string,
    actor: AuthenticatedUser,
    dto: CreateComplianceFilingDto,
  ) {
    await this.getCooperativeOrThrow(cooperativeId);

    const filing = await this.prisma.complianceFiling.create({
      data: { ...dto, cooperativeId, submittedByUserId: actor.userId },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'compliance.filing_submitted',
      targetType: 'ComplianceFiling',
      targetId: filing.id,
      metadata: { type: filing.type, period: filing.period },
    });

    return filing;
  }

  async listComplianceFilings(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.complianceFiling.findMany({
      where: { cooperativeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getPendingMembershipOrThrow(
    cooperativeId: string,
    userId: string,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.PENDING) {
      throw new NotFoundException('No pending membership application found');
    }
    return membership;
  }

  private async getActiveMembershipOrThrow(
    cooperativeId: string,
    userId: string,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException('No active membership found');
    }
    return membership;
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
    const hasGovernanceRole =
      !!requesterMembership &&
      requesterMembership.status === MembershipStatus.ACTIVE &&
      (MANAGE_GOVERNANCE_ROLES as readonly Role[]).includes(
        requesterMembership.role,
      );
    if (!hasGovernanceRole) {
      throw new ForbiddenException(
        'You do not have permission to manage this member',
      );
    }
  }

  private async generateMembershipNumber(
    cooperativeId: string,
  ): Promise<string> {
    const cooperative = await this.prisma.cooperative.findUniqueOrThrow({
      where: { id: cooperativeId },
    });
    const count = await this.prisma.cooperativeMembership.count({
      where: { cooperativeId, membershipNumber: { not: null } },
    });
    const prefix = cooperative.slug.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async assignMembershipNumber(
    cooperativeId: string,
    membershipId: string,
  ) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const membershipNumber =
        await this.generateMembershipNumber(cooperativeId);
      try {
        return await this.prisma.cooperativeMembership.update({
          where: { id: membershipId },
          data: { membershipNumber },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException(
      'Could not assign a membership number, please retry',
    );
  }

  private async getCooperativeOrThrow(cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
      select: COOPERATIVE_SELECT,
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

  private async assertNotStrandingCooperative(
    cooperativeId: string,
    userId: string,
    isCurrentlyGoverning: boolean,
    willStillGovern: boolean,
  ) {
    if (!isCurrentlyGoverning || willStillGovern) {
      return;
    }

    const governingRoles = MANAGE_COOPERATIVE_ROLES as readonly Role[];
    const otherGoverningCount = await this.prisma.cooperativeMembership.count({
      where: {
        cooperativeId,
        userId: { not: userId },
        status: MembershipStatus.ACTIVE,
        role: { in: governingRoles as Role[] },
      },
    });
    if (otherGoverningCount === 0) {
      throw new BadRequestException(
        'Cannot remove the last active cooperative admin or chairman. Promote another member to that role first.',
      );
    }
  }

  private async assertMember(cooperativeId: string, user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }
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
