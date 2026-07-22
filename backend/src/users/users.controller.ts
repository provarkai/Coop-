import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const record = await this.users.findById(user.userId);
    if (!record) {
      throw new NotFoundException('User not found');
    }
    return this.users.toPublicProfile(record);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.users.updateProfile(user.userId, {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
    return this.users.toPublicProfile(updated);
  }

  // Bootstrapping note: the very first SUPER_ADMIN can't be created through
  // the API (there's no admin to grant it) and must be set directly in the
  // database. From then on, admins use this endpoint to promote others.
  @Roles(Role.SUPER_ADMIN)
  @Get()
  listAll() {
    return this.users.listAll();
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const updated = await this.users.updateRole(id, dto.role);
    return this.users.toPublicProfile(updated);
  }
}
