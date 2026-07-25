import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UnionsService } from './unions.service';
import { CreateUnionDto } from './dto/create-union.dto';
import { AssignUnionAdminDto } from './dto/assign-union-admin.dto';

@Controller('unions')
export class UnionsController {
  constructor(private readonly unions: UnionsService) {}

  @Roles(Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateUnionDto) {
    return this.unions.create(dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.unions.findAllForUser(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.unions.findOne(id, user);
  }

  @Get(':id/dashboard')
  getDashboard(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.unions.getDashboard(id, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/cooperatives/:cooperativeId')
  addCooperative(
    @Param('id') id: string,
    @Param('cooperativeId') cooperativeId: string,
  ) {
    return this.unions.addCooperative(id, cooperativeId);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id/cooperatives/:cooperativeId')
  removeCooperative(
    @Param('id') id: string,
    @Param('cooperativeId') cooperativeId: string,
  ) {
    return this.unions.removeCooperative(id, cooperativeId);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get(':id/assignments')
  listAssignments(@Param('id') id: string) {
    return this.unions.listAssignments(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post(':id/assignments')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignUnionAdminDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.unions.assign(id, dto, actor.userId);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id/assignments/:assignmentId')
  unassign(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.unions.unassign(id, assignmentId);
  }
}
