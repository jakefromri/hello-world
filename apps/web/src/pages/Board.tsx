import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Tenant } from '@hello-world/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const roleLabel: Record<string, string> = {
  tenant_admin: 'Admin',
  user: 'User',
  superadmin: 'Superadmin',
};

const roleColor: Record<string, string> = {
  tenant_admin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  user: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  superadmin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export default function Board() {
  const navigate = useNavigate();
  const { session, claims } = useAuth();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, status, created_at')
        .single();
      if (error) throw error;
      return data as Tenant;
    },
    enabled: !!session,
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-white/50">
          <span className="animate-spin text-xl">⟳</span>
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  const role = claims?.role ?? 'user';
  const now = new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 overflow-hidden relative">

      {/* Decorative grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-white/40 text-xs font-mono">live</span>
          </div>
          <span className="text-white/20 text-sm">|</span>
          {tenant ? (
            <span className="text-white/70 text-sm font-medium">{tenant.name}</span>
          ) : (
            <span className="text-white/30 text-sm">—</span>
          )}
          {role === 'tenant_admin' && tenant?.slug && (
            <>
              <span className="text-white/20 text-sm">|</span>
              <Link
                to={`/t/${tenant.slug}/members`}
                className="text-white/40 hover:text-white/80 text-xs transition-colors"
              >
                Manage members →
              </Link>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/40 hover:text-white hover:bg-white/10 text-xs"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">

        {/* Tenant pill */}
        {tenant && (
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-white/50 text-xs font-medium mb-10 backdrop-blur">
            <span className="font-mono text-white/30">/t/</span>
            <span className="text-white/70">{tenant.slug}</span>
          </div>
        )}

        {/* Hero text */}
        <h1 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter text-white leading-none mb-6">
          Hello,{' '}
          <br className="sm:hidden" />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            World!
          </span>
        </h1>

        <p className="text-white/40 text-base max-w-sm mb-16">
          Signed in as{' '}
          <span className="text-white/70 font-medium">{session?.user.email}</span>
        </p>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-16">

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm text-left">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-white/30 text-[11px] uppercase tracking-widest font-medium">
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <p className="text-white font-medium text-sm break-all mb-2">
                {session?.user.email}
              </p>
              <span
                className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${roleColor[role] ?? roleColor.user}`}
              >
                {roleLabel[role] ?? role}
              </span>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm text-left">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-white/30 text-[11px] uppercase tracking-widest font-medium">
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <p className="text-white font-medium text-sm mb-1">{tenant?.name ?? '—'}</p>
              <p className="text-white/30 text-xs font-mono">{tenant?.slug ?? '—'}</p>
              {tenant?.status === 'active' && (
                <span className="inline-flex items-center gap-1 mt-2 text-emerald-400/70 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                  Active
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm text-left">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-white/30 text-[11px] uppercase tracking-widest font-medium">
                Session
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <p className="text-white font-medium text-sm">
                {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-white/30 text-xs mt-1">
                {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-white/20 text-[11px] mt-1 font-mono">
                {session?.user.id?.slice(0, 8)}…
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stack footer */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-white/15 text-xs font-mono">
          <span>Hono · :3000</span>
          <span className="text-white/10">·</span>
          <span>React + Vite · :5173</span>
          <span className="text-white/10">·</span>
          <span>Supabase Auth + RLS</span>
          <span className="text-white/10">·</span>
          <span>shadcn/ui</span>
        </div>
      </main>
    </div>
  );
}
