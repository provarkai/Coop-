import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  ParcelStatus,
  ReservationStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RegulatorAssignmentsService } from '../regulator-assignments/regulator-assignments.service';
import { ContributionsService } from '../contributions/contributions.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { EXCO_ROLES, MANAGE_LAND_ROLES } from '../cooperatives/roles.constants';
import { CreateLandParcelDto } from './dto/create-land-parcel.dto';
import { UpdateLandParcelDto } from './dto/update-land-parcel.dto';
import { ReserveParcelDto } from './dto/reserve-parcel.dto';

// A group's average trust score (see ContributionsService) must be at least
// this to reserve a parcel -- the "STANDARD" band from the Kesa spec.
const ELIGIBILITY_THRESHOLD = 40;
const RESERVATION_HOLD_DAYS = 30;

@Injectable()
export class LandBankingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly regulatorAssignments: RegulatorAssignmentsService,
    private readonly contributions: ContributionsService,
  ) {}

  async createParcel(
    cooperativeId: string,
    actor: AuthenticatedUser,
    dto: CreateLandParcelDto,
  ) {
    const parcel = await this.prisma.landParcel.create({
      data: { cooperativeId, listedByUserId: actor.userId, ...dto },
    });
    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'land_parcel.listed',
      targetType: 'LandParcel',
      targetId: parcel.id,
      metadata: { location: dto.location, priceNaira: dto.priceNaira },
    });
    return parcel;
  }

  async updateParcel(
    cooperativeId: string,
    parcelId: string,
    dto: UpdateLandParcelDto,
  ) {
    await this.getParcelOrThrow(cooperativeId, parcelId);
    return this.prisma.landParcel.update({
      where: { id: parcelId },
      data: dto,
    });
  }

  async publishParcel(
    cooperativeId: string,
    parcelId: string,
    actor: AuthenticatedUser,
  ) {
    const parcel = await this.getParcelOrThrow(cooperativeId, parcelId);
    if (parcel.status !== ParcelStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        'Only a parcel under review can be published',
      );
    }
    if (parcel.verificationScore <= 0) {
      throw new BadRequestException(
        'A parcel needs a verification score before it can be published',
      );
    }
    const updated = await this.prisma.landParcel.update({
      where: { id: parcelId },
      data: { status: ParcelStatus.PUBLISHED },
    });
    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'land_parcel.published',
      targetType: 'LandParcel',
      targetId: parcelId,
      metadata: { verificationScore: parcel.verificationScore },
    });
    return updated;
  }

  async listParcels(cooperativeId: string, user: AuthenticatedUser) {
    const canSeeAll = await this.hasLandManageAccess(cooperativeId, user);
    return this.prisma.landParcel.findMany({
      where: {
        cooperativeId,
        ...(canSeeAll ? {} : { status: { not: ParcelStatus.UNDER_REVIEW } }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getParcel(
    cooperativeId: string,
    parcelId: string,
    user: AuthenticatedUser,
  ) {
    const parcel = await this.getParcelOrThrow(cooperativeId, parcelId);
    if (parcel.status === ParcelStatus.UNDER_REVIEW) {
      const canSeeAll = await this.hasLandManageAccess(cooperativeId, user);
      if (!canSeeAll) {
        throw new NotFoundException('Land parcel not found');
      }
    } else {
      await this.assertMember(cooperativeId, user);
    }
    return parcel;
  }

  async reserveParcel(
    cooperativeId: string,
    parcelId: string,
    actor: AuthenticatedUser,
    dto: ReserveParcelDto,
  ) {
    const parcel = await this.getParcelOrThrow(cooperativeId, parcelId);
    if (parcel.status !== ParcelStatus.PUBLISHED) {
      throw new BadRequestException('Only a published parcel can be reserved');
    }
    const group = await this.prisma.contributionGroup.findUnique({
      where: { id: dto.groupId },
    });
    if (!group || group.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Contribution group not found');
    }
    await this.assertGroupCoordinatorOrGovernance(cooperativeId, group, actor);

    const trustScore = await this.contributions.computeGroupTrustScoreValue(
      group.id,
    );
    if (trustScore < ELIGIBILITY_THRESHOLD) {
      throw new ForbiddenException(
        `This group's trust score (${trustScore}) is below the eligibility threshold (${ELIGIBILITY_THRESHOLD}) to reserve a parcel`,
      );
    }

    const holdExpiresAt = new Date();
    holdExpiresAt.setDate(holdExpiresAt.getDate() + RESERVATION_HOLD_DAYS);

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.parcelReservation.create({
        data: { parcelId, groupId: group.id, holdExpiresAt },
      });
      await tx.landParcel.update({
        where: { id: parcelId },
        data: { status: ParcelStatus.RESERVED },
      });
      return reservation;
    });
  }

  async listReservationsForParcel(
    cooperativeId: string,
    parcelId: string,
    user: AuthenticatedUser,
  ) {
    await this.getParcelOrThrow(cooperativeId, parcelId);
    await this.assertMember(cooperativeId, user);
    return this.prisma.parcelReservation.findMany({
      where: { parcelId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReservation(
    cooperativeId: string,
    reservationId: string,
    user: AuthenticatedUser,
  ) {
    const reservation = await this.getReservationOrThrow(
      cooperativeId,
      reservationId,
    );
    await this.assertGroupCoordinatorOrGovernance(
      cooperativeId,
      reservation.group,
      user,
      true,
    );
    const savedTotal = await this.contributions.computeGroupSavedTotal(
      reservation.groupId,
    );
    return {
      ...reservation,
      savedTotal,
      targetPrice: reservation.parcel.priceNaira,
    };
  }

  async confirmReservation(
    cooperativeId: string,
    reservationId: string,
    actor: AuthenticatedUser,
  ) {
    const reservation = await this.getReservationOrThrow(
      cooperativeId,
      reservationId,
    );
    await this.assertGroupCoordinatorOrGovernance(
      cooperativeId,
      reservation.group,
      actor,
    );
    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException(
        'Only an active reservation can be confirmed',
      );
    }
    const savedTotal = await this.contributions.computeGroupSavedTotal(
      reservation.groupId,
    );
    const targetPrice = Number(reservation.parcel.priceNaira);
    if (savedTotal < targetPrice) {
      throw new BadRequestException(
        `The group has only saved ₦${savedTotal} of the ₦${targetPrice} target -- not enough to confirm yet`,
      );
    }
    const updated = await this.prisma.parcelReservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED },
    });
    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'parcel_reservation.confirmed',
      targetType: 'ParcelReservation',
      targetId: reservationId,
      metadata: { savedTotal },
    });
    return updated;
  }

  async cancelReservation(
    cooperativeId: string,
    reservationId: string,
    actor: AuthenticatedUser,
  ) {
    const reservation = await this.getReservationOrThrow(
      cooperativeId,
      reservationId,
    );
    await this.assertGroupCoordinatorOrGovernance(
      cooperativeId,
      reservation.group,
      actor,
    );
    if (
      reservation.status !== ReservationStatus.ACTIVE &&
      reservation.status !== ReservationStatus.CONFIRMED
    ) {
      throw new BadRequestException('This reservation cannot be cancelled');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.parcelReservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CANCELLED },
      });
      await tx.landParcel.update({
        where: { id: reservation.parcelId },
        data: { status: ParcelStatus.PUBLISHED },
      });
      return updated;
    });
  }

  private async getParcelOrThrow(cooperativeId: string, parcelId: string) {
    const parcel = await this.prisma.landParcel.findUnique({
      where: { id: parcelId },
    });
    if (!parcel || parcel.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Land parcel not found');
    }
    return parcel;
  }

  private async getReservationOrThrow(
    cooperativeId: string,
    reservationId: string,
  ) {
    const reservation = await this.prisma.parcelReservation.findUnique({
      where: { id: reservationId },
      include: { parcel: true, group: true },
    });
    if (!reservation || reservation.parcel.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Reservation not found');
    }
    return reservation;
  }

  private async hasLandManageAccess(
    cooperativeId: string,
    user: AuthenticatedUser,
  ) {
    if (user.role === Role.SUPER_ADMIN) return true;
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: user.userId } },
    });
    return (
      !!membership &&
      membership.status === MembershipStatus.ACTIVE &&
      (MANAGE_LAND_ROLES as readonly Role[]).includes(membership.role)
    );
  }

  private async assertGroupCoordinatorOrGovernance(
    cooperativeId: string,
    group: { id: string; coordinatorMembershipId: string },
    actor: AuthenticatedUser,
    allowGroupMember = false,
  ) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (actor.role === Role.REGULATOR) {
      const assigned = await this.regulatorAssignments.isAssigned(
        actor.userId,
        cooperativeId,
      );
      if (assigned) return;
      throw new ForbiddenException('You are not assigned to this cooperative');
    }
    const actorMembership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: actor.userId } },
    });
    if (
      !actorMembership ||
      actorMembership.status !== MembershipStatus.ACTIVE
    ) {
      throw new ForbiddenException('You are not a member of this cooperative');
    }
    if ((EXCO_ROLES as readonly Role[]).includes(actorMembership.role)) return;
    if (actorMembership.id === group.coordinatorMembershipId) return;
    if (allowGroupMember) {
      const isGroupMember =
        await this.prisma.contributionGroupMember.findUnique({
          where: {
            groupId_membershipId: {
              groupId: group.id,
              membershipId: actorMembership.id,
            },
          },
        });
      if (isGroupMember) return;
    }
    throw new ForbiddenException(
      "Only this group's coordinator or governance can do this",
    );
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
