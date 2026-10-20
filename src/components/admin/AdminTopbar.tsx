// AdminTopbar.tsx — a barra de comando da sala de controle (J1 · 17/08).
//
// Três coisas que o painel nunca teve num lugar só:
//   1. BUSCA GLOBAL de aluno (⌘K / ctrl+K) — admin_profile_search, navega
//      direto para a ficha. A gerência vive procurando gente; isso não pode
//      morar escondido dentro de uma página.
//   2. Onde estou — breadcrumb derivado da rota.
//   3. Toggle de tema (o painel é dark-first; o claro é opção).

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface ResultadoBusca {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

/** Rota → nome humano. O que não constar cai no último segmento cru. */
const NOMES_DE_ROTA: Record<string, string> = {
  dashboard: 'Dashboard', intelligence: 'Inteligência', uso: 'Uso do app',
  health: 'Saúde', churn: 'Churn', challenges: 'Desafios', workouts: 'Treinos',
  diets: 'Dietas', habits: 'Hábitos', users: 'Usuários', community: 'Comunidade',
  gamification: 'Gamificação', pontos: 'Economia de Pontos', copilot: 'Copiloto IA',
  tools: 'Ferramentas', metabolism: 'Calculadora TMB', codigos: 'Códigos de acesso',
  referrals: 'Cupons & Indicações', audit: 'Auditoria', settings: 'Configurações',
  participants: 'Participantes', adaptations: 'Adaptações', new: 'Novo',
};

export default function AdminTopbar({
  sidebarColapsada,
  onToggleSidebar,
}: {
  sidebarColapsada: boolean;
  onToggleSidebar: () => void;
}) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // ⌘K / ctrl+K foca a busca de qualquer lugar do painel.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') setAberto(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Busca com debounce curto — admin_profile_search já tem gate de admin.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResultados([]); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      const { data, error } = await (supabase as any)
        .rpc('admin_profile_search', { p_query: q, p_limit: 8 });
      setBuscando(false);
      if (!error) { setResultados(data ?? []); setAberto(true); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const abrirFicha = (id: string) => {
    setAberto(false);
    setQuery('');
    navigate(`/users/${id}`);
  };

  const segmentos = location.pathname.split('/').filter(Boolean);

  return (
    <header className="h-14 shrink-0 border-b border-border bg-background/95 backdrop-blur flex items-center gap-3 px-4 sticky top-0 z-40">
      <Button
        variant="ghost" size="icon" onClick={onToggleSidebar}
        className="h-8 w-8 text-muted-foreground"
        aria-label={sidebarColapsada ? 'Expandir menu' : 'Recolher menu'}
      >
        {sidebarColapsada ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </Button>

      {/* Breadcrumb — onde estou */}
      <nav className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
        {segmentos.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="opacity-40">/</span>}
            <span className={i === segmentos.length - 1 ? 'font-semibold text-foreground' : ''}>
              {NOMES_DE_ROTA[seg] ?? (seg.length > 12 ? `${seg.slice(0, 8)}…` : seg)}
            </span>
          </React.Fragment>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Busca global de aluno */}
      <div ref={boxRef} className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => resultados.length > 0 && setAberto(true)}
          placeholder="Buscar aluno…  ⌘K"
          className="w-full h-8 pl-8 pr-8 rounded-md border border-input bg-secondary/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {buscando && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
        {aberto && resultados.length > 0 && (
          <div className="absolute top-full mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden z-50">
            {resultados.map((r) => (
              <button
                key={r.id}
                onClick={() => abrirFicha(r.id)}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs hover:bg-accent transition-colors"
              >
                <Avatar className="h-6 w-6">
                  {r.avatar_url ? <AvatarImage src={r.avatar_url} alt="" /> : null}
                  <AvatarFallback className="text-[9px] bg-primary/15 text-primary font-bold">
                    {(r.name ?? '?').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-foreground">{r.name ?? 'Sem nome'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tema — dark é a casa; claro é visita */}
      <Button
        variant="ghost" size="icon" onClick={toggle}
        className="h-8 w-8 text-muted-foreground"
        aria-label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
    </header>
  );
}
