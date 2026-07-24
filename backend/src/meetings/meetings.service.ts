import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  MembershipStatus,
  MeetingStatus,
  ResolutionStatus,
  Role,
  VoteChoice,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { MANAGE_GOVERNANCE_ROLES } from '../cooperatives/roles.constants';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { RecordMinutesDto } from './dto/record-minutes.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { ProposeResolutionDto } from './dto/propose-resolution.dto';
import { CastVoteDto } from './dto/cast-vote.dto';

const MEETING_INCLUDE = {
  agendaItems: { orderBy: { order: 'asc' as const } },
  attendances: {
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  },
  resolutions: {
    include: {
      votes: true,
      proposedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  },
};

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async createMeeting(
    cooperativeId: string,
    actor: AuthenticatedUser,
    dto: CreateMeetingDto,
  ) {
    await this.getCooperativeOrThrow(cooperativeId);

    const activeMembers = await this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId, status: MembershipStatus.ACTIVE },
      select: { userId: true },
    });

    const meeting = await this.prisma.meeting.create({
      data: {
        cooperativeId,
        title: dto.title,
        type: dto.type,
        scheduledAt: new Date(dto.scheduledAt),
        location: dto.location,
        createdByUserId: actor.userId,
        agendaItems: {
          create: (dto.agendaItems ?? []).map((item, index) => ({
            order: index + 1,
            title: item.title,
            description: item.description,
          })),
        },
        attendances: {
          create: activeMembers.map((m) => ({ userId: m.userId })),
        },
      },
      include: MEETING_INCLUDE,
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'meeting.created',
      targetType: 'Meeting',
      targetId: meeting.id,
      metadata: { title: meeting.title },
    });

    return meeting;
  }

  async listMeetings(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.meeting.findMany({
      where: { cooperativeId },
      orderBy: { scheduledAt: 'desc' },
      include: { agendaItems: { orderBy: { order: 'asc' } } },
    });
  }

  async getMeeting(
    cooperativeId: string,
    meetingId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertMember(cooperativeId, user);
    return this.getMeetingOrThrow(cooperativeId, meetingId);
  }

  async updateMeeting(
    cooperativeId: string,
    meetingId: string,
    dto: UpdateMeetingDto,
  ) {
    await this.getMeetingOrThrow(cooperativeId, meetingId);
    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
      include: MEETING_INCLUDE,
    });
  }

  async recordMinutes(
    cooperativeId: string,
    meetingId: string,
    actor: AuthenticatedUser,
    dto: RecordMinutesDto,
  ) {
    await this.getMeetingOrThrow(cooperativeId, meetingId);
    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        minutes: dto.minutes,
        minutesRecordedByUserId: actor.userId,
        status: MeetingStatus.COMPLETED,
      },
      include: MEETING_INCLUDE,
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'meeting.minutes_recorded',
      targetType: 'Meeting',
      targetId: meetingId,
    });

    return updated;
  }

  async rsvp(
    cooperativeId: string,
    meetingId: string,
    actor: AuthenticatedUser,
    dto: RsvpDto,
  ) {
    await this.getMeetingOrThrow(cooperativeId, meetingId);
    await this.assertActiveMembership(cooperativeId, actor.userId);

    const status =
      dto.status === 'CONFIRMED'
        ? AttendanceStatus.CONFIRMED
        : AttendanceStatus.DECLINED;
    return this.prisma.attendance.upsert({
      where: { meetingId_userId: { meetingId, userId: actor.userId } },
      create: {
        meetingId,
        userId: actor.userId,
        status,
        respondedAt: new Date(),
      },
      update: { status, respondedAt: new Date() },
    });
  }

  async listAttendance(
    cooperativeId: string,
    meetingId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertMember(cooperativeId, user);
    await this.getMeetingOrThrow(cooperativeId, meetingId);
    return this.prisma.attendance.findMany({
      where: { meetingId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
  }

  async recordAttendance(
    cooperativeId: string,
    meetingId: string,
    userId: string,
    dto: RecordAttendanceDto,
  ) {
    await this.getMeetingOrThrow(cooperativeId, meetingId);
    const status =
      dto.status === 'ATTENDED'
        ? AttendanceStatus.ATTENDED
        : dto.status === 'ABSENT'
          ? AttendanceStatus.ABSENT
          : AttendanceStatus.EXCUSED;
    return this.prisma.attendance.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId, status, recordedAt: new Date() },
      update: { status, recordedAt: new Date() },
    });
  }

  async proposeResolution(
    cooperativeId: string,
    meetingId: string,
    actor: AuthenticatedUser,
    dto: ProposeResolutionDto,
  ) {
    const meeting = await this.getMeetingOrThrow(cooperativeId, meetingId);
    if (
      dto.agendaItemId &&
      !meeting.agendaItems.some((a) => a.id === dto.agendaItemId)
    ) {
      throw new NotFoundException('Agenda item not found on this meeting');
    }

    const resolution = await this.prisma.resolution.create({
      data: {
        meetingId,
        agendaItemId: dto.agendaItemId,
        title: dto.title,
        description: dto.description,
        proposedByUserId: actor.userId,
      },
      include: { votes: true },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'resolution.proposed',
      targetType: 'Resolution',
      targetId: resolution.id,
      metadata: { title: resolution.title },
    });

    return resolution;
  }

  async listResolutions(
    cooperativeId: string,
    meetingId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertMember(cooperativeId, user);
    await this.getMeetingOrThrow(cooperativeId, meetingId);
    return this.prisma.resolution.findMany({
      where: { meetingId },
      include: {
        votes: true,
        proposedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async castVote(
    cooperativeId: string,
    meetingId: string,
    resolutionId: string,
    actor: AuthenticatedUser,
    dto: CastVoteDto,
  ) {
    const resolution = await this.getResolutionOrThrow(
      cooperativeId,
      meetingId,
      resolutionId,
    );
    if (resolution.status !== ResolutionStatus.PROPOSED) {
      throw new BadRequestException('Voting on this resolution is closed');
    }
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: actor.userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not an active cooperative member');
    }

    const choice =
      dto.choice === 'FOR'
        ? VoteChoice.FOR
        : dto.choice === 'AGAINST'
          ? VoteChoice.AGAINST
          : VoteChoice.ABSTAIN;

    return this.prisma.vote.upsert({
      where: {
        resolutionId_membershipId: {
          resolutionId,
          membershipId: membership.id,
        },
      },
      create: { resolutionId, membershipId: membership.id, choice },
      update: { choice },
    });
  }

  async closeResolution(
    cooperativeId: string,
    meetingId: string,
    resolutionId: string,
    actor: AuthenticatedUser,
  ) {
    const resolution = await this.getResolutionOrThrow(
      cooperativeId,
      meetingId,
      resolutionId,
    );
    if (resolution.status !== ResolutionStatus.PROPOSED) {
      throw new BadRequestException('This resolution has already been closed');
    }

    const forVotes = resolution.votes.filter(
      (v) => v.choice === VoteChoice.FOR,
    ).length;
    const againstVotes = resolution.votes.filter(
      (v) => v.choice === VoteChoice.AGAINST,
    ).length;
    const status =
      forVotes > againstVotes
        ? ResolutionStatus.PASSED
        : ResolutionStatus.REJECTED;

    const updated = await this.prisma.resolution.update({
      where: { id: resolutionId },
      data: { status, closedAt: new Date() },
      include: { votes: true },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'resolution.closed',
      targetType: 'Resolution',
      targetId: resolutionId,
      metadata: { status, forVotes, againstVotes },
    });

    return updated;
  }

  async withdrawResolution(
    cooperativeId: string,
    meetingId: string,
    resolutionId: string,
    actor: AuthenticatedUser,
  ) {
    const resolution = await this.getResolutionOrThrow(
      cooperativeId,
      meetingId,
      resolutionId,
    );
    if (resolution.status !== ResolutionStatus.PROPOSED) {
      throw new BadRequestException('This resolution has already been closed');
    }
    await this.assertGovernanceOrProposer(
      cooperativeId,
      actor,
      resolution.proposedByUserId,
    );
    const updated = await this.prisma.resolution.update({
      where: { id: resolutionId },
      data: { status: ResolutionStatus.WITHDRAWN, closedAt: new Date() },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'resolution.withdrawn',
      targetType: 'Resolution',
      targetId: resolutionId,
    });

    return updated;
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

  private async getMeetingOrThrow(cooperativeId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: MEETING_INCLUDE,
    });
    if (!meeting || meeting.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }

  private async getResolutionOrThrow(
    cooperativeId: string,
    meetingId: string,
    resolutionId: string,
  ) {
    const resolution = await this.prisma.resolution.findUnique({
      where: { id: resolutionId },
      include: { votes: true, meeting: true },
    });
    if (
      !resolution ||
      resolution.meetingId !== meetingId ||
      resolution.meeting.cooperativeId !== cooperativeId
    ) {
      throw new NotFoundException('Resolution not found');
    }
    return resolution;
  }

  private async assertGovernanceOrProposer(
    cooperativeId: string,
    actor: AuthenticatedUser,
    proposedByUserId: string,
  ) {
    if (actor.role === Role.SUPER_ADMIN) {
      return;
    }
    if (actor.userId === proposedByUserId) {
      return;
    }
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: actor.userId } },
    });
    if (
      !membership ||
      membership.status !== MembershipStatus.ACTIVE ||
      !(MANAGE_GOVERNANCE_ROLES as readonly Role[]).includes(membership.role)
    ) {
      throw new ForbiddenException(
        'Only the proposer or cooperative governance can withdraw this resolution',
      );
    }
  }

  private async assertMember(cooperativeId: string, user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.REGULATOR) {
      return;
    }
    await this.assertActiveMembership(cooperativeId, user.userId);
  }

  private async assertActiveMembership(cooperativeId: string, userId: string) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this cooperative');
    }
  }
}
