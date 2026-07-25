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
  state: string | null;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  bylaws: string | null;
  logoMimeType: string | null;
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

export interface MemberProfile {
  membershipNumber: string | null;
  role: string;
  category: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    gender: string | null;
    phone: string | null;
    address: string | null;
    bvn: string | null;
    nin: string | null;
    avatarMimeType: string | null;
    createdAt: string;
  };
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
  avatarMimeType: string | null;
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

export interface RegulatorAssignment {
  id: string;
  cooperativeId: string;
  regulatorUserId: string;
  assignedByUserId: string;
  createdAt: string;
  regulator?: { id: string; email: string; firstName: string; lastName: string };
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

export interface LoanProduct {
  id: string;
  cooperativeId: string;
  name: string;
  code: string;
  interestRatePercent: string;
  maxAmount: string;
  maxTermMonths: number;
  penaltyRatePercent: string;
  requiredGuarantors: number;
  isActive: boolean;
}

export interface RepaymentInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  amountPaid: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  paidAt: string | null;
}

export interface LoanLedgerEntry {
  id: string;
  type: "DISBURSEMENT" | "REPAYMENT" | "PENALTY";
  amount: string;
  balanceAfter: string;
  narration: string | null;
  createdAt: string;
}

export interface LoanGuarantor {
  id: string;
  loanId: string;
  guarantorUserId: string;
  status: string;
  guarantorUser?: { id: string; email: string; firstName: string; lastName: string };
  loan?: Loan;
}

export interface Loan {
  id: string;
  cooperativeId: string;
  membershipId: string;
  productId: string;
  principal: string;
  interestRatePercent: string;
  termMonths: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | "COMPLETED" | "DEFAULTED";
  outstandingBalance: string;
  rejectionReason: string | null;
  createdAt: string;
  product?: LoanProduct;
  membership?: { user: { id: string; email: string; firstName: string; lastName: string } };
  guarantors?: LoanGuarantor[];
  schedule?: RepaymentInstallment[];
  ledger?: LoanLedgerEntry[];
}

export interface Payment {
  id: string;
  cooperativeId: string;
  membershipId: string;
  purpose: "SAVINGS_DEPOSIT" | "LOAN_REPAYMENT";
  savingsAccountId: string | null;
  loanId: string | null;
  amount: string;
  gatewayReference: string;
  authorizationUrl: string | null;
  status: "INITIATED" | "SUCCESS" | "FAILED";
  narration: string | null;
  completedAt: string | null;
  createdAt: string;
  membership?: { user: { id: string; email: string; firstName: string; lastName: string } };
  savingsAccount?: { accountNumber: string; product?: { name: string } };
  loan?: { id: string; product?: { name: string } };
}

export interface PaystackBank {
  name: string;
  code: string;
  slug: string;
}

export interface BankAccountStatus {
  paystackSubaccountCode: string | null;
  paystackSubaccountBankCode: string | null;
  paystackSubaccountAccountNumber: string | null;
  paystackSubaccountAccountName: string | null;
  connected: boolean;
}

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export interface Account {
  id: string;
  cooperativeId: string;
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean;
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  account?: Account;
}

export interface JournalEntry {
  id: string;
  cooperativeId: string;
  date: string;
  memo: string | null;
  source: "MANUAL" | "SAVINGS" | "LOAN";
  sourceId: string | null;
  createdAt: string;
  lines: JournalLine[];
  postedBy?: { id: string; email: string; firstName: string; lastName: string } | null;
}

