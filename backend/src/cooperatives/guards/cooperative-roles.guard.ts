import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipStatus, Role } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { COOPERATIVE_ROLES_KEY } from '../decorators/cooperative-roles.decorator';

@Injectable()
export class CooperativeRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      COOPERATIVE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request<{ id: string }> & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return false;
    }
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const cooperativeId = request.params.id;
    if (!cooperativeId) {
      return false;
    }

    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: user.userId } },
    });

    return (
      !!membership &&
      membership.status === MembershipStatus.ACTIVE &&
      requiredRoles.includes(membership.role)
    );
  }
}
