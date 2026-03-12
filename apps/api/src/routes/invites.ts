import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ErrorCode } from '@hello-world/types';
import { supabaseAdmin } from '../lib/supabase.js';

const router = new Hono();

const acceptSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
});

// POST /api/invites/accept — public (no auth required)
router.post('/accept', zValidator('json', acceptSchema), async (c) => {
  const { token, password } = c.req.valid('json');

  // Look up invite by token
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('invites')
    .select('*')
    .eq('token', token)
    .single();

  if (inviteError || !invite) {
    return c.json({ error: 'Invite not found', code: ErrorCode.INVITE_NOT_FOUND }, 400);
  }

  if (invite.accepted_at) {
    return c.json({ error: 'Invite already accepted', code: ErrorCode.INVITE_ALREADY_ACCEPTED }, 409);
  }

  if (new Date(invite.expires_at) < new Date()) {
    return c.json({ error: 'Invite has expired', code: ErrorCode.INVITE_EXPIRED }, 400);
  }

  // Create Supabase auth user with role + tenant_id in app_metadata
  const { data: newUser, error: signupError } = await supabaseAdmin.auth.admin.createUser({
    email: invite.email,
    password,
    app_metadata: {
      role: invite.role,
      tenant_id: invite.tenant_id,
    },
    email_confirm: true,
  });

  if (signupError) {
    if (signupError.message.includes('already been registered')) {
      return c.json({ error: 'Email already registered', code: ErrorCode.ALREADY_A_MEMBER }, 409);
    }
    if (signupError.message.toLowerCase().includes('password')) {
      return c.json({ error: signupError.message, code: ErrorCode.WEAK_PASSWORD }, 400);
    }
    return c.json({ error: signupError.message, code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  // Create membership record
  await supabaseAdmin.from('memberships').insert({
    tenant_id: invite.tenant_id,
    user_id: newUser.user.id,
    role: invite.role,
  });

  // Mark invite as accepted
  await supabaseAdmin
    .from('invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  return c.json({
    message: 'Account created. Please sign in.',
    user: { id: newUser.user.id, email: invite.email },
  }, 201);
});

export default router;
