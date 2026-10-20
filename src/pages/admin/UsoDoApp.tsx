import React, { useMemo, useState } from 'react';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Loader2, MousePointerClick, Users } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// USO DO APP — a leitura dos marcadores (11/08/2026).
//
// A fonte é a RPC `metricas_de_uso`: o painel NUNCA lê a tabela crua de
// eventos — recebe agregados por dia+evento (total, usuários únicos, mediana
// de duração). Comportamento individual linha a linha é dado sensível;
// gerência precisa de tendência, não de vigilância.
// ─────────────────────────────────────────────────────────────────────────────

interface LinhaDeMetrica {
  dia: string;
  evento: string;
  total: number;
  usuarios: number;
  mediana_ms: number | null;
}

/** Nome humano e o que cada marcador significa — a legenda mora aqui. */
const EVENTOS: Record<string, { nome: string; explica: string }> = {
  app_aberta:       { nome: 'App aberto',        explica: 'Sessões iniciadas (uma por abertura com login)' },
  aba_aberta:       { nome: 'Troca de aba',      explica: 'Navegação entre as 5 abas — o mapa de calor do app' },
  habito_marcado:   { nome: 'Hábito marcado',    explica: 'Hábito concluído na Home' },
  treino_iniciado:  { nome: 'Treino iniciado',   explica: 'Entrou no modo treino' },
  treino_concluido: { nome: 'Treino concluído',  explica: 'Sessão registrada; mediana = duração do treino' },
  refeicao_marcada: { nome: 'Refeição marcada',  explica: 'Refeição do plano consumida' },
  desafio_preview:  { nome: 'Preview de desafio',explica: 'Abriu a tela de apresentação de um desafio' },
  paywall_visto:    { nome: 'Paywall visto',     explica: 'Chegou na tela de assinatura — topo do funil Premium' },
  paywall_toque:    { nome: 'Paywall: toque',    explica: 'Tocou num plano dentro do paywall' },
  aula_aberta:      { nome: 'Aula aberta',       explica: 'Abriu uma aula da área de membros' },
  compartilhou:     { nome: 'Compartilhou',      explica: 'Usou o cartão de compartilhamento' },
  // 14/08 — o comportamento do plano de treino, para segmentação:
  plano_regenerado: { nome: 'Plano regenerado',  explica: 'Pediu um treino novo (com feedback)' },
  plano_arquivado:  { nome: 'Plano arquivado',   explica: 'Limpou o plano da tela sem gerar outro' },
  descanso_marcado: { nome: 'Descanso marcado',  explica: 'Escolheu descansar num dia com treino' },
  feedback_enviado: { nome: 'Feedback de treino',explica: 'Respondeu como foi o plano antes de regenerar' },
  dias_trocados:    { nome: 'Dias trocados',     explica: 'Reordenou os dias das divisões' },
};

const CORES = ['#FF6B00', '#E85D04', '#F5A623', '#B52A1C', '#5C1A8A', '#2A6ACA', '#27AE60', '#888888'];

