-- 0001_initial_schema.sql
-- Hello World — initial schema
-- Multi-tenant auth scaffold: tenants, memberships, invites

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── Tenants ─────────────────────────────────────────────────────────────────

create table tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  status      text not null default 'active' check (status in ('active', 'deactivated')),
  created_at  timestamptz not null default now()
);

alter table tenants enable row level security;

-- Superadmin: full access
create policy superadmin_all on tenants
  using (auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin')
  with check (auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin');

-- Tenant members: read ONLY their own tenant (required for login redirect)
create policy tenant_members_read_own on tenants
  for select using (
    id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    and auth.jwt() -> 'app_metadata' ->> 'role' in ('tenant_admin', 'user')
  );

-- ─── Memberships ─────────────────────────────────────────────────────────────

create table memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('tenant_admin', 'user')),
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

alter table memberships enable row level security;

-- Users can read their own membership
create policy user_read_own on memberships
  for select using (user_id = auth.uid());

-- Tenant admins can read all memberships in their tenant
create policy tenant_admin_read_own_tenant on memberships
  for select using (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    and auth.jwt() -> 'app_metadata' ->> 'role' = 'tenant_admin'
  );

-- Superadmin: full access
create policy superadmin_all on memberships
  using (auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin')
  with check (auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin');

-- ─── Invites ─────────────────────────────────────────────────────────────────

create table invites (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  role        text not null default 'user' check (role in ('tenant_admin', 'user')),
  token       text not null unique,
  expires_at  timestamptz not null default (now() + interval '72 hours'),
  accepted_at timestamptz,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

alter table invites enable row level security;

-- No client reads — API always uses service role for invites
create policy superadmin_all on invites
  using (auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin')
  with check (auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin');
