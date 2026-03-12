# Hello World — Multi-Tenant Auth Scaffold

An elaborate "Hello World" app demonstrating multi-tenant authentication with Supabase, Hono, and React.

## Architecture

```
apps/
  api/     Hono API (port 3000)
  web/     React tenant-facing app (port 5173) — login, invite acceptance, hello world board,
           and (for tenant admins) /t/:slug/members member management panel
  admin/   React superadmin-only app (port 5174) — tenant creation and management
packages/
  types/   Shared TypeScript types
supabase/
  migrations/  SQL schema + RLS policies
```

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) hosted project (free tier works)
- `supabase` CLI: `npm install -g supabase`

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to each app:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
```

Fill in your Supabase URL, anon key, and service role key in each `.env` file.

### 3. Apply database migrations

Link your Supabase project and push migrations:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Alternatively, paste `supabase/migrations/0001_initial_schema.sql` into the Supabase SQL Editor.

### 4. Create the superadmin user

In the Supabase dashboard → Authentication → Add user:
- Email: `jakericciardi@gmail.com`
- Password: (set a strong password of your choice)

Then run this SQL in the Supabase SQL Editor to set the superadmin role:

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"superadmin"'
) || '{"tenant_id": null}'::jsonb
WHERE email = 'jakericciardi@gmail.com';
```

### 5. Run the dev server

```bash
npm run dev
```

This starts all three apps simultaneously:
- API: http://localhost:3000
- Web: http://localhost:5173
- Admin: http://localhost:5174

---

## User Flows

### Superadmin flow
1. Open http://localhost:5174/login (admin app)
2. Sign in as `jakericciardi@gmail.com`
3. Create a new tenant (name, slug, admin email)
4. Copy the invite URL from the banner
5. Send the invite URL to the tenant admin

### Tenant admin flow
1. Open the invite URL (http://localhost:5173/invite?token=...)
2. Set a password (10+ chars)
3. Open http://localhost:5173/login and sign in → lands on the Hello World board
4. Click **Manage members →** in the header
5. Invite a user, copy the invite URL and share it

### User flow
1. Open the invite URL
2. Set a password
3. Open http://localhost:5173/login and sign in
4. See the elaborate Hello World display

---

## Roles

| Role | Description | Login app | Landing |
|------|-------------|-----------|---------|
| `superadmin` | Operator (Jake) | :5174 (admin) | `/tenants` |
| `tenant_admin` | Tenant administrator | :5173 (web) | `/t/:slug` then → `/t/:slug/members` |
| `user` | Tenant end-user | :5173 (web) | `/t/:slug` |

> **Key distinction**: the admin app (`:5174`) is the superadmin-only operator console. Tenant admins and users live entirely inside the web app (`:5173`).

---

## Tech Stack

- **API**: Hono + Node.js + TypeScript + Zod
- **Frontend**: React 18 + TypeScript + Vite + TanStack Query v5
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (Postgres + Auth + RLS)
- **Monorepo**: npm workspaces
