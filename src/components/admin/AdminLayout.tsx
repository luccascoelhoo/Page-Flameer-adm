import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AdminSidebar from './AdminSidebar';
import { Loader2 } from 'lucide-react';

export default function AdminLayout() {
  const { profile, loading, isAdmin } = useAdminAuth(true);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Verificando credenciais...</p>
      </div>
    );
  }

  // Fallback check if hook is bypassing redirect
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background font-sans">
      {/* Navigation Sidebar */}
      <AdminSidebar profile={profile} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden flex flex-col">
        {/* Main Content Render */}
        <div className="flex-1 p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
