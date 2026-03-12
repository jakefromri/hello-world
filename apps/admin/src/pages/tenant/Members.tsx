import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Member } from '@hello-world/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  const { token } = useAuth();
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
      apiFetch<{ invite: { invite_url: string; email: string; expires_at: string } }>(
        '/api/tenant/members/invite',
        token!,
        { method: 'POST', body: JSON.stringify(body) }
      ),
    onSuccess: (res) => {
      const url = res.invite?.invite_url;
      setInviteResult(url ?? 'Invite created');
      setEmail('');
      setInviting(false);
      setFormError(null);
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

  const members: Member[] = (data as { members: Member[] })?.members ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your organization's members</p>
        </div>
        <Button
          onClick={() => {
            setInviting(true);
            setInviteResult(null);
          }}
        >
          + Invite member
        </Button>
      </div>

      {/* Invite URL banner */}
      {inviteResult && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium text-emerald-800 mb-2">
              Invite created. Send this link to the new member:
            </p>
            <p className="text-xs font-mono text-emerald-700 break-all bg-emerald-100 rounded px-3 py-2">
              {inviteResult}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-600 hover:text-emerald-800 text-xs mt-2"
              onClick={() => setInviteResult(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invite form */}
      {inviting && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invite member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'user' | 'tenant_admin')}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="user">User</option>
                  <option value="tenant_admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setFormError(null);
                  inviteMutation.mutate({ email, role });
                }}
                disabled={!email || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInviting(false);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
            </div>
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2 mt-3">
                {formError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading members…</p>
      ) : (
        <Card>
          <div className="overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No members yet. Invite one above.
                    </td>
                  </tr>
                )}
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-foreground font-medium">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.role === 'tenant_admin' ? 'default' : 'secondary'}>
                        {m.role === 'tenant_admin' ? 'Admin' : 'User'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmRemove === m.user_id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeMutation.mutate(m.user_id)}
                            disabled={removeMutation.isPending}
                          >
                            Confirm remove
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmRemove(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 border-destructive/30"
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
        </Card>
      )}
    </div>
  );
}
