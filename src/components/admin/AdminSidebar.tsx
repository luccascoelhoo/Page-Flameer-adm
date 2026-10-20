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
  User,
  Gift,
  Settings,
  BrainCircuit,
  Flame,
  HeartPulse,
  ScrollText
, Zap, TrendingDown, MousePointerClick, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

interface AdminSidebarProps {
  profile: AdminProfile | null;
  /** J1 (17/08): modo trilho — só ícones, rótulos em title. */
  colapsada?: boolean;
}

export default function AdminSidebar({ profile, colapsada = false }: AdminSidebarProps) {
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

  const isAdmin = profile?.role === 'admin';

  // A navegação em GRUPOS NOMEADOS (repaginação de 11/08, pedido do dono:
  // "não sei onde cada coisa fica"). A lista plana de 17 itens virou cinco
  // vizinhanças, na ordem do trabalho de quem gerencia: primeiro MEDIR,
  // depois editar o PRODUTO, depois cuidar das PESSOAS e do JOGO, e por fim
  // a PLATAFORMA (só admin).
  const navGroups: { title: string; items: { to: string; label: string; icon: any }[] }[] = [
    {
      title: 'Visão',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/intelligence', label: 'Inteligência', icon: BrainCircuit },
        { to: '/uso', label: 'Uso do app', icon: MousePointerClick },
        { to: '/comportamento', label: 'Comportamento', icon: BrainCircuit },
        { to: '/health', label: 'Saúde', icon: HeartPulse },
        ...(isAdmin ? [{ to: '/churn', label: 'Churn', icon: TrendingDown }] : []),
      ],
    },
    {
      title: 'Produto',
      items: [
        { to: '/challenges', label: 'Desafios', icon: Trophy },
        { to: '/workouts', label: 'Treinos', icon: Dumbbell },
        { to: '/exercicios', label: 'Exercícios', icon: Dumbbell },
        { to: '/diets', label: 'Dietas', icon: Apple },
        { to: '/alimentos', label: 'Alimentos', icon: Apple },
        { to: '/habits', label: 'Hábitos', icon: CheckSquare },
      ],
    },
    {
      title: 'Pessoas',
      items: [
        { to: '/users', label: 'Usuários', icon: Users },
        { to: '/users/relatorio', label: 'Relatório de grupo', icon: ScrollText },
        { to: '/feed', label: 'Feed', icon: Flame },
        { to: '/community', label: 'Moderação', icon: MessageSquare },
      ],
    },
    {
      title: 'Jogo',
      items: [
        { to: '/gamification', label: 'Gamificação', icon: Award },
        { to: '/gamification/pontos', label: 'Economia de Pontos', icon: Zap },
      ],
    },
    {
      title: 'Ferramentas',
      items: [
        { to: '/copilot', label: 'Copiloto IA', icon: Sparkles },
        { to: '/tools/metabolism', label: 'Calculadora TMB', icon: Flame },
      ],
    },
    // Superfícies de plataforma — somente administradores
    ...(isAdmin
      ? [{
          title: 'Plataforma',
          items: [
            { to: '/pagamentos', label: 'Pagamentos', icon: Zap },
            { to: '/codigos', label: 'Códigos de acesso', icon: KeyRound },
            { to: '/referrals', label: 'Cupons & Indicações', icon: Gift },
            { to: '/audit', label: 'Auditoria', icon: ScrollText },
            { to: '/settings', label: 'Configurações', icon: Settings },
          ],
        }]
      : []),
  ];

  return (
    <aside className={cn(
      "bg-sidebar-background border-r border-sidebar-border flex flex-col h-screen sticky top-0 transition-[width] duration-200",
      colapsada ? "w-16" : "w-64"
    )}>
      {/* Sidebar Header */}
      <div className={cn(
        "h-14 flex items-center gap-2.5 border-b border-sidebar-border bg-sidebar-background",
        colapsada ? "justify-center px-0" : "px-5"
      )}>
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        {!colapsada && (
          <span className="font-bold text-base tracking-tight text-foreground font-sans">Flameer Panel</span>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!colapsada && (
              <p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                {group.title}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/gamification'}
                title={colapsada ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-200",
                    colapsada ? "justify-center px-0 py-2.5" : "px-3.5 py-2",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!colapsada && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User profile footer */}
      <div className={cn(
        "border-t border-sidebar-border bg-sidebar-background flex flex-col gap-3",
        colapsada ? "p-2 items-center" : "p-4"
      )}>
        <div className={cn("flex items-center gap-3", colapsada ? "px-0" : "px-2")}>
          <Avatar className="h-9 w-9 border border-border shadow-sm">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
              {profile?.name?.substring(0, 2).toUpperCase() || 'AD'}
            </AvatarFallback>
          </Avatar>
          {!colapsada && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                {profile?.name || 'Administrador'}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize leading-none mt-1">
                {profile?.role === 'admin' ? 'Administrador' : 'Profissional'}
              </p>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          onClick={handleLogout}
          title={colapsada ? 'Sair da conta' : undefined}
          className={cn(
            "gap-2 h-9 text-xs border-sidebar-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200",
            colapsada ? "w-10 px-0 justify-center" : "w-full justify-start"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!colapsada && <span>Sair da conta</span>}
        </Button>
      </div>
    </aside>
  );
}
