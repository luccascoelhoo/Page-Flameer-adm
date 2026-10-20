// FeedDaComunidade.tsx — a vitrine sob controle (J6 · 18/08/2026).
//
// A moderação antiga só via o que foi DENUNCIADO e só sabia apagar. Aqui a
// gerência vê o feed inteiro, busca por autor, e decide o que abre o app:
//   DESTACAR  → o post vira a primeira publicação que todos veem (com prazo)
//   ESCONDER  → sai da vitrine, com motivo, e PODE VOLTAR (soft-delete)
// A exclusão definitiva continua na tela de denúncias — lá ela recalcula o
// dia do autor; esconder não mexe nos pontos de quem já produziu.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import {
  EyeOff, Eye, Flame, Loader2, MessageSquare, Search, Star, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/admin/PageHeader';
import StatCard from '@/components/admin/StatCard';
import { useToast } from '@/hooks/use-toast';
import { useConfirmar } from '@/components/admin/Confirmar';
import { cn } from '@/lib/utils';

const quando = (v: any) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function FeedDaComunidade() {
  const { toast } = useToast();
  const confirmar = useConfirmar();
  const [busca, setBusca] = useState('');
  const [aplicada, setAplicada] = useState('');
  const [agindo, setAgindo] = useState<string | null>(null);

  const { data: stats, refetch: refetchStats } = useSupabaseQuery<any>(
    ['admin', 'posts-stats'], async () => {
      const { data, error } = await (supabase as any).rpc('admin_posts_stats', { p_dias: 30 });
      return { data, error };
    });

  const { data: feed, isLoading, refetch } = useSupabaseQuery<any[]>(
    ['admin', 'feed', aplicada], async () => {
      const { data, error } = await (supabase as any)
        .rpc('admin_feed_completo', { p_limit: 60, p_offset: 0, p_autor: aplicada || null });
      return { data, error };
    });

  const agir = async (post: any, acao: string) => {
    if (acao === 'esconder') {
      const ok = await confirmar({
        titulo: 'Esconder esta publicação?',
        descricao: 'Ela sai da vitrine do app imediatamente. Os pontos do autor não são alterados, e você pode restaurar depois.',
        confirmar: 'Esconder', destrutivo: true,
      });
      if (!ok) return;
    }
    setAgindo(post.id);
    const { error } = await (supabase as any).rpc('admin_moderar_post', {
      p_post_id: post.id, p_acao: acao,
      p_motivo: acao === 'esconder' ? 'moderação da gerência' : null,
      p_horas_de_destaque: 24,
    });
    setAgindo(null);
    if (error) {
      toast({ title: 'Não deu certo', description: error.message, variant: 'destructive' });
      return;
    }
    const msg: Record<string, string> = {
      destacar: 'Esta é agora a primeira publicação que todos veem (24h).',
      remover_destaque: 'Destaque removido.',
      esconder: 'Publicação escondida da vitrine.',
      restaurar: 'Publicação restaurada.',
    };
    toast({ title: 'Feito', description: msg[acao] });
    refetch(); refetchStats();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Feed da comunidade"
        subtitulo="Todas as publicações — não só as denunciadas. Escolha o que abre o app e o que sai da vitrine."
        acoes={
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link to="/community">Denúncias e check-ins</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard rotulo="Posts (30 dias)" valor={stats?.total ?? 0} icone={MessageSquare} tom="acento" />
        <StatCard rotulo="Hoje" valor={stats?.hoje ?? 0} icone={Flame} />
        <StatCard rotulo="Pessoas publicando" valor={stats?.pessoas_que_postaram ?? 0} icone={Users} />
        <StatCard rotulo="Em destaque" valor={stats?.em_destaque ?? 0} icone={Star} tom="acento" />
        <StatCard rotulo="Escondidos" valor={stats?.escondidos ?? 0} icone={EyeOff}
                  tom={(stats?.escondidos ?? 0) > 0 ? 'alerta' : 'neutro'} />
      </div>

      {/* Ranking de quem posta */}
      {(stats?.ranking ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-md p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Quem mais publica (30 dias)
          </h2>
          <div className="flex flex-wrap gap-2">
            {(stats?.ranking ?? []).map((p: any, i: number) => (
              <Link key={p.user_id ?? i} to={`/users/${p.user_id}`}
                className="text-xs px-2.5 py-1 rounded bg-secondary text-foreground hover:bg-accent transition-colors">
                {i + 1}. {p.nome ?? 'Sem nome'} <span className="font-bold tabular-nums">{p.posts}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Busca por autor */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="h-8 pl-8 text-xs" placeholder="Buscar pelo nome de quem publicou…"
                 value={busca} onChange={(e) => setBusca(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && setAplicada(busca)} />
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => setAplicada(busca)}>Buscar</Button>
        {aplicada && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                  onClick={() => { setBusca(''); setAplicada(''); }}>Limpar</Button>
        )}
      </div>

      {/* A vitrine */}
      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (feed ?? []).length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground italic">
          {aplicada ? `Ninguém chamado "${aplicada}" publicou.` : 'Nenhuma publicação ainda.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {(feed ?? []).map((p) => {
            const destacado = p.destaque_ate && new Date(p.destaque_ate) > new Date();
            return (
              <div key={p.id} className={cn('bg-card border rounded-md overflow-hidden flex flex-col',
                destacado ? 'border-primary' : p.escondido_em ? 'border-destructive/40' : 'border-border')}>
                <div className="relative aspect-square bg-secondary">
                  {p.imagem ? (
                    <img src={p.imagem} alt="" className={cn('w-full h-full object-cover',
                      p.escondido_em && 'opacity-40 grayscale')} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      sem imagem
                    </div>
                  )}
                  {destacado && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground uppercase">
                      Primeira do feed
                    </span>
                  )}
                  {p.escondido_em && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground uppercase">
                      Escondida
                    </span>
                  )}
                  {p.denuncias > 0 && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/90 text-destructive-foreground">
                      {p.denuncias} denúncia(s)
                    </span>
                  )}
                </div>

                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div className="min-w-0">
                    <Link to={`/users/${p.autor_id}`} className="text-xs font-semibold text-foreground hover:text-primary truncate block">
                      {p.autor ?? 'Sem nome'}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">{quando(p.criado_em)}</p>
                  </div>
                  {p.legenda && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{p.legenda}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>♥ {p.curtidas}</span><span>💬 {p.comentarios}</span>
                  </div>

                  <div className="mt-auto flex gap-1 pt-1">
                    <Button variant={destacado ? 'default' : 'outline'} size="sm"
                            className="h-7 flex-1 text-[10px] gap-1" disabled={agindo === p.id}
                            onClick={() => agir(p, destacado ? 'remover_destaque' : 'destacar')}>
                      {agindo === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                      {destacado ? 'Tirar' : 'Destacar'}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 flex-1 text-[10px] gap-1"
                            disabled={agindo === p.id}
                            onClick={() => agir(p, p.escondido_em ? 'restaurar' : 'esconder')}>
                      {p.escondido_em ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {p.escondido_em ? 'Restaurar' : 'Esconder'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
