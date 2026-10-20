// Comportamento.tsx — o que a base FAZ dentro do app (J4 · 17/08/2026).
//
// Quatro perguntas do dono que nenhuma tela respondia:
//   quando eles usam? · qual tela usam? · o que rejeitam na prática? ·
//   quem paga está usando?
//
// Tudo vem agregado do servidor (metricas_por_hora, telas_mais_usadas,
// rejeicoes_em_uso, uso_por_pagamento). O painel não lê evento linha a
// linha — decisão de 14/08: segmento, não vigilância.

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Clock, Loader2, MonitorSmartphone, ThumbsDown, Timer, Wallet } from 'lucide-react';
import PageHeader from '@/components/admin/PageHeader';
import StatCard from '@/components/admin/StatCard';
import { CHART_COLORS, axisStyle, tooltipStyle } from '@/lib/admin/charts';
import { cn } from '@/lib/utils';

const NOME_DA_TELA: Record<string, string> = {
  inicio: 'Início', treino: 'Treino', treinoDieta: 'Treino & Dieta', dieta: 'Dieta',
  desafio: 'Desafio', desafios: 'Desafios', comunidade: 'Comunidade', perfil: 'Perfil',
  victory: 'Celebração', paywall: 'Paywall', batalha: 'Modo batalha', home: 'Home',
  desconhecida: 'Não identificada',
};

