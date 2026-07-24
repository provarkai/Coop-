import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import { MANAGE_GOVERNANCE_ROLES } from '../cooperatives/roles.constants';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { RecordMinutesDto } from './dto/record-minutes.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { ProposeResolutionDto } from './dto/propose-resolution.dto';
import { CastVoteDto } from './dto/cast-vote.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Post(':id/meetings')
  createMeeting(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.meetings.createMeeting(id, actor, dto);
  }

  @Get(':id/meetings')
  listMeetings(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetings.listMeetings(id, user);
  }

  @Get(':id/meetings/:meetingId')
  getMeeting(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetings.getMeeting(id, meetingId, user);
  }

  @Get(':id/meetings/:meetingId/minutes.pdf')
  async getMinutesPdf(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const pdf = await this.meetings.generateMinutesPdf(id, meetingId, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="meeting-minutes.pdf"',
    );
    res.send(pdf);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Patch(':id/meetings/:meetingId')
  updateMeeting(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetings.updateMeeting(id, meetingId, dto);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Post(':id/meetings/:meetingId/minutes')
  recordMinutes(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RecordMinutesDto,
  ) {
    return this.meetings.recordMinutes(id, meetingId, actor, dto);
  }

  @Post(':id/meetings/:meetingId/rsvp')
  rsvp(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RsvpDto,
  ) {
    return this.meetings.rsvp(id, meetingId, actor, dto);
  }

  @Get(':id/meetings/:meetingId/attendance')
  listAttendance(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetings.listAttendance(id, meetingId, user);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Post(':id/meetings/:meetingId/attendance/:userId')
  recordAttendance(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @Param('userId') userId: string,
    @Body() dto: RecordAttendanceDto,
  ) {
    return this.meetings.recordAttendance(id, meetingId, userId, dto);
  }

  @Post(':id/meetings/:meetingId/resolutions')
  proposeResolution(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ProposeResolutionDto,
  ) {
    return this.meetings.proposeResolution(id, meetingId, actor, dto);
  }

  @Get(':id/meetings/:meetingId/resolutions')
  listResolutions(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetings.listResolutions(id, meetingId, user);
  }

  @Post(':id/meetings/:meetingId/resolutions/:resolutionId/vote')
  castVote(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @Param('resolutionId') resolutionId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CastVoteDto,
  ) {
    return this.meetings.castVote(id, meetingId, resolutionId, actor, dto);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Post(':id/meetings/:meetingId/resolutions/:resolutionId/close')
  closeResolution(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @Param('resolutionId') resolutionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.meetings.closeResolution(id, meetingId, resolutionId, actor);
  }

  @Post(':id/meetings/:meetingId/resolutions/:resolutionId/withdraw')
  withdrawResolution(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @Param('resolutionId') resolutionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.meetings.withdrawResolution(id, meetingId, resolutionId, actor);
  }
}