export interface TrialBalanceRow {
  account: Account;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

export interface IncomeStatement {
  income: TrialBalanceRow[];
  expense: TrialBalanceRow[];
  totalIncome: string;
  totalExpense: string;
  netSurplus: string;
}

export interface BalanceSheet {
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
}

export interface Budget {
  id: string;
  accountId: string;
  period: string;
  plannedAmount: string;
  account?: Account;
}

export interface BudgetVsActual {
  budget: Budget;
  actual: string;
  variance: string;
}

export type MeetingType = "AGM" | "BOARD" | "COMMITTEE" | "SPECIAL";
export type MeetingStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type AttendanceStatus = "INVITED" | "CONFIRMED" | "DECLINED" | "ATTENDED" | "ABSENT" | "EXCUSED";
export type ResolutionStatus = "PROPOSED" | "PASSED" | "REJECTED" | "WITHDRAWN";
export type VoteChoice = "FOR" | "AGAINST" | "ABSTAIN";

export interface AgendaItem {
  id: string;
  meetingId: string;
  order: number;
  title: string;
  description: string | null;
}

export interface Attendance {
  id: string;
  meetingId: string;
  userId: string;
  status: AttendanceStatus;
  respondedAt: string | null;
  recordedAt: string | null;
  user?: { id: string; email: string; firstName: string; lastName: string };
}

export interface Vote {
  id: string;
  resolutionId: string;
  membershipId: string;
  choice: VoteChoice;
}

export interface Resolution {
  id: string;
  meetingId: string;
  agendaItemId: string | null;
  title: string;
  description: string | null;
  status: ResolutionStatus;
  proposedByUserId: string;
  closedAt: string | null;
  createdAt: string;
  votes: Vote[];
  proposedBy?: { id: string; email: string; firstName: string; lastName: string };
}

export interface Meeting {
  id: string;
  cooperativeId: string;
  title: string;
  type: MeetingType;
  scheduledAt: string;
  location: string | null;
  status: MeetingStatus;
  minutes: string | null;
  aiSummary: string | null;
  minutesRecordedByUserId: string | null;
  createdByUserId: string;
  createdAt: string;
  agendaItems: AgendaItem[];
  attendances?: Attendance[];
  resolutions?: Resolution[];
}

export type DocumentCategory =
  | "BYLAWS"
  | "POLICY"
  | "FINANCIAL_STATEMENT"
  | "MEETING_MINUTES"
  | "FORM"
  | "REPORT"
  | "OTHER";

export interface DocumentMetadata {
  id: string;
  cooperativeId: string;
  uploadedByUserId: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: { id: string; email: string; firstName: string; lastName: string };
}

export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
export type NotificationStatus = "SENT" | "FAILED";

export interface AppNotification {
  id: string;
  cooperativeId: string | null;
  recipientUserId: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  status: NotificationStatus;
  sentByUserId: string | null;
  createdAt: string;
  recipient?: { id: string; email: string; firstName: string; lastName: string };
}

export interface DashboardSummary {
  activeMembers: number;
  pendingApplications: number;
  totalSavingsBalance: string;
  totalOutstandingLoans: string;
  loansDisbursedThisMonth: string;
  paymentsThisMonthCount: number;
  paymentsThisMonthTotal: string;
  upcomingMeetings: number;
  openResolutions: number;
  cashBalance: string;
  totalIncome: string;
  totalExpense: string;
  netSurplus: string;
  generatedAt: string;
}

export interface TrendPoint {
  month: string;
  newMembers: number;
  savingsNet: string;
  loanDisbursed: string;
  loanRepaid: string;
}

export interface LoanRiskScore {
  score: number;
  rating: "LOW" | "MEDIUM" | "HIGH";
  factors: string[];
  narrative: string;
}

export interface FraudAlert {
  type: string;
  description: string;
  accountNumber: string;
  member: string;
  createdAt: string;
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

// Kesa module suite: digital contribution engine (Ajo/Esusu), land banking,
// and property syndication. Escrow fund holding and land-registry checks are
// simulated/manually-entered (escrowPartnerRef, verificationScore) rather
// than a real trustee/registry integration -- Kesa is a coordination layer,
// not the fund holder, same convention as the Payments module.
export type ContributionGroupType = "ROTATING" | "TARGET";
export type ContributionFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type ContributionGroupStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export type ContributionStatus = "PENDING" | "CONFIRMED" | "LATE" | "DEFAULTED";

export interface ContributionGroup {
  id: string;
  cooperativeId: string;
  name: string;
  type: ContributionGroupType;
  coordinatorMembershipId: string;
  contributionAmount: string;
  frequency: ContributionFrequency;
  targetAmount: string | null;
  status: ContributionGroupStatus;
  createdAt: string;
  updatedAt: string;
  coordinatorMembership?: { user: { id: string; email: string; firstName: string; lastName: string } };
  _count?: { members: number };
  members?: ContributionGroupMember[];
}

export interface ContributionGroupMember {
  id: string;
  groupId: string;
  membershipId: string;
  rotationOrder: number | null;
  status: "ACTIVE" | "EXITED";
  joinedAt: string;
  membership: { user: { id: string; email: string; firstName: string; lastName: string } };
}

export interface Contribution {
  id: string;
  groupId: string;
  membershipId: string;
  amount: string;
  dueDate: string;
  confirmedAt: string | null;
  confirmedByUserId: string | null;
  status: ContributionStatus;
  createdAt: string;
  membership?: { user: { id: string; email: string; firstName: string; lastName: string } };
}

export interface TrustScore {
  score: number;
  rating: "BELOW_THRESHOLD" | "STANDARD" | "HIGH";
  totalPeriods: number;
  confirmedCount: number;
  lateCount: number;
  defaultedCount: number;
}

export interface GroupTrustScore {
  groupId: string;
  memberCount: number;
  averageScore: number;
  rating: "BELOW_THRESHOLD" | "STANDARD" | "HIGH";
}

export type ParcelStatus = "UNDER_REVIEW" | "PUBLISHED" | "RESERVED" | "SOLD";

export interface LandParcel {
  id: string;
  cooperativeId: string;
  location: string;
  coordinatesMinna: string | null;
  coordinatesWgs84: string | null;
  priceNaira: string;
  sizeSqm: string | null;
  titleStatus: string | null;
  disputeCheckNotes: string | null;
  verificationScore: number;
  status: ParcelStatus;
  listedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus = "ACTIVE" | "EXPIRED" | "CONFIRMED" | "CANCELLED";

export interface ParcelReservation {
  id: string;
  parcelId: string;
  groupId: string;
  holdExpiresAt: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  group?: { id: string; name: string };
  savedTotal?: number;
  targetPrice?: string;
  parcel?: LandParcel;
}

export type SyndicationStatus =
  | "ESCROW_PENDING"
  | "ESCROW_FUNDED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type MilestoneStatus = "PENDING" | "VERIFIED" | "RELEASED";

export interface SyndicationMilestone {
  id: string;
  syndicationId: string;
  order: number;
  name: string;
  releaseAmount: string;
  status: MilestoneStatus;
  proofNotes: string | null;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  releasedAt: string | null;
}

export interface Allocation {
  id: string;
  syndicationId: string;
  membershipId: string;
  plotRef: string;
  documentIds: string[];
  createdAt: string;
  membership?: { user: { id: string; email: string; firstName: string; lastName: string } };
}

export interface Syndication {
  id: string;
  cooperativeId: string;
  parcelId: string;
  reservationId: string;
  groupId: string;
  escrowPartnerRef: string | null;
  totalEscrowed: string;
  status: SyndicationStatus;
  createdAt: string;
  updatedAt: string;
  parcel?: LandParcel;
  group?: { id: string; name: string };
  milestones?: SyndicationMilestone[];
  allocations?: Allocation[];
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

