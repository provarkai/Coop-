const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const ACCESS_TOKEN_KEY = "ncms_access_token";
const REFRESH_TOKEN_KEY = "ncms_refresh_token";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface Cooperative {
  id: string;
  name: string;
  slug: string;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  bylaws: string | null;
  financialYearStartMonth: number;
  financialYearStartDay: number;
  currency: string;
  isActive: boolean;
}

export interface Branch {
  id: string;
  cooperativeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isHeadOffice: boolean;
}

export interface CommitteeMember {
  id: string;
  userId: string;
  title: string | null;
  user: { id: string; email: string; firstName: string; lastName: string };
}

export interface Committee {
  id: string;
  cooperativeId: string;
  name: string;
  description: string | null;
  members: CommitteeMember[];
}

export interface CooperativeMembership {
  id: string;
  cooperativeId: string;
  userId: string;
  role: string;
  status: string;
  category: string;
  membershipNumber: string | null;
  user: { id: string; email: string; firstName: string; lastName: string };
}

export interface CooperativePreview {
  id: string;
  name: string;
  slug: string;
}

export interface MembershipCard {
  membershipNumber: string | null;
  role: string;
  category: string;
  joinedAt: string;
  member: { firstName: string; lastName: string; email: string };
  cooperative: { id: string; name: string; slug: string };
  qrCodeDataUrl: string;
}

export interface Guarantor {
  id: string;
  membershipId: string;
  guarantorUserId: string;
  status: string;
  guarantorUser?: { id: string; email: string; firstName: string; lastName: string };
}

export interface Beneficiary {
  id: string;
  membershipId: string;
  fullName: string;
  relationship: string;
  phone: string | null;
  address: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorUserId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  bvn: string | null;
  nin: string | null;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
}

export interface ComplianceFiling {
  id: string;
  cooperativeId: string;
  submittedByUserId: string;
  type: string;
  period: string;
  title: string;
  notes: string | null;
  documentUrl: string | null;
  status: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  cooperative?: { id: string; name: string; slug: string };
  submittedBy?: { id: string; email: string; firstName: string; lastName: string };
  reviewedBy?: { id: string; email: string; firstName: string; lastName: string } | null;
}

export interface ComplianceCooperative extends Cooperative {
  _count: { memberships: number; complianceFilings: number };
}

export interface SavingsProduct {
  id: string;
  cooperativeId: string;
  name: string;
  code: string;
  interestRatePercent: string;
  minimumBalance: string;
  isActive: boolean;
}

export interface SavingsAccount {
  id: string;
  cooperativeId: string;
  membershipId: string;
  productId: string;
  accountNumber: string;
  balance: string;
  status: string;
  lastInterestAccrualAt: string | null;
  openedAt: string;
  product?: SavingsProduct;
  membership?: { user: { id: string; email: string; firstName: string; lastName: string } };
}

export interface SavingsTransaction {
  id: string;
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "INTEREST";
  amount: string;
  balanceAfter: string;
  narration: string | null;
  createdAt: string;
}

export interface SavingsReceipt {
  transactionId: string;
  type: string;
  amount: string;
  balanceAfter: string;
  narration: string | null;
  createdAt: string;
  account: { accountNumber: string; product: string };
  member: { firstName: string; lastName: string; email: string };
  qrCodeDataUrl: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function storeTokens(tokens: TokenPair) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (auth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const message = (body as { message?: string | string[] } | undefined)?.message;
    throw new ApiError(Array.isArray(message) ? message.join(", ") : message ?? "Request failed", res.status);
  }
  return body as T;
}

