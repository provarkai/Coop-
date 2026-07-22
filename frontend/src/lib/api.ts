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
};
