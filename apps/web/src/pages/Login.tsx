import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const role = data.user?.app_metadata?.role as string | undefined;
    const tenantId = data.user?.app_metadata?.tenant_id as string | undefined;

    // Superadmin → redirect to admin app
    if (role === 'superadmin') {
      window.location.href = 'http://localhost:5174';
      return;
    }

    // Tenant admin or user → look up tenant slug, navigate to board
    if (!tenantId) {
      setError('No tenant assigned to your account. Contact your administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('slug, status')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      setError('Could not load your organization. Please try again.');
      setLoading(false);
      return;
    }

    if (tenant.status === 'deactivated') {
      setError('This organization is no longer active. Contact your administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    navigate(`/t/${tenant.slug}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Hello World</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