export const api = {
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    request<{ user: AuthUser } & TokenPair>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string; mfaCode?: string }) =>
    request<{ user: AuthUser } & TokenPair>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => request<AuthUser>("/auth/me", { method: "GET" }, true),

  logout: (refreshToken: string) =>
    request<{ message: string }>(
      "/auth/logout",
      { method: "POST", body: JSON.stringify({ refreshToken }) },
      true,
    ),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  setupMfa: () =>
    request<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }>(
      "/auth/mfa/setup",
      { method: "POST" },
      true,
    ),

  enableMfa: (code: string) =>
    request<{ message: string }>(
      "/auth/mfa/enable",
      { method: "POST", body: JSON.stringify({ code }) },
      true,
    ),

  disableMfa: (code: string) =>
    request<{ message: string }>(
      "/auth/mfa/disable",
      { method: "POST", body: JSON.stringify({ code }) },
      true,
    ),

  listCooperatives: () => request<Cooperative[]>("/cooperatives", { method: "GET" }, true),

  createCooperative: (data: { name: string; slug: string }) =>
    request<Cooperative>("/cooperatives", { method: "POST", body: JSON.stringify(data) }, true),

  getCooperative: (id: string) => request<Cooperative>(`/cooperatives/${id}`, { method: "GET" }, true),

  updateCooperative: (
    id: string,
    data: Partial<
      Pick<
        Cooperative,
        "name" | "registrationNumber" | "email" | "phone" | "address" | "bylaws" | "financialYearStartMonth" | "currency"
      >
    >,
  ) => request<Cooperative>(`/cooperatives/${id}`, { method: "PATCH", body: JSON.stringify(data) }, true),

  listBranches: (cooperativeId: string) =>
    request<Branch[]>(`/cooperatives/${cooperativeId}/branches`, { method: "GET" }, true),

  createBranch: (cooperativeId: string, data: { name: string; address?: string; isHeadOffice?: boolean }) =>
    request<Branch>(`/cooperatives/${cooperativeId}/branches`, { method: "POST", body: JSON.stringify(data) }, true),

  deleteBranch: (cooperativeId: string, branchId: string) =>
    request<void>(`/cooperatives/${cooperativeId}/branches/${branchId}`, { method: "DELETE" }, true),

  listCommittees: (cooperativeId: string) =>
    request<Committee[]>(`/cooperatives/${cooperativeId}/committees`, { method: "GET" }, true),

  createCommittee: (cooperativeId: string, data: { name: string; description?: string }) =>
    request<Committee>(`/cooperatives/${cooperativeId}/committees`, { method: "POST", body: JSON.stringify(data) }, true),

  addCommitteeMember: (cooperativeId: string, committeeId: string, data: { email: string; title?: string }) =>
    request<CommitteeMember>(
      `/cooperatives/${cooperativeId}/committees/${committeeId}/members`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  removeCommitteeMember: (cooperativeId: string, committeeId: string, userId: string) =>
    request<void>(
      `/cooperatives/${cooperativeId}/committees/${committeeId}/members/${userId}`,
      { method: "DELETE" },
      true,
    ),

  listMembers: (cooperativeId: string) =>
    request<CooperativeMembership[]>(`/cooperatives/${cooperativeId}/members`, { method: "GET" }, true),

  addMember: (cooperativeId: string, data: { email: string; role?: string; category?: string }) =>
    request<CooperativeMembership>(
      `/cooperatives/${cooperativeId}/members`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  updateMembership: (cooperativeId: string, userId: string, data: { role?: string; status?: string }) =>
    request<CooperativeMembership>(
      `/cooperatives/${cooperativeId}/members/${userId}`,
      { method: "PATCH", body: JSON.stringify(data) },
      true,
    ),

  removeMembership: (cooperativeId: string, userId: string) =>
    request<void>(`/cooperatives/${cooperativeId}/members/${userId}`, { method: "DELETE" }, true),

  getCooperativePreview: (id: string) =>
    request<CooperativePreview>(`/cooperatives/${id}/preview`, { method: "GET" }, true),

  applyToCooperative: (cooperativeId: string, data: { category?: string } = {}) =>
    request<CooperativeMembership>(
      `/cooperatives/${cooperativeId}/apply`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  approveMembership: (cooperativeId: string, userId: string) =>
    request<CooperativeMembership>(
      `/cooperatives/${cooperativeId}/members/${userId}/approve`,
      { method: "POST" },
      true,
    ),

  rejectMembership: (cooperativeId: string, userId: string) =>
    request<CooperativeMembership>(
      `/cooperatives/${cooperativeId}/members/${userId}/reject`,
      { method: "POST" },
      true,
    ),

  getMembershipCard: (cooperativeId: string, userId: string) =>
    request<MembershipCard>(`/cooperatives/${cooperativeId}/members/${userId}/card`, { method: "GET" }, true),

  listGuarantors: (cooperativeId: string, userId: string) =>
    request<Guarantor[]>(`/cooperatives/${cooperativeId}/members/${userId}/guarantors`, { method: "GET" }, true),

  addGuarantor: (cooperativeId: string, userId: string, data: { email: string }) =>
    request<Guarantor>(
      `/cooperatives/${cooperativeId}/members/${userId}/guarantors`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  respondToGuarantorRequest: (cooperativeId: string, guarantorId: string, status: "APPROVED" | "DECLINED") =>
    request<Guarantor>(
      `/cooperatives/${cooperativeId}/guarantors/${guarantorId}/respond`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      true,
    ),

  removeGuarantor: (cooperativeId: string, userId: string, guarantorId: string) =>
    request<void>(
      `/cooperatives/${cooperativeId}/members/${userId}/guarantors/${guarantorId}`,
      { method: "DELETE" },
      true,
    ),

  listBeneficiaries: (cooperativeId: string, userId: string) =>
    request<Beneficiary[]>(`/cooperatives/${cooperativeId}/members/${userId}/beneficiaries`, { method: "GET" }, true),

  addBeneficiary: (
    cooperativeId: string,
    userId: string,
    data: { fullName: string; relationship: string; phone?: string; address?: string },
  ) =>
    request<Beneficiary>(
      `/cooperatives/${cooperativeId}/members/${userId}/beneficiaries`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  removeBeneficiary: (cooperativeId: string, userId: string, beneficiaryId: string) =>
    request<void>(
      `/cooperatives/${cooperativeId}/members/${userId}/beneficiaries/${beneficiaryId}`,
      { method: "DELETE" },
      true,
    ),

  listAuditLogs: (cooperativeId: string) =>
    request<AuditLogEntry[]>(`/cooperatives/${cooperativeId}/audit-logs`, { method: "GET" }, true),

  getProfile: () => request<UserProfile>("/users/me", { method: "GET" }, true),

  updateProfile: (
    data: Partial<Pick<UserProfile, "firstName" | "lastName" | "gender" | "phone" | "address" | "bvn" | "nin">> & {
      dateOfBirth?: string;
    },
  ) => request<UserProfile>("/users/me", { method: "PATCH", body: JSON.stringify(data) }, true),

  listUsers: () => request<PlatformUser[]>("/users", { method: "GET" }, true),

  updateUserRole: (userId: string, role: string) =>
    request<PlatformUser>(`/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }, true),

  createComplianceFiling: (
    cooperativeId: string,
    data: { type: string; period: string; title: string; notes?: string; documentUrl?: string },
  ) =>
    request<ComplianceFiling>(
      `/cooperatives/${cooperativeId}/compliance-filings`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listComplianceFilingsForCooperative: (cooperativeId: string) =>
    request<ComplianceFiling[]>(`/cooperatives/${cooperativeId}/compliance-filings`, { method: "GET" }, true),

  listAllCooperativesForCompliance: () =>
    request<ComplianceCooperative[]>("/compliance/cooperatives", { method: "GET" }, true),

  listAllFilings: (status?: string) =>
    request<ComplianceFiling[]>(
      `/compliance/filings${status ? `?status=${status}` : ""}`,
      { method: "GET" },
      true,
    ),

  reviewFiling: (filingId: string, status: "APPROVED" | "REJECTED", reviewNotes?: string) =>
    request<ComplianceFiling>(
      `/compliance/filings/${filingId}/review`,
      { method: "PATCH", body: JSON.stringify({ status, reviewNotes }) },
      true,
    ),

  listSavingsProducts: (cooperativeId: string) =>
    request<SavingsProduct[]>(`/cooperatives/${cooperativeId}/savings/products`, { method: "GET" }, true),

  createSavingsProduct: (
    cooperativeId: string,
    data: { name: string; code: string; interestRatePercent?: number; minimumBalance?: number },
  ) =>
    request<SavingsProduct>(
      `/cooperatives/${cooperativeId}/savings/products`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  updateSavingsProduct: (
    cooperativeId: string,
    productId: string,
    data: Partial<{ name: string; interestRatePercent: number; minimumBalance: number; isActive: boolean }>,
  ) =>
    request<SavingsProduct>(
      `/cooperatives/${cooperativeId}/savings/products/${productId}`,
      { method: "PATCH", body: JSON.stringify(data) },
      true,
    ),

  listSavingsAccountsForCooperative: (cooperativeId: string) =>
    request<SavingsAccount[]>(`/cooperatives/${cooperativeId}/savings/accounts`, { method: "GET" }, true),

  listSavingsAccountsForMember: (cooperativeId: string, userId: string) =>
    request<SavingsAccount[]>(
      `/cooperatives/${cooperativeId}/members/${userId}/savings/accounts`,
      { method: "GET" },
      true,
    ),

  openSavingsAccount: (cooperativeId: string, userId: string, data: { productId: string }) =>
    request<SavingsAccount>(
      `/cooperatives/${cooperativeId}/members/${userId}/savings/accounts`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  recordSavingsTransaction: (
    cooperativeId: string,
    accountId: string,
    data: { type: "DEPOSIT" | "WITHDRAWAL"; amount: number; narration?: string },
  ) =>
    request<SavingsTransaction>(
      `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listSavingsTransactions: (cooperativeId: string, accountId: string) =>
    request<SavingsTransaction[]>(
      `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions`,
      { method: "GET" },
      true,
    ),

  accrueSavingsInterest: (cooperativeId: string, accountId: string) =>
    request<SavingsTransaction>(
      `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/accrue-interest`,
      { method: "POST" },
      true,
    ),

  getSavingsReceipt: (cooperativeId: string, accountId: string, transactionId: string) =>
    request<SavingsReceipt>(
      `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions/${transactionId}/receipt`,
      { method: "GET" },
      true,
    ),
};
