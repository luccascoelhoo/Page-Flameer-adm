// UserDetail.tsx — A FICHA DO ALUNO (J3 · 17/08/2026).
//
// Antes: `select *` cru no perfil + 2 arrays de saúde, desenhando 4 abas que
// mostravam menos de 10 dos ~47 campos que o cadastro coleta. A gerência não
// conseguia responder "quem é essa pessoa, como ela usa o app e o que pagou".
//
// Agora, três portas do banco (todas com gate de admin; a da ficha é
// auditada como 'ficha.view'):
//   admin_ficha_completa      → quem é
//   admin_atividade_do_aluno  → como usa (com a régua de adesão)
//   admin_historico_de_compras→ o que pagou
//
// A régua da adesão é honesta e vem escrita do servidor: mede COMPORTAMENTO
// no app, não saúde clínica. A tela mostra a régua junto do veredito.

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Loader2, Flame, Award, Heart, Dumbbell, Apple, Trophy,
  Calendar, Save, User, CreditCard, Activity, Printer, AlertTriangle,
  Gift, Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatCard from '@/components/admin/StatCard';
import { cn } from '@/lib/utils';

/** Vocabulário do banco → português de gente. */
const ROTULO: Record<string, string> = {
  male: 'Masculino', female: 'Feminino',
  lose: 'Emagrecer', gain: 'Ganhar massa', maintain: 'Manter',
  full_gym: 'Academia completa', basic_gym: 'Academia de prédio', home: 'Casa',
  none: 'Não faz', post_15: '15 min pós-treino', session_30_45: 'Sessão 30-45 min',
  separate_days: 'Em dias separados',
  beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado',
  sedentary: 'Trabalho sentado', active: 'Rotina ativa', heavy: 'Rotina pesada',
  '30_45': '30 a 45 min', '60': '60 min', '90_plus': '90 min ou mais',
  '0-2': '0 a 2× por semana', '3-5': '3 a 5× por semana', '6+': '6 ou mais por semana',
  lt6m: 'Menos de 6 meses', '6m2y': 'De 6 meses a 2 anos', gt2y: 'Mais de 2 anos',
  healthy: 'Saúde', energy: 'Energia', motivation: 'Motivação', body: 'Corpo',
  consistency: 'Consistência', habits: 'Hábitos', time: 'Tempo',
  desafio: 'Desafio', plano: 'Plano', livre: 'Livre', ia: 'IA', compartilhado: 'Compartilhado',
};
const r = (v: any) => (v == null || v === '' ? null : (ROTULO[String(v)] ?? String(v)));

const ADESAO_META: Record<string, { nome: string; classe: string }> = {
  ativo: { nome: 'Ativo', classe: 'bg-success/15 text-success border-success/30' },
  oscilando: { nome: 'Oscilando', classe: 'bg-primary/15 text-primary border-primary/30' },
  sumido: { nome: 'Sumido', classe: 'bg-destructive/15 text-destructive border-destructive/30' },
  nunca_ativou: { nome: 'Nunca ativou', classe: 'bg-muted text-muted-foreground border-border' },
};

/** Um campo da ficha. Ausência é dita, não escondida. */
function Campo({ rotulo, valor, sufixo }: { rotulo: string; valor: any; sufixo?: string }) {
  const vazio = valor == null || valor === '' ||
    (Array.isArray(valor) && valor.length === 0);
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className={cn('text-sm mt-0.5 truncate',
        vazio ? 'text-muted-foreground/50 italic' : 'text-foreground font-medium')}>
        {vazio ? 'não respondeu'
          : Array.isArray(valor) ? valor.join(', ')
          : `${valor}${sufixo ?? ''}`}
      </p>
    </div>
  );
}