export default function UsoDoApp() {
  const [dias, setDias] = useState(14);

  const { data, isLoading, error } = useSupabaseQuery<LinhaDeMetrica[]>(
    ['admin', 'uso', String(dias)],
    async () => {
      const { data, error } = await (supabase as any).rpc('metricas_de_uso', { p_dias: dias });
      return { data, error };
    }
  );

  const linhas = data ?? [];

  // Agregados do período
  const resumo = useMemo(() => {
    const hoje = linhas.length > 0 ? linhas.reduce((m, l) => (l.dia > m ? l.dia : m), '') : '';
    const doDia = linhas.filter((l) => l.dia === hoje);
    return {
      eventosHoje: doDia.reduce((s, l) => s + l.total, 0),
      usuariosHoje: Math.max(0, ...doDia.map((l) => l.usuarios), 0),
      eventosPeriodo: linhas.reduce((s, l) => s + l.total, 0),
      hoje,
    };
  }, [linhas]);

  // Série para o gráfico: uma linha por dia, uma chave por evento
  const serie = useMemo(() => {
    const porDia = new Map<string, Record<string, number | string>>();
    for (const l of linhas) {
      const atual = porDia.get(l.dia) ?? { dia: l.dia.slice(5) };
      atual[l.evento] = (Number(atual[l.evento]) || 0) + l.total;
      porDia.set(l.dia, atual);
    }
    return Array.from(porDia.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [linhas]);

  const eventosPresentes = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.evento))),
    [linhas]
  );

  // Tabela: totais por evento no período
  const porEvento = useMemo(() => {
    const mapa = new Map<string, { total: number; usuarios: number; medianas: number[] }>();
    for (const l of linhas) {
      const atual = mapa.get(l.evento) ?? { total: 0, usuarios: 0, medianas: [] };
      atual.total += l.total;
      atual.usuarios = Math.max(atual.usuarios, l.usuarios);
      if (l.mediana_ms != null) atual.medianas.push(l.mediana_ms);
      mapa.set(l.evento, atual);
    }
    return Array.from(mapa.entries())
      .map(([evento, v]) => ({
        evento,
        total: v.total,
        usuarios: v.usuarios,
        mediana: v.medianas.length
          ? Math.round(v.medianas.reduce((s, x) => s + x, 0) / v.medianas.length)
          : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [linhas]);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Uso do app</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Os marcadores que o app grava (agregados — o painel não vê comportamento linha a linha).
          </p>
        </div>
        <select
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          className="h-9 px-3 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={14}>Últimos 14 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando métricas…
        </div>
      ) : error ? (
        <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-sm text-destructive">
          Falha ao ler métricas: {String((error as any).message ?? error)}
        </div>
      ) : (
        <>
          {/* Cartões-resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icone: MousePointerClick, rotulo: `Eventos hoje (${resumo.hoje || '—'})`, valor: resumo.eventosHoje },
              { icone: Users, rotulo: 'Usuários ativos hoje', valor: resumo.usuariosHoje },
              { icone: Activity, rotulo: `Eventos no período`, valor: resumo.eventosPeriodo },
            ].map((c) => (
              <div key={c.rotulo} className="bg-card border border-border rounded-md p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <c.icone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">{c.valor}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.rotulo}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico por dia */}
          <div className="bg-card border border-border rounded-md p-6">
            <h2 className="font-bold text-sm text-foreground uppercase tracking-wider mb-4">
              Eventos por dia
            </h2>
            {serie.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Ainda sem eventos no período — os marcadores começam a contar na versão de 11/08.
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="dia" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend formatter={(v: string) => EVENTOS[v]?.nome ?? v} />
                    {eventosPresentes.map((ev, i) => (
                      <Bar key={ev} dataKey={ev} stackId="dia" fill={CORES[i % CORES.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabela por evento, com a legenda do que significa */}
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Marcador</th>
                  <th className="px-5 py-3">O que significa</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Usuários</th>
                  <th className="px-5 py-3 text-right">Mediana</th>
                </tr>
              </thead>
              <tbody>
                {porEvento.map((l) => (
                  <tr key={l.evento} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-semibold text-foreground">
                      {EVENTOS[l.evento]?.nome ?? l.evento}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {EVENTOS[l.evento]?.explica ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-bold">{l.total}</td>
                    <td className="px-5 py-3 text-right">{l.usuarios}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {l.mediana != null ? `${Math.round(l.mediana / 1000)}s` : '—'}
                    </td>
                  </tr>
                ))}
                {porEvento.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      Sem dados no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── COORTES DE COMPORTAMENTO (14/08) ──
          Decisão do dono: SEGMENTO, não vigilância — o servidor agrupa e
          devolve grupos; a lista de e-mails do grupo sai por
          admin_emails_de_perfis (portão + teto de 200). Nenhuma linha do
          tempo individual chega aqui. */}
      <SecaoDeCoortes dias={dias} />

      {/* ── PERFIL DA BASE (J4 · 16/08) ──
          As coortes de CADASTRO sobre as colunas promovidas na camada de
          dados ouro: objetivo, cardio, frequência, local, nível e as
          rejeições campeãs. Só agregados — nenhum user_id viaja. */}
      <SecaoDePerfilDaBase />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Coortes de comportamento — quem está em cada padrão, e os e-mails
// do grupo para campanha (via portão de admin).
// ─────────────────────────────────────────────────────────────────
interface Coorte { coorte: string; pessoas: number; eventos: number; ids: string[] }

const NOME_DA_COORTE: Record<string, { nome: string; explica: string }> = {
  constante:                 { nome: 'Constantes',        explica: '8+ treinos na janela' },
  ativo_leve:                { nome: 'Ativos leves',      explica: '1 a 7 treinos' },
  insatisfeito_com_plano:    { nome: 'Insatisfeitos com o plano', explica: '2+ regenerações' },
  interessado_sem_converter: { nome: 'Interessados sem converter', explica: '3+ paywalls, zero treino' },
  mais_descanso_que_treino:  { nome: 'Mais descanso que treino', explica: 'Descansos superam treinos' },
  dormindo:                  { nome: 'Dormindo',          explica: 'Sem treino nem sinal forte' },
};

function SecaoDeCoortes({ dias }: { dias: number }) {
  const { data, isLoading } = useSupabaseQuery<Coorte[]>(
    ['admin', 'coortes', String(dias)],
    async () => {
      const { data, error } = await (supabase as any)
        .rpc('comportamento_por_coorte', { p_dias: dias });
      if (error) throw error;
      return data ?? [];
    },
  );

  const exportarEmails = async (c: Coorte) => {
    const { data, error } = await (supabase as any)
      .rpc('admin_emails_de_perfis', { p_ids: c.ids.slice(0, 200) });
    if (error || !data?.length) return;
    const linhas = (data as { email: string }[]).map((l) => l.email).join('\n');
    const blob = new Blob([linhas], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `coorte-${c.coorte}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Coortes de comportamento</h2>
        <p className="text-xs text-muted-foreground">
          Grupos por padrão de uso na janela — para direcionar campanha, não
          para vigiar indivíduo. O botão exporta os e-mails do grupo (máx. 200).
        </p>
      </div>
      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((c) => {
            const meta = NOME_DA_COORTE[c.coorte] ?? { nome: c.coorte, explica: '' };
            return (
              <div key={c.coorte} className="rounded-md border p-3 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{meta.nome}</span>
                  <span className="text-lg font-bold">{c.pessoas}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{meta.explica}</p>
                <button
                  className="text-[11px] font-semibold text-primary hover:underline"
                  onClick={() => exportarEmails(c)}
                >
                  Exportar e-mails do grupo
                </button>
              </div>
            );
          })}
          {(data ?? []).length === 0 && (
            <p className="col-span-full py-4 text-center text-sm text-muted-foreground">
              Sem eventos na janela.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Perfil da base (J4 · 16/08) — as coortes de CADASTRO, vindas de
// `admin_perfil_em_coortes` sobre as colunas da camada de dados ouro.
// Só distribuições agregadas; as rejeições campeãs são o radar do
// catálogo (exercício que meio mundo rejeita precisa de alternativa).
// ─────────────────────────────────────────────────────────────────
interface PerfilDaBase {
  total_perfis: number;
  por_objetivo: Record<string, number>;
  por_cardio: Record<string, number>;
  por_frequencia: Record<string, number>;
  por_local: Record<string, number>;
  por_nivel: Record<string, number>;
  com_ritmo_declarado: number;
  top_exercicios_rejeitados: { nome: string; pessoas: number }[];
  top_alimentos_rejeitados: { nome: string; pessoas: number }[];
}

/** Vocabulário do banco → rótulo humano. O que não constar passa cru. */
const ROTULOS: Record<string, string> = {
  lose: 'Emagrecer', gain: 'Ganhar massa', maintain: 'Manter',
  none: 'Não faz cardio', post_15: '15 min pós-treino',
  session_30_45: 'Sessão 30-45 min', separate_days: 'Dias separados',
  full_gym: 'Academia completa', basic_gym: 'Academia de prédio', home: 'Casa',
  beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado',
  '0-2': '0-2× por semana', '3-5': '3-5× por semana', '6+': '6+ por semana',
};

function SecaoDePerfilDaBase() {
  const { data, isLoading } = useSupabaseQuery<PerfilDaBase>(
    ['admin', 'perfil-da-base'],
    async () => {
      const { data, error } = await (supabase as any).rpc('admin_perfil_em_coortes');
      return { data, error };
    },
  );

  const distribuicoes: { titulo: string; valores: Record<string, number> }[] = data
    ? [
        { titulo: 'Objetivo', valores: data.por_objetivo },
        { titulo: 'Cardio', valores: data.por_cardio },
        { titulo: 'Frequência de treino', valores: data.por_frequencia },
        { titulo: 'Onde treina', valores: data.por_local },
        { titulo: 'Nível declarado', valores: data.por_nivel },
      ]
    : [];

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Perfil da base</h2>
        <p className="text-xs text-muted-foreground">
          O que o cadastro diz sobre quem está aqui — {data ? `${data.total_perfis} perfis, ${data.com_ritmo_declarado} com ritmo de peso declarado` : 'agregados da camada de dados ouro'}. Nenhum dado individual.
        </p>
      </div>
      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : !data ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Não foi possível carregar o perfil da base.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {distribuicoes.map((d) => (
              <div key={d.titulo} className="rounded-md border p-3 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {d.titulo}
                </p>
                {Object.entries(d.valores)
                  .sort(([, a], [, b]) => b - a)
                  .map(([chave, n]) => (
                    <div key={chave} className="flex items-baseline justify-between text-sm">
                      <span>{ROTULOS[chave] ?? chave}</span>
                      <span className="font-bold">{n}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
          {(data.top_exercicios_rejeitados.length > 0 || data.top_alimentos_rejeitados.length > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { titulo: 'Exercícios mais rejeitados', lista: data.top_exercicios_rejeitados },
                { titulo: 'Alimentos mais rejeitados', lista: data.top_alimentos_rejeitados },
              ].map((bloco) => (
                <div key={bloco.titulo} className="rounded-md border p-3 space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {bloco.titulo}
                  </p>
                  {bloco.lista.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma rejeição registrada.</p>
                  ) : (
                    bloco.lista.map((item) => (
                      <div key={item.nome} className="flex items-baseline justify-between text-sm">
                        <span>{item.nome}</span>
                        <span className="font-bold">{item.pessoas}</span>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
