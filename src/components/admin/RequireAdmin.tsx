import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/hooks/useAdminAuth';

/**
 * Route guard for admin-only pages (settings, coupons, audit).
 * Professionals see a clear "restricted" panel instead of the page.
 * UX layer only — the DB enforces the same boundary via RLS/is_admin().
 */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAdminAuth(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl">
        <ShieldAlert className="w-10 h-10 text-destructive mb-4" />
        <h2 className="font-bold text-lg text-foreground">Acesso restrito a administradores</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Esta área controla configurações da plataforma. Seu perfil de profissional
          tem acesso completo a conteúdo, usuários, análises e saúde.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-5 text-xs">
          <Link to="/dashboard">Voltar ao Dashboard</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
