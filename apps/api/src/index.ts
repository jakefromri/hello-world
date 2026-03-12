import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { serve } from '@hono/node-server';

import invitesRouter from './routes/invites.js';
import adminRouter from './routes/admin.js';
import tenantRouter from './routes/tenant.js';

const app = new Hono();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use('*', logger());
app.use('*', cors({
  origin: [
    process.env.WEB_URL ?? 'http://localhost:5173',
    process.env.ADMIN_URL ?? 'http://localhost:5174',
  ],
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/invites', invitesRouter);
app.route('/api/admin', adminRouter);
app.route('/api/tenant', tenantRouter);

// ─── Error handling ───────────────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    try {
      const body = JSON.parse(err.message);
      return c.json(body, err.status);
    } catch {
      return c.json({ error: err.message }, err.status);
    }
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─── Server ───────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? '3000');

serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`);
});

export default app;
