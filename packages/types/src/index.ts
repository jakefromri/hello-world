// ─── Database row types ───────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'deactivated';
  created_at: string;
}

export interface TenantSummary extends Tenant {
  user_count: number;
}

export interface Membership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'tenant_admin' | 'user';
  created_at: string;
}

export interface Invite {
  id: string;
  tenant_id: string;
  email: string;
  role: 'tenant_admin' | 'user';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_by: string;
  created_at: string;
}

// ─── API request/response types ───────────────────────────────────────────────

export interface Member {
  id: string;
  user_id: string;
  email: string;
  role: 'tenant_admin' | 'user';
  created_at: string;
}

// JWT app_metadata shape
export interface JwtClaims {
  role: 'superadmin' | 'tenant_admin' | 'user';
  tenant_id: string | null;
}

// ─── API Error codes ──────────────────────────────────────────────────────────

export const ErrorCode = {
  INVITE_EXPIRED: 'INVITE_EXPIRED',
  INVITE_NOT_FOUND: 'INVITE_NOT_FOUND',
  INVITE_ALREADY_ACCEPTED: 'INVITE_ALREADY_ACCEPTED',
  INVITE_ALREADY_PENDING: 'INVITE_ALREADY_PENDING',
  ALREADY_A_MEMBER: 'ALREADY_A_MEMBER',
  TENANT_DEACTIVATED: 'TENANT_DEACTIVATED',
  TENANT_SLUG_TAKEN: 'TENANT_SLUG_TAKEN',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export interface ApiError {
  error: string;
  code: ErrorCode;
}
