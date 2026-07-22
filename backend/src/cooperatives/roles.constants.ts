import { Role } from '@prisma/client';

export const MANAGE_COOPERATIVE_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
] as const;
export const MANAGE_GOVERNANCE_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.SECRETARY,
] as const;
export const AUDIT_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.AUDITOR,
] as const;
export const MANAGE_SAVINGS_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
] as const;
export const VIEW_SAVINGS_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
  Role.AUDITOR,
] as const;
