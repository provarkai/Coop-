import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import { MANAGE_GOVERNANCE_ROLES } from '../cooperatives/roles.constants';
import { NotificationsService } from './notifications.service';
import { SendAnnouncementDto } from './dto/send-announcement.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Post(':id/notifications/announcements')
  sendAnnouncement(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SendAnnouncementDto,
  ) {
    return this.notifications.sendAnnouncement(id, actor, dto);
  }

  @Get(':id/notifications')
  listMyNotifications(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.listMyNotifications(id, user);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Get(':id/notifications/all')
  listAllNotifications(@Param('id') id: string) {
    return this.notifications.listAllNotifications(id);
  }
}