  createCooperative: (data: {
    name: string;
    slug: string;
    state: string;
    initialAdminEmail: string;
    regulatorEmail?: string;
  }) => request<Cooperative>("/cooperatives", { method: "POST", body: JSON.stringify(data) }, true),

  getCooperative: (id: string) => request<Cooperative>(`/cooperatives/${id}`, { method: "GET" }, true),

  updateCooperative: (
    id: string,
    data: Partial<
      Pick<
        Cooperative,
        | "name"
        | "state"
        | "registrationNumber"
        | "email"
        | "phone"
        | "address"
        | "bylaws"
        | "financialYearStartMonth"
        | "currency"
      >
    >,
  ) => request<Cooperative>(`/cooperatives/${id}`, { method: "PATCH", body: JSON.stringify(data) }, true),

  updateCooperativeLogo: (id: string, data: { mimeType: string; contentBase64: string }) =>
    request<void>(`/cooperatives/${id}/logo`, { method: "PATCH", body: JSON.stringify(data) }, true),

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

  getMemberProfile: (cooperativeId: string, userId: string) =>
    request<MemberProfile>(`/cooperatives/${cooperativeId}/members/${userId}/profile`, { method: "GET" }, true),

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

  updateMyAvatar: (data: { mimeType: string; contentBase64: string }) =>
    request<{ updated: true }>("/users/me/avatar", { method: "PATCH", body: JSON.stringify(data) }, true),

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

  getFinancialStanding: (cooperativeId: string) =>
    request<DashboardSummary>(
      `/compliance/cooperatives/${cooperativeId}/financial-standing`,
      { method: "GET" },
      true,
    ),

  getRegulatorMeetings: (cooperativeId: string) =>
    request<Meeting[]>(`/compliance/cooperatives/${cooperativeId}/meetings`, { method: "GET" }, true),

