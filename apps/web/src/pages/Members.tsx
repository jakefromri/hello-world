import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Member } from '@hello-world/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  }).then(async (r) => {
    const json = await r.json();
    if (!r.ok) throw json;
    return json as T;
  });
}

export default function Members() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { token, session } = useAuth();
  const qc = useQueryClient();

  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'tenant_admin'>('user');
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<{ members: Member[] }>('/api/tenant/members', token!),
    enabled: !!token,
  });

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role: 'user' | 'tenant_admin' }) =>
      apiFetch<{ invite: { invite_url: string } }>('/api/tenant/members/invite', token!, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      setInviteResult(res.invite?.invite_url ?? 'Invite created');
      setEmail('');
      setInviting(false);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (e: { error?: string }) => setFormError(e.error ?? 'Error sending invite'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/tenant/members/${userId}`, token!, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      setConfirmRemove(null);
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const members: Member[] = (data as { members: Member[] })?.members ?? [];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header — matches Board.tsx */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/t/${slug}`)}
            className="text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            ← Board
          </button>
          <span className="text-white/20">|</span>
          <span className="text-white/70 text-sm font-medium">Members</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-xs">{session?.user.email}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/40 hover:text-white hover:bg-white/10 text-xs"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">Members</h1>
            <p className="text-sm text-white/40 mt-0.5">Manage who has access to your organization</p>
          </div>
          <Button
            onClick={() => { setInviting(true); setInviteResult(null); }}
            className="bg-white text-slate-900 hover:bg-white/90"
          >
            + Invite member
          </Button>
        </div>

        {/* Invite URL banner */}
        {inviteResult && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-medium text-emerald-400 mb-2">
              Invite link created — share this with the new member:
            </p>
            <p className="text-xs font-mono text-emerald-300/80 break-all bg-emerald-500/10 rounded px-3 py-2">
              {inviteResult}
            </p>
            <button
              onClick={() => setInviteResult(null)}
              className="text-emerald-500/60 hover:text-emerald-400 text-xs mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Invite form */}
        {inviting && (
          <Card className="mb-6 bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">Invite member</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="invite-email" className="text-white/60">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="member@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role" className="text-white/60">Role</Label>
                  <select
                    id="invite-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'user' | 'tenant_admin')}
                    className="flex h-9 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                  >
                    <option value="user" className="bg-slate-900">User</option>
                    <option value="tenant_admin" className="bg-slate-900">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-white text-slate-900 hover:bg-white/90"
                  onClick={() => { setFormError(null); inviteMutation.mutate({ email, role }); }}
                  disabled={!email || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/50 hover:text-white hover:bg-white/10"
                  onClick={() => { setInviting(false); setFormError(null); }}
                >
                  Cancel
                </Button>
              </div>
              {formError && (
                <p className="text-sm text-red-400 bg-red-400/10 rounded px-3 py-2 mt-3">
                  {formError}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Members table */}
        {isLoading ? (
          <p className="text-white/40 text-sm">Loading members…</p>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/30 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-white/30 text-sm">
                      No members yet. Invite someone above.
                    </td>
                  </tr>
                )}
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-medium">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          m.role === 'tenant_admin'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 border'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 border'
                        }
                      >
                        {m.role === 'tenant_admin' ? 'Admin' : 'User'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-white/30">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmRemove === m.user_id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30"
                            variant="outline"
                            onClick={() => removeMutation.mutate(m.user_id)}
                            disabled={removeMutation.isPending}
                          >
                            Confirm remove
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/40 hover:text-white hover:bg-white/10"
                            onClick={() => setConfirmRemove(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400/50 hover:text-red-400 hover:bg-red-500/10 text-xs"
                          onClick={() => setConfirmRemove(m.user_id)}
                        >
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