function Secao({ titulo, icone: Icone, children }: {
  titulo: string; icone: any; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-md p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
        <Icone className="w-3.5 h-3.5" /> {titulo}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
}

const data = (v: any) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const dataHora = (v: any) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const moeda = (centavos: any) =>
  centavos == null ? '—'
    : (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function UserDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [role, setRole] = useState<'user' | 'professional' | 'admin'>('user');
  const [periodo, setPeriodo] = useState(30);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [tipoConcessao, setTipoConcessao] = useState<'desafio' | 'premium'>('desafio');
  const [desafioEscolhido, setDesafioEscolhido] = useState<string>('');
  const [mesesPremium, setMesesPremium] = useState('12');
  const [notaConcessao, setNotaConcessao] = useState('');

  // 1. A FICHA — quem é (RPC auditada).
  const { data: ficha, isLoading: carregandoFicha, refetch: refetchFicha } =
    useSupabaseQuery<any>(['admin', 'ficha', id], async () => {
      const { data, error } = await (supabase as any)
        .rpc('admin_ficha_completa', { p_user_id: id });
      return { data, error };
    });

  React.useEffect(() => { if (ficha?.role) setRole(ficha.role); }, [ficha]);

  // 2. A ATIVIDADE — como usa (com a adesão).
  const { data: atividade } = useSupabaseQuery<any>(
    ['admin', 'atividade', id, String(periodo)], async () => {
      const { data, error } = await (supabase as any)
        .rpc('admin_atividade_do_aluno', { p_user_id: id, p_dias: periodo });
      return { data, error };
    });

  // 3. O DINHEIRO — o que pagou.
  const { data: compras, refetch: refetchCompras } = useSupabaseQuery<any>(['admin', 'compras', id], async () => {
    const { data, error } = await (supabase as any)
      .rpc('admin_historico_de_compras', { p_user_id: id });
    return { data, error };
  });

  // Histórico linha a linha (as RPCs dão o agregado; isto é o extrato).
  const { data: workoutLogs } = useSupabaseQuery<any[]>(['admin', 'wlogs', id], async () => {
    const { data, error } = await (supabase as any)
      .from('workout_session_logs')
      .select('date, label, origem, elapsed_seconds, total_volume_kg')
      .eq('user_id', id).order('date', { ascending: false }).limit(50);
    return { data, error };
  });

  const { data: enrollments } = useSupabaseQuery<any[]>(['admin', 'inscricoes', id], async () => {
    const { data, error } = await (supabase as any)
      .from('challenge_participants')
      .select('challenge_id, current_streak, max_streak, total_points, joined_at, frozen_until, challenges(title, category, duration_days)')
      .eq('user_id', id).order('joined_at', { ascending: false });
    return { data, error };
  });

  // Desafios publicados — a lista que alimenta o seletor de concessão manual.
  const { data: desafiosPublicados } = useSupabaseQuery<any[]>(['admin', 'desafios-publicados'], async () => {
    const { data, error } = await (supabase as any)
      .from('challenges')
      .select('id, title')
      .eq('status', 'published')
      .order('title');
    return { data, error };
  });

  // Concessão manual — origin trava em 'cortesia' no servidor (nas duas RPCs);
  // a nota é só contexto humano (ex: "combinado por e-mail em 24/09").
  const concederAcesso = useSupabaseMutation<void, any>(
    async () => {
      if (tipoConcessao === 'desafio') {
        const { data, error } = await (supabase as any)
          .rpc('admin_conceder_acesso_desafio', {
            p_user_id: id,
            p_challenge_id: desafioEscolhido,
            p_nota: notaConcessao.trim() || null,
          });
        return { data, error };
      }
      const { data, error } = await (supabase as any)
        .rpc('admin_conceder_premium', {
          p_user_id: id,
          p_meses: Number(mesesPremium) || 12,
          p_nota: notaConcessao.trim() || null,
        });
      return { data, error };
    },
    {
      onSuccess: (r: any) => {
        if (tipoConcessao === 'desafio') {
          toast({
            title: r?.ja_tinha_acesso ? 'Esta conta já tinha acesso' : 'Acesso concedido',
            description: r?.ja_tinha_acesso
              ? 'Nada foi duplicado — o acesso já estava ativo.'
              : 'Concessão manual registrada como cortesia, sem cobrança.',
          });
        } else {
          toast({
            title: r?.prorrogado ? 'Premium prorrogado' : 'Premium concedido',
            description: `Válido até ${data(r?.expires_at)} · cortesia, sem cobrança.`,
          });
        }
        setDialogAberto(false);
        setDesafioEscolhido('');
        setMesesPremium('12');
        setNotaConcessao('');
        refetchCompras();
      },
      onError: (e) => toast({ title: 'Não deu para conceder', description: e.message, variant: 'destructive' }),
    });

  const revogarAcesso = useSupabaseMutation<{ challengeId: string | null; desafio: string }, any>(
    async ({ challengeId }) => {
      const motivo = window.prompt('Motivo da revogação (aparece no histórico do aluno):');
      if (motivo === null) throw new Error('__cancelado__');
      const rpc = challengeId ? 'admin_revogar_acesso_desafio' : 'admin_revogar_premium';
      const params = challengeId
        ? { p_user_id: id, p_challenge_id: challengeId, p_motivo: motivo || null }
        : { p_user_id: id, p_motivo: motivo || null };
      const { data, error } = await (supabase as any).rpc(rpc, params);
      return { data, error };
    },
    {
      onSuccess: () => { toast({ title: 'Acesso revogado' }); refetchCompras(); },
      onError: (e) => {
        if (e.message === '__cancelado__') return;
        toast({ title: 'Não deu para revogar', description: e.message, variant: 'destructive' });
      },
    });

  const updateRole = useSupabaseMutation<string, any>(
    async (novo) => {
      // RPC (paridade com UsersList): o UPDATE direto era barrado pela RLS e
      // o PostgREST devolvia sucesso de zero linhas.
      const { data, error } = await (supabase as any)
        .rpc('admin_set_role', { p_user_id: id, p_role: novo });
      return { data, error };
    },
    {
      onSuccess: () => { toast({ title: 'Permissão atualizada' }); refetchFicha(); },
      onError: (e) => toast({ title: 'Não deu para atualizar', description: e.message, variant: 'destructive' }),
    });

  if (carregandoFicha) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground font-medium">Carregando a ficha…</span>
      </div>
    );
  }

  const ad = atividade?.adesao;
  const meta = ADESAO_META[ad?.estado ?? 'nunca_ativou'] ?? ADESAO_META.nunca_ativou;
  const faltantes: string[] = ficha?.campos_faltantes ?? [];

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground">
            <Link to="/users"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Ficha do aluno</h1>
            <p className="text-xs text-muted-foreground">
              Cadastro, atividade medida no app e histórico financeiro.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                onClick={() => window.print()}>
          <Printer className="w-3.5 h-3.5" /> Relatório
        </Button>
      </div>

      {/* Identidade + adesão */}
      <div className="bg-card border border-border rounded-md p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-14 w-14 border border-border">
            {ficha?.avatar_url ? <AvatarImage src={ficha.avatar_url} alt={ficha.name} /> : null}
            <AvatarFallback className="bg-primary/15 text-primary font-bold text-lg">
              {ficha?.name?.substring(0, 2).toUpperCase() || '??'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground truncate">{ficha?.name ?? 'Sem nome'}</h2>
              {ficha?.handle && <span className="text-xs text-muted-foreground">@{ficha.handle}</span>}
              {ficha?.is_premium && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase">Premium</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {ficha?.email ?? 'sem e-mail'} · {ficha?.idade ? `${ficha.idade} anos` : 'idade não informada'}
              {ficha?.cohort_group ? ` · ${ficha.cohort_group}` : ''}
            </p>
            <div className="flex gap-3 mt-2 text-xs font-semibold flex-wrap">
              <span className="flex items-center gap-1 text-primary"><Flame className="w-3.5 h-3.5" />{ficha?.streak ?? 0} dias</span>
              <span className="flex items-center gap-1 text-foreground"><Award className="w-3.5 h-3.5 text-primary" />Nível {ficha?.level ?? 1} · {ficha?.pontos ?? 0} pts</span>
              <span className="text-muted-foreground">Desde {data(ficha?.criado_em)}</span>
            </div>
          </div>
        </div>

        {/* O veredito de adesão, com a régua junto */}
        <div className={cn('rounded-md border px-4 py-3 min-w-[220px]', meta.classe)}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold uppercase tracking-wide">{meta.nome}</span>
            <span className="text-2xl font-bold tabular-nums">{ad?.score ?? 0}%</span>
          </div>
          <p className="text-[11px] mt-1 opacity-90">
            {ad?.dias_ativos ?? 0} dias ativos em {atividade?.periodo_dias ?? periodo}
            {ad?.dias_sem_atividade != null && ` · ${ad.dias_sem_atividade} dia(s) parado`}
          </p>
          <p className="text-[10px] mt-1.5 opacity-70 leading-snug">{ad?.regua}</p>
        </div>
      </div>

      {/* Alerta de cadastro incompleto — o que o motor não tem para trabalhar */}
      {faltantes.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-md border border-primary/30 bg-primary/10 p-3 print:hidden">
          <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">Cadastro incompleto:</span>{' '}
            {faltantes.length} resposta(s) que o aluno nunca deu — {faltantes.join(', ')}.
            Os motores de treino e dieta trabalham com padrão conservador nesses pontos.
          </p>
        </div>
      )}

      {/* Números do período */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex gap-1">
          {[30, 90, 180].map((d) => (
            <button key={d} onClick={() => setPeriodo(d)}
              className={cn('px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                periodo === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {d} dias
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard rotulo="Treinos" valor={atividade?.treinos ?? 0} icone={Dumbbell} tom="acento" />
        <StatCard rotulo="Minutos treinados" valor={atividade?.minutos_treinados ?? 0} icone={Activity} />
        <StatCard rotulo="Volume (kg)" valor={Number(atividade?.volume_kg ?? 0).toLocaleString('pt-BR')} icone={Dumbbell} />
        <StatCard rotulo="Refeições marcadas" valor={atividade?.refeicoes_marcadas ?? 0} icone={Apple} />
        <StatCard rotulo="Hábitos marcados" valor={atividade?.habitos_marcados ?? 0} icone={Trophy} />
        <StatCard rotulo="Posts" valor={atividade?.posts ?? 0} icone={Flame} tom="acento" />
      </div>

      <Tabs defaultValue="ficha" className="w-full">
        <TabsList className="h-10 bg-card border border-border p-1 rounded-md">
          <TabsTrigger value="ficha" className="rounded gap-1.5 font-bold text-xs"><User className="w-3.5 h-3.5" />Ficha</TabsTrigger>
          <TabsTrigger value="atividade" className="rounded gap-1.5 font-bold text-xs"><Activity className="w-3.5 h-3.5" />Atividade</TabsTrigger>
          <TabsTrigger value="pagamentos" className="rounded gap-1.5 font-bold text-xs"><CreditCard className="w-3.5 h-3.5" />Pagamentos</TabsTrigger>
          <TabsTrigger value="desafios" className="rounded gap-1.5 font-bold text-xs"><Trophy className="w-3.5 h-3.5" />Desafios</TabsTrigger>
        </TabsList>

        {/* ── FICHA ── */}
        <TabsContent value="ficha" className="mt-4 space-y-3">
          <Secao titulo="Corpo" icone={User}>
            <Campo rotulo="Sexo" valor={r(ficha?.gender)} />
            <Campo rotulo="Idade" valor={ficha?.idade} sufixo=" anos" />
            <Campo rotulo="Altura" valor={ficha?.height} sufixo=" cm" />
            <Campo rotulo="Peso" valor={ficha?.weight} sufixo=" kg" />
            <Campo rotulo="Peso desejado" valor={ficha?.desired_weight} sufixo=" kg" />
            <Campo rotulo="IMC" valor={ficha?.imc} />
            <Campo rotulo="Ritmo declarado" valor={ficha?.weekly_pace_kg} sufixo=" kg/sem" />
            <Campo rotulo="Objetivo" valor={r(ficha?.goal)} />
          </Secao>

          <Secao titulo="Treino" icone={Dumbbell}>
            <Campo rotulo="Onde treina" valor={r(ficha?.workout_place)} />
            <Campo rotulo="Tempo de sessão" valor={r(ficha?.session_time)} />
            <Campo rotulo="Frequência" valor={r(ficha?.training_frequency)} />
            <Campo rotulo="Nível" valor={r(ficha?.training_level)} />
            <Campo rotulo="Experiência" valor={r(ficha?.training_experience)} />
            <Campo rotulo="Cardio" valor={r(ficha?.cardio_preference)} />
            <Campo rotulo="Foco declarado" valor={ficha?.workout_focus} />
            <Campo rotulo="Foco entendido" valor={ficha?.focos_normalizados} />
          </Secao>

          <Secao titulo="Dieta e preferências" icone={Apple}>
            <Campo rotulo="Rotina" valor={r(ficha?.daily_routine)} />
            <Campo rotulo="Refeições/dia" valor={ficha?.meals_count} />
            <Campo rotulo="Suplementos" valor={ficha?.supplements} />
            <Campo rotulo="Aspiração" valor={r(ficha?.aspiration)} />
            <Campo rotulo="Não come" valor={ficha?.disliked_foods} />
            <Campo rotulo="Prefere" valor={ficha?.loved_foods} />
            <Campo rotulo="Exercícios rejeitados" valor={ficha?.hated_exercises} />
            <Campo rotulo="Maior obstáculo" valor={r(ficha?.biggest_obstacle)} />
          </Secao>

          <Secao titulo="Saúde declarada pelo aluno" icone={Heart}>
            <Campo rotulo="Lesões" valor={ficha?.injuries} />
            <Campo rotulo="Alergias e restrições" valor={ficha?.allergies} />
            <Campo rotulo="Revisada por profissional" valor={ficha?.saude_revisada_por_profissional ? 'Sim' : 'Não'} />
            <Campo rotulo="Como chegou" valor={r(ficha?.discovery_source)} />
          </Secao>

          {/* Permissão — ação administrativa, longe dos dados de leitura */}
          <div className="bg-card border border-border rounded-md p-5 print:hidden">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Permissão da conta</h3>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="role-select" className="text-[10px] font-bold text-muted-foreground uppercase">Nível de acesso</Label>
                <select id="role-select" value={role} onChange={(e: any) => setRole(e.target.value)}
                  className="w-52 h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="user">Usuário comum</option>
                  <option value="professional">Profissional / Personal</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <Button size="sm" onClick={() => updateRole.mutate(role)} disabled={updateRole.isPending} className="gap-1 h-9">
                {updateRole.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── ATIVIDADE ── */}
        <TabsContent value="atividade" className="mt-4 space-y-3">
          <div className="bg-card border border-border rounded-md p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Treinos por origem</h3>
            {Object.keys(atividade?.treinos_por_origem ?? {}).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum treino registrado no período.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(atividade?.treinos_por_origem ?? {}).map(([origem, n]) => (
                  <span key={origem} className="text-xs px-2.5 py-1 rounded bg-secondary text-foreground">
                    {r(origem)}: <span className="font-bold tabular-nums">{String(n)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Últimas sessões</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-5 py-2">Data</th><th className="px-5 py-2">Treino</th>
                  <th className="px-5 py-2">Origem</th>
                  <th className="px-5 py-2 text-right">Minutos</th><th className="px-5 py-2 text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {(workoutLogs ?? []).slice(0, 15).map((w, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-2 text-muted-foreground">{data(w.date)}</td>
                    <td className="px-5 py-2 text-foreground font-medium">{w.label ?? '—'}</td>
                    <td className="px-5 py-2 text-xs text-muted-foreground">{r(w.origem)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{Math.round((w.elapsed_seconds ?? 0) / 60)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{Math.round(w.total_volume_kg ?? 0)} kg</td>
                  </tr>
                ))}
                {(workoutLogs ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground italic">Sem sessões registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── PAGAMENTOS ── */}
        <TabsContent value="pagamentos" className="mt-4 space-y-3">
          <div className="bg-card border border-border rounded-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acessos</h3>

              {/* Concessão manual — só admin chega aqui (rota /users/:id já é
                  gate de admin/professional; a RPC repete o gate no servidor
                  com is_platform_admin(), que é mais estrito). */}
              <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                    <Gift className="w-3.5 h-3.5" /> Conceder acesso manual
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Conceder acesso manual</DialogTitle>
                    <DialogDescription>
                      Ação manual, registrada como <strong>cortesia</strong> — não gera cobrança e não
                      entra no faturamento. Fica no histórico do aluno e na auditoria, com o seu e-mail.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">O que conceder</Label>
                      <Select value={tipoConcessao} onValueChange={(v: any) => setTipoConcessao(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desafio">Acesso a um desafio</SelectItem>
                          <SelectItem value="premium">Assinatura Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {tipoConcessao === 'desafio' ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Desafio</Label>
                        <Select value={desafioEscolhido} onValueChange={setDesafioEscolhido}>
                          <SelectTrigger><SelectValue placeholder="Selecione um desafio" /></SelectTrigger>
                          <SelectContent>
                            {(desafiosPublicados ?? []).map((d: any) => (
                              <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Duração</Label>
                        <Select value={mesesPremium} onValueChange={setMesesPremium}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 mês</SelectItem>
                            <SelectItem value="3">3 meses</SelectItem>
                            <SelectItem value="6">6 meses</SelectItem>
                            <SelectItem value="12">12 meses</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Se a conta já tiver Premium vigente, o prazo <strong>soma</strong> ao vencimento
                          atual — não substitui. Não renova sozinho: passado o prazo, o Premium cai.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">
                        Nota (opcional)
                      </Label>
                      <Textarea
                        value={notaConcessao}
                        onChange={(e) => setNotaConcessao(e.target.value)}
                        placeholder='Ex: "combinado por e-mail em 24/09" — aparece no histórico de acessos.'
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={() => setDialogAberto(false)}>Cancelar</Button>
                    <Button
                      size="sm"
                      disabled={(tipoConcessao === 'desafio' && !desafioEscolhido) || concederAcesso.isPending}
                      onClick={() => concederAcesso.mutate(undefined as any)}
                      className="gap-1.5"
                    >
                      {concederAcesso.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                      Conceder, sem cobrança
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {(compras?.acessos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum acesso registrado — conta sem compra nem cortesia.</p>
            ) : (
              <div className="divide-y divide-border">
                {(compras?.acessos ?? []).map((a: any, i: number) => (
                  <div key={i} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {a.desafio ?? (a.tipo === 'subscription' ? 'Assinatura' : 'Acesso')}
                        {a.origem === 'cortesia' && (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase align-middle">
                            Cortesia
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Origem: {a.origem} · Início: {data(a.inicio)}
                        {a.vencimento ? ` · Vence: ${data(a.vencimento)}` : ' · sem vencimento'}
                        {a.referencia_externa ? ` · ${a.referencia_externa}` : ''}
                      </p>
                      {a.revogado_em && (
                        <p className="text-xs text-destructive mt-0.5">
                          Revogado em {data(a.revogado_em)}{a.motivo_revogacao ? ` — ${a.motivo_revogacao}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase',
                        a.vigente ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                        {a.vigente ? 'Vigente' : 'Encerrado'}
                      </span>
                      {/* Revogar só aparece para o que É NOSSO desfazer: acesso de
                          desafio (qualquer origem) ou assinatura de CORTESIA. Uma
                          assinatura comprada na loja não some daqui — quem cancela
                          é a loja; nós só desfazemos o que nós mesmos concedemos. */}
                      {a.vigente && (a.challenge_id || a.origem === 'cortesia') && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                          disabled={revogarAcesso.isPending}
                          onClick={() => revogarAcesso.mutate({ challengeId: a.challenge_id ?? null, desafio: a.desafio ?? 'Premium' })}
                        >
                          <Ban className="w-3 h-3" /> Revogar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-md p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Códigos resgatados</h3>
            {(compras?.codigos_resgatados ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum código resgatado por esta conta.</p>
            ) : (
              <div className="space-y-2">
                {(compras?.codigos_resgatados ?? []).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-mono font-semibold text-foreground">{c.codigo}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {c.desafio} · {c.origem === 'gateway' ? 'venda' : 'manual'}
                      {c.email_da_compra ? ` · ${c.email_da_compra}` : ''} · {data(c.resgatado_em)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-md p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Eventos do gateway</h3>
            <p className="text-[11px] text-muted-foreground mb-4">
              O que a Cakto informou para {compras?.email ?? 'este e-mail'}. Dados de cartão nunca são
              armazenados por nós — valor e método aparecem quando o gateway os envia.
            </p>
            {(compras?.eventos_do_gateway ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum evento de pagamento para este e-mail.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2">Quando</th><th className="py-2">Evento</th>
                    <th className="py-2">Método</th><th className="py-2 text-right">Valor</th><th className="py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(compras?.eventos_do_gateway ?? []).map((e: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-muted-foreground text-xs">{dataHora(e.recebido_em)}</td>
                      <td className="py-2 text-foreground">{e.evento}</td>
                      <td className="py-2 text-xs">{e.metodo ?? '—'}</td>
                      <td className="py-2 text-right tabular-nums">{moeda(e.valor_centavos)}</td>
                      <td className="py-2 text-right">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
                          e.status === 'aplicado' ? 'bg-success/15 text-success'
                            : e.status === 'erro' ? 'bg-destructive/15 text-destructive'
                            : 'bg-muted text-muted-foreground')}>{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ── DESAFIOS ── */}
        <TabsContent value="desafios" className="mt-4">
          <div className="bg-card border border-border rounded-md p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
              <Calendar className="w-3.5 h-3.5" /> Inscrições
            </h3>
            {(enrollments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum desafio associado a este aluno.</p>
            ) : (
              <div className="divide-y divide-border">
                {(enrollments ?? []).map((e: any, i: number) => {
                  const dias = Math.max(1, Math.floor((Date.now() - new Date(e.joined_at).getTime()) / 86400000) + 1);
                  const dur: number | null = e.challenges?.duration_days ?? null;
                  const encerrado = dur != null && dur > 0 && dias > dur;
                  const congelado = e.frozen_until && new Date(e.frozen_until) > new Date();
                  return (
                    <div key={i} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{e.challenges?.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Entrou em {data(e.joined_at)} · {e.total_points} pts · chama {e.current_streak} (máx {e.max_streak})
                        </p>
                      </div>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0',
                        congelado ? 'bg-primary/15 text-primary'
                          : encerrado ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success')}>
                        {congelado ? 'Pausado' : encerrado ? 'Encerrado' : `Dia ${dur ? Math.min(dias, dur) : dias}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
