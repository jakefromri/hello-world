import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { JwtClaims } from '@hello-world/types';
import { ErrorCode } from '@hello-world/types';
import { supabaseAuth, supabaseAdmin } from '../lib/supabase.js';

export interface AuthContext {
  user_id: string;
  role: JwtClaims['role'];
  tenant_id: string | null;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: JSON.stringify({ error: 'Missing authorization token', code: ErrorCode.UNAUTHORIZED }),
    });
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    throw new HTTPException(401, {
      message: JSON.stringify({ error: 'Invalid or expired token', code: ErrorCode.UNAUTHORIZED }),
    });
  }

  const meta = data.user.app_metadata as Partial<JwtClaims>;
  const role = meta.role;
  const tenant_id = meta.tenant_id ?? null;

  if (!role) {
    throw new HTTPException(401, {
      message: JSON.stringify({ error: 'Token missing role claim', code: ErrorCode.UNAUTHORIZED }),
    });
  }

  // Check tenant status if user belongs to a tenant
  if (tenant_id && role !== 'superadmin') {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('status')
      .eq('id', tenant_id)
      .single();

    if (tenant?.status === 'deactivated') {
      throw new HTTPException(403, {
        message: JSON.stringify({
          error: 'This organization is no longer active',
          code: ErrorCode.TENANT_DEACTIVATED,
        }),
      });
    }
  }

  c.set('auth', { user_id: data.user.id, role, tenant_id });
  await next();
});

export const requireRole = (...roles: JwtClaims['role'][]) =>
  createMiddleware(async (c, next) => {
    const auth = c.get('auth');
    if (!roles.includes(auth.role)) {
      throw new HTTPException(403, {
        message: JSON.stringify({ error: 'Insufficient permissions', code: ErrorCode.FORBIDDEN }),
      });
    }
    await next();
  });
