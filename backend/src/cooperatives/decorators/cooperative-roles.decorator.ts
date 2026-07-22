import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const COOPERATIVE_ROLES_KEY = 'cooperativeRoles';

// Restricts a route to users whose CooperativeMembership.role (for the
// cooperative identified by the `:id` route param) is one of `roles`, or who
// are a platform-wide SUPER_ADMIN. Must be paired with CooperativeRolesGuard.
export const CooperativeRoles = (...roles: Role[]) =>
  SetMetadata(COOPERATIVE_ROLES_KEY, roles);
