import { Role } from '@prisma/client';

// Every non-MEMBER cooperative role. All of these get at least read access to every
// governance section (dashboard, savings, loans, payments, accounting, audit log,
// fraud alerts) -- write/manage actions stay restricted to the specific functional
// role lists below.
export const EXCO_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.SECRETARY,
  Role.TREASURER,
  Role.AUDITOR,
  Role.LOAN_OFFICER,
  Role.COMMITTEE_MEMBER,
] as const;

export const MANAGE_COOPERATIVE_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
] as const;
export const MANAGE_GOVERNANCE_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.SECRETARY,
] as const;
export const AUDIT_ROLES = EXCO_ROLES;
export const MANAGE_SAVINGS_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
] as const;
export const VIEW_SAVINGS_ROLES = EXCO_ROLES;
export const MANAGE_LOAN_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.LOAN_OFFICER,
] as const;
export const VIEW_LOAN_ROLES = EXCO_ROLES;
export const MANAGE_PAYMENT_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
] as const;
export const VIEW_PAYMENT_ROLES = EXCO_ROLES;
export const MANAGE_ACCOUNTING_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
] as const;
export const VIEW_ACCOUNTING_ROLES = EXCO_ROLES;
export const VIEW_DASHBOARD_ROLES = EXCO_ROLES;
