import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminProfile } from '@/hooks/useAdminAuth';
import { 
  LayoutDashboard, 
  Trophy, 
  Dumbbell, 
  Apple, 
  CheckSquare, 
  Users, 
  MessageSquare, 
  Award,
  LogOut,
  Sparkles,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

interface AdminSidebarProps {
  profile: AdminProfile | null;
}

export default function AdminSidebar({ profile }: AdminSidebarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Sessão encerrada",
        description: "Você saiu do painel com segurança.",
      });
      navigate('/login');
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/copilot', label: 'Copiloto IA', icon: Sparkles },
    { to: '/challenges', label: 'Desafios', icon: Trophy },
    { to: '/workouts', label: 'Treinos', icon: Dumbbell },
    { to: '/diets', label: 'Dietas', icon: Apple },
    { to: '/habits', label: 'Hábitos', icon: CheckSquare },
    { to: '/users', label: 'Usuários', icon: Users },
    { to: '/community', label: 'Comunidade', icon: MessageSquare },
    { to: '/gamification', label: 'Gamificação', icon: Award },
  ];

  return (
    <aside className="w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Sidebar Header */}
      <div className="h-16 flex items-center gap-2.5 px-6 border-b border-sidebar-border bg-sidebar-background">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <span className="font-bold text-lg tracking-tight text-foreground font-sans">Flameer Panel</span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10" 
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User profile footer */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar-background flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2">
          <Avatar className="h-9 w-9 border border-border shadow-sm">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
              {profile?.name?.substring(0, 2).toUpperCase() || 'AD'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">
              {profile?.name || 'Administrador'}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize leading-none mt-1">
              {profile?.role === 'admin' ? 'Administrador' : 'Profissional'}
            </p>
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={handleLogout} 
          className="w-full justify-start gap-2 h-9 text-xs border-sidebar-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair da conta</span>
        </Button>
      </div>
    </aside>
  );
}
