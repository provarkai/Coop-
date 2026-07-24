import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SendAnnouncementDto } from './dto/send-announcement.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Simulated send: no real email/SMS/WhatsApp/push provider is called.
   * The attempt is recorded as SENT, mirroring the simulated payment
   * gateway used elsewhere in this app.
   */
  async send(params: {
    cooperativeId: string;
    recipientUserId: string;
    channel: NotificationChannel;
    subject?: string;
    body: string;
    sentByUserId?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        cooperativeId: params.cooperativeId,
        recipientUserId: params.recipientUserId,
        channel: params.channel,
        subject: params.subject,
        body: params.body,
        sentByUserId: params.sentByUserId,
        status: NotificationStatus.SENT,
      },
    });
  }

  async sendAnnouncement(
    cooperativeId: string,
    actor: AuthenticatedUser,
    dto: SendAnnouncementDto,
  ) {
    const activeMembers = await this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId, status: MembershipStatus.ACTIVE },
      select: { userId: true },
    });

    const notifications = await this.prisma.$transaction(
      activeMembers.map((m) =>
        this.prisma.notification.create({
          data: {
            cooperativeId,
            recipientUserId: m.userId,
            channel: dto.channel,
            subject: dto.subject,
            body: dto.body,
            sentByUserId: actor.userId,
            status: NotificationStatus.SENT,
          },
        }),
      ),
    );

    return notifications;
  }

  async listMyNotifications(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertActiveMembership(cooperativeId, user.userId);
    return this.prisma.notification.findMany({
      where: { cooperativeId, recipientUserId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllNotifications(cooperativeId: string) {
    return this.prisma.notification.findMany({
      where: { cooperativeId },
      include: {
        recipient: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertActiveMembership(cooperativeId: string, userId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this cooperative');
    }
  }
}
