import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { TenantSummary } from '@hello-world/types';
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

interface CreateResult {
  tenant: TenantSummary;
  invite: { id: string; email: string; expires_at: string; invite_url: string };
}

export default function TenantList() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<CreateResult['invite'] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => apiFetch<{ tenants: TenantSummary[] }>('/api/admin/tenants', token!),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; slug: string; admin_email: string }) =>
      apiFetch<CreateResult>('/api/admin/tenants', token!, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-tenants'] });
      setCreating(false);
      setNewName('');
      setNewSlug('');
      setNewAdminEmail('');
      setFormError(null);
      setInviteResult(res.invite);
    },
    onError: (e: { error?: string }) => setFormError(e.error ?? 'Error creating tenant'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'deactivated' }) =>
      apiFetch(`/api/admin/tenants/${id}`, token!, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenants'] }),
  });

  const tenants: TenantSummary[] = (data as { tenants: TenantSummary[] })?.tenants ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all organizations in the system</p>
        </div>
        <Button onClick={() => { setCreating(true); setInviteResult(null); }}>
          + New tenant
        </Button>
      </div>

      {/* Invite URL banner after tenant creation */}
      {inviteResult && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium text-emerald-800 mb-1">
              Tenant created. Send this invite link to{' '}
              <span className="font-semibold">{inviteResult.email}</span>:
            </p>
            <p className="text-xs font-mono text-emerald-700 break-all bg-emerald-100 rounded px-3 py-2 my-2">
              {inviteResult.invite_url}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-emerald-600">
                Expires {new Date(inviteResult.expires_at).toLocaleString()}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-600 hover:text-emerald-800 text-xs"
                onClick={() => setInviteResult(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create tenant form */}
      {creating && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create tenant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="acme"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Admin email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@acme.com"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setFormError(null);
                  createMutation.mutate({ name: newName, slug: newSlug, admin_email: newAdminEmail });
                }}
                disabled={!newName || !newSlug || !newAdminEmail || createMutation.isPending}
                size="sm"
              >
                {createMutation.isPending ? 'Creating…' : 'Create tenant'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCreating(false); setFormError(null); }}
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

      {/* Tenant table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading tenants…</p>
      ) : (
        <Card>
          <div className="overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Slug</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Users</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No tenants yet. Create one above.
                    </td>
                  </tr>
                )}
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{t.slug}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.status === 'active' ? 'success' : 'secondary'}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.user_count}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className={
                          t.status === 'active'
                            ? 'text-destructive hover:bg-destructive/10 border-destructive/30'
                            : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                        }
                        onClick={() =>
                          statusMutation.mutate({
                            id: t.id,
                            status: t.status === 'active' ? 'deactivated' : 'active',
                          })
                        }
                        disabled={statusMutation.isPending}
                      >
                        {t.status === 'active' ? 'Deactivate' : 'Reactivate'}
                      </Button>
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
