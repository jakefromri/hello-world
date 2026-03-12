# Hello World — Reusable Multi-Tenant Template

This project is a **reference implementation** for multi-tenant SaaS auth with Supabase. It demonstrates:
- Superadmin operator console (port 5174)
- Tenant portal with member management (port 5173)
- JWT + RLS authentication
- Atomic tenant + invite creation
- Full auth flow: invite → password setup → login → board

## Using as a template for new projects

### Quick start

```bash
# 1. Copy to new project directory
cp -r /skunkworks/hello-world /skunkworks/my-new-project

# 2. Update package names in all package.json files
# Change @hello-world/* to @my-new-project/*

# 3. Update project name in root package.json
# Change name from "hello-world" to "my-new-project"

# 4. Remove template docs and git history
rm -rf .git TEMPLATE.md
git init

# 5. Run setup script
bash setup.sh
```

### Customization points

**What to keep (don't change):**
- The port boundary rule: `:5174` = superadmin operator, `:5173` = tenant portal
- The RLS policy structure: `superadmin_all` + `tenant_members_read_own` on every tenant-scoped table
- The JWT claims: `role` + `tenant_id` only (no display data)
- The invite-acceptance flow: token → password → account created → auto-redirect to login

**What to customize:**
- Replace "Hello World" board with your actual app UI (still at `/t/:slug`)
- Add more API endpoints under `apps/api/src/routes/`
- Add more tables to `supabase/migrations/0001_initial_schema.sql`
- Add tenant admin features (e.g., settings, billing) under `/t/:slug/*` routes
- Add superadmin features (e.g., usage analytics, org deactivation) under `/admin/*` routes

**Typical additions:**
- Domain model tables (posts, comments, projects, etc.) with `tenant_id` and RLS policies
- Tenant admin settings page at `/t/:slug/settings`
- Superadmin usage dashboard at `/admin/usage`
- Tenant admin billing portal at `/t/:slug/billing`

### File structure reminder

```
my-new-project/
  apps/
    api/          # Hono API — add routes for new features
    web/          # Tenant portal — add pages under /t/:slug/*
    admin/        # Operator console — add pages under /admin/*
  packages/
    types/        # Extend with your domain types
  supabase/
    migrations/   # Add new tables with RLS policies
  setup.sh        # Run this for full Supabase + .env setup
```

### Key patterns to follow

**When adding a new feature:**

1. **Data model**: Add table to `supabase/migrations/` with `tenant_id` column and RLS policies
   ```sql
   create table posts (
     id uuid primary key,
     tenant_id uuid not null references tenants(id),
     title text not null,
     created_by uuid not null references auth.users(id),
     created_at timestamptz default now()
   );

   -- Two policies: superadmin full, tenant members their own
   create policy superadmin_all on posts using (...);
   create policy tenant_members_read_own on posts using (...);
   ```

2. **API route**: Add to `apps/api/src/routes/` with auth middleware
   ```typescript
   import { authMiddleware, requireRole } from '../middleware/auth.js';

   router.post('/posts', authMiddleware, requireRole('tenant_admin'), async (c) => {
     const auth = c.get('auth'); // Contains user_id, role, tenant_id
     // Always enforce tenant_id from JWT, never trust client input
   });
   ```

3. **Web app page**: Add page under `/t/:slug/*` with RLS-backed queries
   ```typescript
   const { data: posts } = await supabase
     .from('posts')
     .select('*')
     .eq('tenant_id', tenantId); // RLS enforces this automatically
   ```

**Testing the three-layer auth:**
- Superadmin: create organization, invite admin
- Tenant admin: accept invite, create users, manage members
- User: accept invite, view organization (no edit rights)

### Lessons learned

See `LESSONS.md` in the parent directory (`/skunkworks/_ralph-loop/LESSONS.md`) for:
- Port boundary rule: `:5174` = operator, `:5173` = tenant
- JWT claims: IDs only, no display data
- RLS policy completeness: two policies per table
- Multi-app navigation: `window.location.href` for cross-app redirects

See `build-report.md` for architecture notes and deviations.

---

**Questions?** Check the Ralph Loop documentation in `/skunkworks/_ralph-loop/agents/` for the full build methodology.
