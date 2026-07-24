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
export const MANAGE_LOAN_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.LOAN_OFFICER,
] as const;
export const VIEW_LOAN_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.LOAN_OFFICER,
  Role.TREASURER,
  Role.AUDITOR,
] as const;
export const MANAGE_PAYMENT_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
] as const;
export const VIEW_PAYMENT_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
  Role.LOAN_OFFICER,
  Role.AUDITOR,
] as const;
export const MANAGE_ACCOUNTING_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
] as const;
export const VIEW_ACCOUNTING_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.TREASURER,
  Role.AUDITOR,
] as const;
export const VIEW_DASHBOARD_ROLES = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.SECRETARY,
  Role.TREASURER,
  Role.AUDITOR,
  Role.LOAN_OFFICER,
] as const;