  listRegulatorAssignments: (cooperativeId: string) =>
    request<RegulatorAssignment[]>(
      `/compliance/cooperatives/${cooperativeId}/assignments`,
      { method: "GET" },
      true,
    ),

  assignRegulator: (cooperativeId: string, regulatorEmail: string) =>
    request<RegulatorAssignment>(
      "/compliance/assignments",
      { method: "POST", body: JSON.stringify({ cooperativeId, regulatorEmail }) },
      true,
    ),

  unassignRegulator: (assignmentId: string) =>
    request<void>(`/compliance/assignments/${assignmentId}`, { method: "DELETE" }, true),

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

  listLoanProducts: (cooperativeId: string) =>
    request<LoanProduct[]>(`/cooperatives/${cooperativeId}/loan-products`, { method: "GET" }, true),

  createLoanProduct: (
    cooperativeId: string,
    data: {
      name: string;
      code: string;
      interestRatePercent?: number;
      maxAmount: number;
      maxTermMonths: number;
      penaltyRatePercent?: number;
      requiredGuarantors?: number;
    },
  ) =>
    request<LoanProduct>(
      `/cooperatives/${cooperativeId}/loan-products`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  updateLoanProduct: (
    cooperativeId: string,
    productId: string,
    data: Partial<{
      name: string;
      interestRatePercent: number;
      maxAmount: number;
      maxTermMonths: number;
      penaltyRatePercent: number;
      requiredGuarantors: number;
      isActive: boolean;
    }>,
  ) =>
    request<LoanProduct>(
      `/cooperatives/${cooperativeId}/loan-products/${productId}`,
      { method: "PATCH", body: JSON.stringify(data) },
      true,
    ),

  applyForLoan: (cooperativeId: string, data: { productId: string; principal: number; termMonths: number }) =>
    request<Loan>(`/cooperatives/${cooperativeId}/loans`, { method: "POST", body: JSON.stringify(data) }, true),

  listLoansForCooperative: (cooperativeId: string) =>
    request<Loan[]>(`/cooperatives/${cooperativeId}/loans`, { method: "GET" }, true),

  listLoansForMember: (cooperativeId: string, userId: string) =>
    request<Loan[]>(`/cooperatives/${cooperativeId}/members/${userId}/loans`, { method: "GET" }, true),

  getLoan: (cooperativeId: string, loanId: string) =>
    request<Loan>(`/cooperatives/${cooperativeId}/loans/${loanId}`, { method: "GET" }, true),

  addLoanGuarantor: (cooperativeId: string, loanId: string, data: { email: string }) =>
    request<LoanGuarantor>(
      `/cooperatives/${cooperativeId}/loans/${loanId}/guarantors`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listLoanGuarantors: (cooperativeId: string, loanId: string) =>
    request<LoanGuarantor[]>(`/cooperatives/${cooperativeId}/loans/${loanId}/guarantors`, { method: "GET" }, true),

  listGuarantorRequestsForUser: (cooperativeId: string) =>
    request<LoanGuarantor[]>(`/cooperatives/${cooperativeId}/loan-guarantor-requests`, { method: "GET" }, true),

  respondToLoanGuarantorRequest: (
    cooperativeId: string,
    loanId: string,
    guarantorId: string,
    status: "APPROVED" | "DECLINED",
  ) =>
    request<LoanGuarantor>(
      `/cooperatives/${cooperativeId}/loans/${loanId}/guarantors/${guarantorId}/respond`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      true,
    ),

  approveLoan: (cooperativeId: string, loanId: string) =>
    request<Loan>(`/cooperatives/${cooperativeId}/loans/${loanId}/approve`, { method: "POST" }, true),

  rejectLoan: (cooperativeId: string, loanId: string, reason?: string) =>
    request<Loan>(
      `/cooperatives/${cooperativeId}/loans/${loanId}/reject`,
      { method: "POST", body: JSON.stringify({ reason }) },
      true,
    ),

  disburseLoan: (cooperativeId: string, loanId: string) =>
    request<Loan>(`/cooperatives/${cooperativeId}/loans/${loanId}/disburse`, { method: "POST" }, true),

  recordLoanRepayment: (cooperativeId: string, loanId: string, data: { amount: number; narration?: string }) =>
    request<LoanLedgerEntry>(
      `/cooperatives/${cooperativeId}/loans/${loanId}/repayments`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  assessLoanPenalty: (cooperativeId: string, loanId: string) =>
    request<LoanLedgerEntry>(`/cooperatives/${cooperativeId}/loans/${loanId}/assess-penalty`, { method: "POST" }, true),

  initiatePayment: (
    cooperativeId: string,
    data: { purpose: "SAVINGS_DEPOSIT" | "LOAN_REPAYMENT"; targetId: string; amount: number; narration?: string },
  ) =>
    request<Payment>(`/cooperatives/${cooperativeId}/payments`, { method: "POST", body: JSON.stringify(data) }, true),

  listPaymentsForCooperative: (cooperativeId: string, status?: string) =>
    request<Payment[]>(
      `/cooperatives/${cooperativeId}/payments${status ? `?status=${status}` : ""}`,
      { method: "GET" },
      true,
    ),

  listPaymentsForMember: (cooperativeId: string, userId: string) =>
    request<Payment[]>(`/cooperatives/${cooperativeId}/members/${userId}/payments`, { method: "GET" }, true),

  verifyPayment: (cooperativeId: string, paymentId: string) =>
    request<Payment>(`/cooperatives/${cooperativeId}/payments/${paymentId}/verify`, { method: "POST" }, true),

  verifyPaymentByReference: (cooperativeId: string, reference: string) =>
    request<Payment>(
      `/cooperatives/${cooperativeId}/payments/by-reference/${reference}/verify`,
      { method: "POST" },
      true,
    ),

  listBanks: () => request<PaystackBank[]>("/cooperatives/payments/banks", { method: "GET" }, true),

  getBankAccountStatus: (cooperativeId: string) =>
    request<BankAccountStatus>(`/cooperatives/${cooperativeId}/payments/bank-account`, { method: "GET" }, true),

  connectBankAccount: (cooperativeId: string, data: { bankCode: string; accountNumber: string }) =>
    request<BankAccountStatus>(
      `/cooperatives/${cooperativeId}/payments/bank-account`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listAccounts: (cooperativeId: string) =>
    request<Account[]>(`/cooperatives/${cooperativeId}/accounting/accounts`, { method: "GET" }, true),

  createAccount: (cooperativeId: string, data: { code: string; name: string; type: AccountType }) =>
    request<Account>(
      `/cooperatives/${cooperativeId}/accounting/accounts`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  createJournalEntry: (
    cooperativeId: string,
    data: { memo?: string; lines: { accountId: string; debit?: number; credit?: number }[] },
  ) =>
    request<JournalEntry>(
      `/cooperatives/${cooperativeId}/accounting/journal-entries`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listJournalEntries: (cooperativeId: string, accountId?: string) =>
    request<JournalEntry[]>(
      `/cooperatives/${cooperativeId}/accounting/journal-entries${accountId ? `?accountId=${accountId}` : ""}`,
      { method: "GET" },
      true,
    ),

  getTrialBalance: (cooperativeId: string) =>
    request<TrialBalanceRow[]>(`/cooperatives/${cooperativeId}/accounting/trial-balance`, { method: "GET" }, true),

  getIncomeStatement: (cooperativeId: string) =>
    request<IncomeStatement>(`/cooperatives/${cooperativeId}/accounting/income-statement`, { method: "GET" }, true),

  getBalanceSheet: (cooperativeId: string) =>
    request<BalanceSheet>(`/cooperatives/${cooperativeId}/accounting/balance-sheet`, { method: "GET" }, true),

  upsertBudget: (cooperativeId: string, data: { accountId: string; period: string; plannedAmount: number }) =>
    request<Budget>(
      `/cooperatives/${cooperativeId}/accounting/budgets`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  getBudgetVsActual: (cooperativeId: string, period?: string) =>
    request<BudgetVsActual[]>(
      `/cooperatives/${cooperativeId}/accounting/budgets${period ? `?period=${period}` : ""}`,
      { method: "GET" },
      true,
    ),

  createMeeting: (
    cooperativeId: string,
    data: {
      title: string;
      type?: MeetingType;
      scheduledAt: string;
      location?: string;
      agendaItems?: { title: string; description?: string }[];
    },
  ) => request<Meeting>(`/cooperatives/${cooperativeId}/meetings`, { method: "POST", body: JSON.stringify(data) }, true),

  listMeetings: (cooperativeId: string) =>
    request<Meeting[]>(`/cooperatives/${cooperativeId}/meetings`, { method: "GET" }, true),

  getMeeting: (cooperativeId: string, meetingId: string) =>
    request<Meeting>(`/cooperatives/${cooperativeId}/meetings/${meetingId}`, { method: "GET" }, true),

  updateMeeting: (
    cooperativeId: string,
    meetingId: string,
    data: Partial<{ title: string; type: MeetingType; scheduledAt: string; location: string; status: MeetingStatus }>,
  ) =>
    request<Meeting>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}`,
      { method: "PATCH", body: JSON.stringify(data) },
      true,
    ),

  recordMeetingMinutes: (cooperativeId: string, meetingId: string, minutes: string) =>
    request<Meeting>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}/minutes`,
      { method: "POST", body: JSON.stringify({ minutes }) },
      true,
    ),

  rsvpToMeeting: (cooperativeId: string, meetingId: string, status: "CONFIRMED" | "DECLINED") =>
    request<Attendance>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}/rsvp`,
      { method: "POST", body: JSON.stringify({ status }) },
      true,
    ),

  listMeetingAttendance: (cooperativeId: string, meetingId: string) =>
    request<Attendance[]>(`/cooperatives/${cooperativeId}/meetings/${meetingId}/attendance`, { method: "GET" }, true),

  recordMeetingAttendance: (
    cooperativeId: string,
    meetingId: string,
    userId: string,
    status: "ATTENDED" | "ABSENT" | "EXCUSED",
  ) =>
    request<Attendance>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}/attendance/${userId}`,
      { method: "POST", body: JSON.stringify({ status }) },
      true,
    ),

  proposeResolution: (
    cooperativeId: string,
    meetingId: string,
    data: { agendaItemId?: string; title: string; description?: string },
  ) =>
    request<Resolution>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listResolutions: (cooperativeId: string, meetingId: string) =>
    request<Resolution[]>(`/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions`, { method: "GET" }, true),

  castVote: (cooperativeId: string, meetingId: string, resolutionId: string, choice: VoteChoice) =>
    request<Vote>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/vote`,
      { method: "POST", body: JSON.stringify({ choice }) },
      true,
    ),

  closeResolution: (cooperativeId: string, meetingId: string, resolutionId: string) =>
    request<Resolution>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/close`,
      { method: "POST" },
      true,
    ),

  withdrawResolution: (cooperativeId: string, meetingId: string, resolutionId: string) =>
    request<Resolution>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/withdraw`,
      { method: "POST" },
      true,
    ),

  uploadDocument: (
    cooperativeId: string,
    data: { title: string; category?: DocumentCategory; fileName: string; mimeType: string; contentBase64: string },
  ) =>
    request<DocumentMetadata>(
      `/cooperatives/${cooperativeId}/documents`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listDocuments: (cooperativeId: string) =>
    request<DocumentMetadata[]>(`/cooperatives/${cooperativeId}/documents`, { method: "GET" }, true),

  deleteDocument: (cooperativeId: string, documentId: string) =>
    request<void>(`/cooperatives/${cooperativeId}/documents/${documentId}`, { method: "DELETE" }, true),

  sendAnnouncement: (
    cooperativeId: string,
    data: { channel: NotificationChannel; subject?: string; body: string },
  ) =>
    request<AppNotification[]>(
      `/cooperatives/${cooperativeId}/notifications/announcements`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listMyNotifications: (cooperativeId: string) =>
    request<AppNotification[]>(`/cooperatives/${cooperativeId}/notifications`, { method: "GET" }, true),

  listAllNotifications: (cooperativeId: string) =>
    request<AppNotification[]>(`/cooperatives/${cooperativeId}/notifications/all`, { method: "GET" }, true),

  getDashboard: (cooperativeId: string) =>
    request<DashboardSummary>(`/cooperatives/${cooperativeId}/dashboard`, { method: "GET" }, true),

  getDashboardTrends: (cooperativeId: string, months = 6) =>
    request<TrendPoint[]>(`/cooperatives/${cooperativeId}/dashboard/trends?months=${months}`, { method: "GET" }, true),

  generateMonthlyDigest: (cooperativeId: string) =>
    request<DocumentMetadata>(
      `/cooperatives/${cooperativeId}/reports/monthly-digest`,
      { method: "POST" },
      true,
    ),

  askAssistant: (cooperativeId: string, question: string) =>
    request<{ answer: string }>(
      `/cooperatives/${cooperativeId}/ai/assistant`,
      { method: "POST", body: JSON.stringify({ question }) },
      true,
    ),

  summarizeMeeting: (cooperativeId: string, meetingId: string) =>
    request<{ aiSummary: string }>(
      `/cooperatives/${cooperativeId}/meetings/${meetingId}/summarize`,
      { method: "POST" },
      true,
    ),

  getLoanRiskScore: (cooperativeId: string, loanId: string) =>
    request<LoanRiskScore>(`/cooperatives/${cooperativeId}/loans/${loanId}/risk-score`, { method: "GET" }, true),

  getFraudAlerts: (cooperativeId: string) =>
    request<FraudAlert[]>(`/cooperatives/${cooperativeId}/fraud-alerts`, { method: "GET" }, true),

  // Kesa: Module 1 -- Contribution Engine (Ajo/Esusu)
  createContributionGroup: (
    cooperativeId: string,
    data: {
      name: string;
      type: ContributionGroupType;
      coordinatorEmail: string;
      contributionAmount: number;
      frequency: ContributionFrequency;
      targetAmount?: number;
    },
  ) =>
    request<ContributionGroup>(
      `/cooperatives/${cooperativeId}/contribution-groups`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listContributionGroups: (cooperativeId: string) =>
    request<ContributionGroup[]>(`/cooperatives/${cooperativeId}/contribution-groups`, { method: "GET" }, true),

  getContributionGroup: (cooperativeId: string, groupId: string) =>
    request<ContributionGroup>(
      `/cooperatives/${cooperativeId}/contribution-groups/${groupId}`,
      { method: "GET" },
      true,
    ),

  addGroupMember: (cooperativeId: string, groupId: string, email: string) =>
    request<ContributionGroupMember>(
      `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/members`,
      { method: "POST", body: JSON.stringify({ email }) },
      true,
    ),

  recordContributionPeriod: (
    cooperativeId: string,
    groupId: string,
    data: { dueDate: string; amount?: number },
  ) =>
    request<Contribution[]>(
      `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/contributions`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listContributions: (cooperativeId: string, groupId: string) =>
    request<Contribution[]>(
      `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/contributions`,
      { method: "GET" },
      true,
    ),

  confirmContribution: (cooperativeId: string, groupId: string, contributionId: string) =>
    request<Contribution>(
      `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/contributions/${contributionId}/confirm`,
      { method: "PATCH" },
      true,
    ),

  flagContribution: (
    cooperativeId: string,
    groupId: string,
    contributionId: string,
    status: "LATE" | "DEFAULTED",
  ) =>
    request<Contribution>(
      `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/contributions/${contributionId}/flag`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      true,
    ),

  getGroupTrustScore: (cooperativeId: string, groupId: string) =>
    request<GroupTrustScore>(
      `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/trust-score`,
      { method: "GET" },
      true,
    ),

  getMemberTrustScore: (cooperativeId: string, userId: string) =>
    request<TrustScore>(`/cooperatives/${cooperativeId}/members/${userId}/trust-score`, { method: "GET" }, true),

  // Kesa: Module 2 -- Land Banking
  createLandParcel: (
    cooperativeId: string,
    data: {
      location: string;
      coordinatesMinna?: string;
      coordinatesWgs84?: string;
      priceNaira: number;
      sizeSqm?: number;
      titleStatus?: string;
      disputeCheckNotes?: string;
      verificationScore?: number;
    },
  ) =>
    request<LandParcel>(
      `/cooperatives/${cooperativeId}/land-parcels`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),

  listLandParcels: (cooperativeId: string) =>
    request<LandParcel[]>(`/cooperatives/${cooperativeId}/land-parcels`, { method: "GET" }, true),

  updateLandParcel: (
    cooperativeId: string,
    parcelId: string,
    data: Partial<{
      location: string;
      coordinatesMinna: string;
      coordinatesWgs84: string;
      priceNaira: number;
      sizeSqm: number;
      titleStatus: string;
      disputeCheckNotes: string;
      verificationScore: number;
    }>,
  ) =>
    request<LandParcel>(
      `/cooperatives/${cooperativeId}/land-parcels/${parcelId}`,
      { method: "PATCH", body: JSON.stringify(data) },
      true,
    ),

  publishLandParcel: (cooperativeId: string, parcelId: string) =>
    request<LandParcel>(
      `/cooperatives/${cooperativeId}/land-parcels/${parcelId}/publish`,
      { method: "POST" },
      true,
    ),

  reserveParcel: (cooperativeId: string, parcelId: string, groupId: string) =>
    request<ParcelReservation>(
      `/cooperatives/${cooperativeId}/land-parcels/${parcelId}/reservations`,
      { method: "POST", body: JSON.stringify({ groupId }) },
      true,
    ),

  listReservationsForParcel: (cooperativeId: string, parcelId: string) =>
    request<ParcelReservation[]>(
      `/cooperatives/${cooperativeId}/land-parcels/${parcelId}/reservations`,
      { method: "GET" },
      true,
    ),

  getReservation: (cooperativeId: string, reservationId: string) =>
    request<ParcelReservation>(`/cooperatives/${cooperativeId}/reservations/${reservationId}`, { method: "GET" }, true),

  confirmReservation: (cooperativeId: string, reservationId: string) =>
    request<ParcelReservation>(
      `/cooperatives/${cooperativeId}/reservations/${reservationId}/confirm`,
      { method: "PATCH" },
      true,
    ),

  cancelReservation: (cooperativeId: string, reservationId: string) =>
    request<ParcelReservation>(
      `/cooperatives/${cooperativeId}/reservations/${reservationId}/cancel`,
      { method: "PATCH" },
      true,
    ),

  // Kesa: Module 3 -- Property Syndication
  initiateSyndication: (cooperativeId: string, reservationId: string) =>
    request<Syndication>(
      `/cooperatives/${cooperativeId}/reservations/${reservationId}/syndication`,
      { method: "POST" },
      true,
    ),

  listSyndications: (cooperativeId: string) =>
    request<Syndication[]>(`/cooperatives/${cooperativeId}/syndications`, { method: "GET" }, true),

  getSyndication: (cooperativeId: string, syndicationId: string) =>
    request<Syndication>(`/cooperatives/${cooperativeId}/syndications/${syndicationId}`, { method: "GET" }, true),

  fundEscrow: (
    cooperativeId: string,
    syndicationId: string,
    data: { escrowPartnerRef: string; amount: number },
  ) =>
    request<Syndication>(
      `/cooperatives/${cooperativeId}/syndications/${syndicationId}/fund-escrow`,
      { method: "PATCH", body: JSON.stringify(data) },
      true,
    ),

  verifyMilestone: (
    cooperativeId: string,
    syndicationId: string,
    milestoneId: string,
    proofNotes?: string,
  ) =>
    request<SyndicationMilestone>(
      `/cooperatives/${cooperativeId}/syndications/${syndicationId}/milestones/${milestoneId}/verify`,
      { method: "PATCH", body: JSON.stringify({ proofNotes }) },
      true,
    ),

  releaseMilestone: (cooperativeId: string, syndicationId: string, milestoneId: string) =>
    request<SyndicationMilestone>(
      `/cooperatives/${cooperativeId}/syndications/${syndicationId}/milestones/${milestoneId}/release`,
      { method: "PATCH" },
      true,
    ),

  recordAllocation: (
    cooperativeId: string,
    syndicationId: string,
    data: { memberEmail: string; plotRef: string; documentIds?: string[] },
  ) =>
    request<Allocation>(
      `/cooperatives/${cooperativeId}/syndications/${syndicationId}/allocations`,
      { method: "POST", body: JSON.stringify(data) },
      true,
    ),
};

// Skip the generic account hub whenever we can jump straight to somewhere
// useful: a member/admin with exactly one cooperative goes straight to its
// dashboard; SUPER_ADMIN/REGULATOR (who have platform-wide destinations of
// their own) and anyone with zero or multiple cooperatives land on the hub.
export async function postLoginDestination(): Promise<string> {
  try {
    const me = await api.me();
    if (me.role === "SUPER_ADMIN" || me.role === "REGULATOR") {
      return "/dashboard";
    }
    const cooperatives = await api.listCooperatives();
    if (cooperatives.length === 1) {
      return `/cooperatives/${cooperatives[0].id}`;
    }
  } catch {
    // fall through to the hub page if anything here fails
  }
  return "/dashboard";
}

/** Fetches a binary file (PDF, document download) with the auth header attached, for triggering a browser save-as. */
export async function downloadFile(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    throw new ApiError("Download failed", res.status);
  }
  return res.blob();
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
