import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import {
  AUDIT_ROLES,
  MANAGE_GOVERNANCE_ROLES,
  VIEW_DASHBOARD_ROLES,
  VIEW_LOAN_ROLES,
} from '../cooperatives/roles.constants';
import { AiService } from './ai.service';
import { AskAssistantDto } from './dto/ask-assistant.dto';
import { GenerateCustomReportDto } from './dto/generate-custom-report.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post(':id/ai/assistant')
  askAssistant(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AskAssistantDto,
  ) {
    return this.ai.askAssistant(id, user, dto);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Post(':id/meetings/:meetingId/summarize')
  summarizeMeeting(
    @Param('id') id: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ai.summarizeMeeting(id, meetingId, actor);
  }

  @CooperativeRoles(...VIEW_LOAN_ROLES)
  @Get(':id/loans/:loanId/risk-score')
  scoreLoanRisk(@Param('id') id: string, @Param('loanId') loanId: string) {
    return this.ai.scoreLoanRisk(id, loanId);
  }

  @CooperativeRoles(...AUDIT_ROLES)
  @Get(':id/fraud-alerts')
  detectFraudSignals(@Param('id') id: string) {
    return this.ai.detectFraudSignals(id);
  }

  @CooperativeRoles(...VIEW_DASHBOARD_ROLES)
  @Post(':id/ai/custom-report')
  generateCustomReport(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: GenerateCustomReportDto,
  ) {
    return this.ai.generateCustomReport(id, actor, dto);
  }
}
