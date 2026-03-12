import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '@/pages/Login';
import TenantList from '@/pages/superadmin/TenantList';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Nav() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-foreground text-sm">Hello World</span>
        <span className="text-muted-foreground/30 text-xs px-1">·</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">
          Superadmin
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-xs">
          Sign out
        </Button>
      </div>
    </nav>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, claims, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading…</p>
      </div>
    );
  }
  if (!session || claims?.role !== 'superadmin') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/tenants"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-background">
                  <Nav />
                  <TenantList />
                </div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