function Bloco({ titulo, icone: Icone, children, dica }: any) {
  return (
    <div className="bg-card border border-border rounded-md p-5">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Icone className="w-3.5 h-3.5" /> {titulo}
      </h2>
      {dica && <p className="text-[11px] text-muted-foreground mt-1">{dica}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Lista({ itens, vazio, render }: any) {
  if (!itens || itens.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{vazio}</p>;
  }
  return <div className="space-y-1.5">{itens.map(render)}</div>;
}

export default function Comportamento() {
  const [dias, setDias] = useState(30);

  const q = (nome: string, chave: string, params: any) =>
    useSupabaseQuery<any>(['admin', chave, String(dias)], async () => {
      const { data, error } = await (supabase as any).rpc(nome, params);
      return { data, error };
    });

  const { data: horas, isLoading: carregandoHoras } = q('metricas_por_hora', 'horas', { p_dias: dias });
  const { data: telas } = q('telas_mais_usadas', 'telas', { p_dias: dias });
  const { data: rejeicoes } = q('rejeicoes_em_uso', 'rejeicoes', { p_dias: dias });
  const { data: pagamento } = q('uso_por_pagamento', 'pagamento', { p_dias: dias });
  const { data: sessao } = q('admin_tempo_de_sessao', 'sessao', { p_dias: dias });
  const sr = sessao?.resumo ?? {};
  const vivemNoApp: any[] = sessao?.por_usuario ?? [];

  // 24 barras sempre — hora sem evento é informação (o app dorme às 4h).
  const serieHoras = Array.from({ length: 24 }, (_, h) => {
    const achado = (horas ?? []).find((x: any) => x.hora === h);
    return { hora: `${String(h).padStart(2, '0')}h`, eventos: achado?.eventos ?? 0 };
  });
  const pico = (horas ?? []).reduce((m: any, x: any) => (!m || x.eventos > m.eventos ? x : m), null);
  const pg = pagamento?.grupos?.pagantes;
  const np = pagamento?.grupos?.nao_pagantes;
  const maisUsada = (telas ?? [])[0];
  const menosUsada = (telas ?? [])[(telas ?? []).length - 1];

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Comportamento"
        subtitulo="Quando usam, o que usam, o que rejeitam na prática e se quem paga aparece. Tudo agregado — nenhum histórico individual."
        acoes={
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDias(d)}
                className={cn('px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                  dias === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {d} dias
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard rotulo="Tempo médio de sessão" icone={Timer} tom="acento"
                  valor={sr.media_min != null ? `${sr.media_min} min` : '—'}
                  contexto={sr.sessoes ? `${sr.sessoes} sessão(ões)` : 'sem dados'} />
        <StatCard rotulo="Horário de pico" icone={Clock} tom="acento"
                  valor={pico ? `${String(pico.hora).padStart(2, '0')}h` : '—'}
                  contexto={pico ? `${pico.eventos} eventos` : 'sem dados'} />
        <StatCard rotulo="Tela mais usada" icone={MonitorSmartphone}
                  valor={maisUsada ? (NOME_DA_TELA[maisUsada.tela] ?? maisUsada.tela) : '—'}
                  contexto={maisUsada ? `${maisUsada.aberturas} aberturas` : ''} />
        <StatCard rotulo="Pagantes sem uso" icone={Wallet}
                  tom={(pagamento?.pagantes_sem_uso ?? 0) > 0 ? 'alerta' : 'sucesso'}
                  valor={pagamento?.pagantes_sem_uso ?? 0}
                  contexto="pagaram e não apareceram" />
        <StatCard rotulo="Grátis muito ativos" icone={ThumbsDown} tom="sucesso"
                  valor={pagamento?.gratis_muito_ativos ?? 0}
                  contexto="15+ dias ativos sem pagar" />
      </div>

      <Bloco titulo="Quem mais vive no app" icone={Timer}
             dica="Minutos dentro do app por sessão no período — é o núcleo mais engajado, alvo natural de um desafio ou produto novo. Melhor esforço: sessões em que o iOS matou o app não entram.">
        {vivemNoApp.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Sem sessões medidas ainda — a duração passa a ser gravada quando as pessoas com a versão nova do app abrirem e fecharem.
          </p>
        ) : (
          <div className="space-y-1.5">
            {vivemNoApp.map((u: any, i: number) => {
              const max = vivemNoApp[0]?.minutos || 1;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm gap-2">
                    <span className="text-foreground truncate">
                      {u.nome}
                      {u.handle && <span className="text-muted-foreground"> · @{u.handle}</span>}
                      <span className={cn('ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
                        u.pagante ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary')}>
                        {u.pagante ? 'pagante' : 'grátis'}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {u.minutos} min · {u.sessoes} sessão(ões) · {u.media_min}/méd
                    </span>
                  </div>
                  <div className="h-1.5 rounded bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(u.minutos / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Horários de pico" icone={Clock}
             dica="Eventos por hora no fuso de São Paulo — é quando faz sentido notificar.">
        {carregandoHoras ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieHoras}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="hora" {...axisStyle} interval={1} />
                <YAxis {...axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="eventos" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Bloco>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bloco titulo="Telas mais e menos usadas" icone={MonitorSmartphone}
               dica={menosUsada ? `A menos aberta é ${NOME_DA_TELA[menosUsada.tela] ?? menosUsada.tela} — vale perguntar se ela precisa existir assim.` : undefined}>
          <Lista itens={telas} vazio="Sem aberturas no período."
            render={(t: any) => {
              const max = (telas ?? [])[0]?.aberturas || 1;
              return (
                <div key={t.tela} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground">{NOME_DA_TELA[t.tela] ?? t.tela}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t.aberturas} · {t.usuarios} pessoa(s)
                    </span>
                  </div>
                  <div className="h-1.5 rounded bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(t.aberturas / max) * 100}%` }} />
                  </div>
                </div>
              );
            }} />
        </Bloco>

        <Bloco titulo="Quem paga está usando?" icone={Wallet}
               dica="O cruzamento entre acesso pago e uso real no período.">
          <div className="space-y-4">
            {[['Pagantes', pg, 'acento'], ['Não pagantes', np, 'neutro']].map(([nome, g]: any) => (
              <div key={nome} className="rounded-md border border-border p-3">
                <p className="text-xs font-bold text-foreground mb-2">{nome}</p>
                {!g ? <p className="text-xs text-muted-foreground italic">sem dados</p> : (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[['pessoas', g.pessoas], ['usaram', g.usaram], ['sumiram', g.nunca_usaram],
                      ['treinos/méd', g.treinos_medio]].map(([r2, v]: any) => (
                      <div key={r2}>
                        <p className="text-lg font-bold text-foreground tabular-nums">{v ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">{r2}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Bloco>
      </div>

      <Bloco titulo="Rejeição na prática" icone={ThumbsDown}
             dica="O que eles trocam e recusam usando o app — diferente do que declararam odiar no cadastro. É o radar do catálogo.">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {[
            ['Refeições trocadas', rejeicoes?.refeicoes_trocadas, (i: any) => `${i.nome} · ${i.trocas}×`],
            ['Refeições puladas', rejeicoes?.refeicoes_puladas, (i: any) => `${i.nome} — ${i.motivo} (${i.vezes}×)`],
            ['Exercícios adaptados', rejeicoes?.exercicios_adaptados, (i: any) => `${i.de} → ${i.para} (${i.vezes}×)`],
            ['Exercícios recusados', rejeicoes?.exercicios_recusados, (i: any) => `${i.nome} · ${i.pessoas} pessoa(s)`],
          ].map(([titulo, itens, fmt]: any) => (
            <div key={titulo}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{titulo}</p>
              <Lista itens={itens} vazio="Nada registrado."
                render={(i: any, idx: number) => (
                  <p key={idx} className="text-xs text-foreground truncate">{fmt(i)}</p>
                )} />
            </div>
          ))}
        </div>
      </Bloco>
    </div>
  );
}
