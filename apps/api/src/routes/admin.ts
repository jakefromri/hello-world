import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ErrorCode } from '@hello-world/types';
import { supabaseAdmin } from '../lib/supabase.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { nanoid } from 'nanoid';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', requireRole('superadmin'));

// ─── GET /api/admin/tenants ───────────────────────────────────────────────────

router.get('/tenants', async (c) => {
  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message, code: ErrorCode.VALIDATION_ERROR }, 500);

  // Enrich with membership count
  const enriched = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const { count: userCount } = await supabaseAdmin
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id);
      return { ...t, user_count: userCount ?? 0 };
    })
  );

  return c.json({ tenants: enriched });
});

// ─── POST /api/admin/tenants ──────────────────────────────────────────────────

const slugRegex = /^[a-z0-9-]+$/;

const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1).regex(slugRegex, 'Slug must be lowercase letters, numbers, and hyphens only'),
  admin_email: z.string().email('A valid admin email is required'),
});

router.post('/tenants', zValidator('json', createTenantSchema), async (c) => {
  const auth = c.get('auth');
  const { name, slug, admin_email } = c.req.valid('json');

  // Check slug uniqueness
  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    return c.json({ error: 'Slug already taken', code: ErrorCode.TENANT_SLUG_TAKEN }, 409);
  }

  // Create tenant
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({ name, slug })
    .select()
    .single();

  if (tenantError) return c.json({ error: tenantError.message, code: ErrorCode.VALIDATION_ERROR }, 400);

  // Atomically create invite for first tenant admin
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('invites')
    .insert({
      tenant_id: tenant.id,
      email: admin_email,
      role: 'tenant_admin',
      token,
      expires_at: expiresAt,
      created_by: auth.user_id,
    })
    .select()
    .single();

  if (inviteError) {
    // Rollback: delete the tenant we just created
    await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
    return c.json({ error: 'Failed to create tenant admin invite — tenant rolled back', code: ErrorCode.VALIDATION_ERROR }, 500);
  }

  const inviteUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/invite?token=${token}`;

  return c.json({
    tenant,
    invite: {
      id: invite.id,
      email: invite.email,
      expires_at: invite.expires_at,
      invite_url: inviteUrl,
    },
  }, 201);
});

// ─── PATCH /api/admin/tenants/:id ────────────────────────────────────────────

const updateTenantSchema = z.object({
  status: z.enum(['active', 'deactivated']),
});

router.patch('/tenants/:id', zValidator('json', updateTenantSchema), async (c) => {
  const id = c.req.param('id');
  const { status } = c.req.valid('json');

  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('id', id)
    .single();

  if (!existing) {
    return c.json({ error: 'Tenant not found', code: ErrorCode.NOT_FOUND }, 404);
  }

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message, code: ErrorCode.VALIDATION_ERROR }, 400);

  return c.json({ tenant: data });
});

export default router;
