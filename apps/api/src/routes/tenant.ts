import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ErrorCode } from '@hello-world/types';
import { supabaseAdmin } from '../lib/supabase.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { nanoid } from 'nanoid';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', requireRole('tenant_admin'));

// ─── GET /api/tenant/members ──────────────────────────────────────────────────

router.get('/members', async (c) => {
  const auth = c.get('auth');

  const { data, error } = await supabaseAdmin
    .from('memberships')
    .select('id, user_id, role, created_at, auth.users(email)')
    .eq('tenant_id', auth.tenant_id!);

  if (error) return c.json({ error: error.message, code: ErrorCode.VALIDATION_ERROR }, 500);

  const members = (data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id,
    user_id: m.user_id,
    email: (m['auth.users'] as { email?: string } | null)?.email ?? '',
    role: m.role,
    created_at: m.created_at,
  }));

  return c.json({ members });
});

// ─── POST /api/tenant/members/invite ─────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['tenant_admin', 'user']),
});

router.post('/members/invite', zValidator('json', inviteSchema), async (c) => {
  const auth = c.get('auth');
  const { email, role } = c.req.valid('json');

  // Check if already a member
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const matchingUser = existingUsers?.users.find((u) => u.email === email);

  if (matchingUser) {
    const { data: existingMembership } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('tenant_id', auth.tenant_id!)
      .eq('user_id', matchingUser.id)
      .single();

    if (existingMembership) {
      return c.json({ error: 'User is already a member', code: ErrorCode.ALREADY_A_MEMBER }, 409);
    }
  }

  // Check for pending invite
  const { data: pendingInvite } = await supabaseAdmin
    .from('invites')
    .select('id')
    .eq('tenant_id', auth.tenant_id!)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (pendingInvite) {
    return c.json({ error: 'A pending invite already exists for this email', code: ErrorCode.INVITE_ALREADY_PENDING }, 409);
  }

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await supabaseAdmin
    .from('invites')
    .insert({
      tenant_id: auth.tenant_id!,
      email,
      role,
      token,
      expires_at: expiresAt,
      created_by: auth.user_id,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message, code: ErrorCode.VALIDATION_ERROR }, 500);

  const inviteUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/invite?token=${token}`;

  return c.json({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expires_at: invite.expires_at,
      invite_url: inviteUrl,
    },
  }, 201);
});

// ─── DELETE /api/tenant/members/:user_id ──────────────────────────────────────

router.delete('/members/:user_id', async (c) => {
  const auth = c.get('auth');
  const userId = c.req.param('user_id');

  if (userId === auth.user_id) {
    return c.json({ error: 'Cannot remove yourself', code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  const { data: existing } = await supabaseAdmin
    .from('memberships')
    .select('id')
    .eq('tenant_id', auth.tenant_id!)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    return c.json({ error: 'Member not found', code: ErrorCode.NOT_FOUND }, 404);
  }

  const { error } = await supabaseAdmin
    .from('memberships')
    .delete()
    .eq('tenant_id', auth.tenant_id!)
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message, code: ErrorCode.VALIDATION_ERROR }, 500);

  return c.json({ success: true });
});

export default router;
