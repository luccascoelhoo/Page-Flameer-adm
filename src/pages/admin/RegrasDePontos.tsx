// RegrasDePontos.tsx
// Configuração da economia de PONTOS: o admin define quanto vale cada evento
// sem release do app nem migration. (Chamava-se pontosRules até 12/08/2026, quando
// o produto trocou "XP" por "pontos" — no banco inclusive.)
//
// Dois motores, e a distinção importa:
//  • 'diario'    — estado do dia (post, hábito, treino, dieta, dia perfeito).
//                  Quem calcula é `recalcular_pontos_do_dia`, que recalcula o
//                  dia inteiro e aplica a diferença: desmarcar devolve os pontos.
//  • 'episodico' — fato que aconteceu uma vez (check-in, marco de ofensiva,
//                  desafio concluído). Passa por `conceder_pontos`, é creditado
//                  uma vez só e fica registrado em `pontos_events`.
//  • 'config'    — parâmetro, não evento (curva de nível, teto diário).
//
// POST_DONE entrou em 12/08: é a regra do post na comunidade, o gesto que
// acende a chama. Editável aqui como qualquer outra.

import React, { useState } from 'react';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Zap, Info, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface RegraDePontos {
  code: string;
  label: string;
  motor: 'diario' | 'episodico' | 'config';
  points: number;
  daily_cap: number | null;
  enabled: boolean;
  updated_at: string;
}

interface EventoDePontos {
  id: string;
  user_id: string;
  code: string;
  points: number;
  source_id: string | null;
  day: string;
  created_at: string;
  profiles?: { name: string } | null;
}

const MOTOR_LABEL: Record<RegraDePontos['motor'], string> = {
  diario: 'Diário',
  episodico: 'Episódico',
  config: 'Parâmetro',
};

const MOTOR_HINT: Record<RegraDePontos['motor'], string> = {
  diario: 'Recalculado a cada mudança do dia — desmarcar devolve os pontos.',
  episodico: 'Creditado uma vez e registrado no extrato.',
  config: 'Parâmetro da economia, não é um evento.',
};

export default function RegrasDePontos() {
  const { toast } = useToast();
  const [rascunho, setRascunho] = useState<Record<string, Partial<RegraDePontos>>>({});

  // (supabase as any): o client é tipado sem o `Database` gerado, então nomes
  // de tabela/RPC resolvem para `never` e o select/update não compila. É a
  // convenção já usada no painel (CodigosDeAcesso, UsoDoApp) até o dia em que
  // os tipos gerados forem versionados.
  const { data: regras, isLoading, refetch } = useSupabaseQuery<RegraDePontos[]>(
    ['pontos_rules'],
    () => (supabase as any).from('pontos_rules').select('*').order('motor').order('code'),
  );

  // Extrato recente: é o que permite responder "por que ganhei só 40 pontos ontem?".
  const { data: extrato } = useSupabaseQuery<EventoDePontos[]>(
    ['pontos_events_recentes'],
    () => (supabase as any)
      .from('pontos_events')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(50),
  );

  const salvar = useSupabaseMutation<RegraDePontos, null>(
    async (regra) => (supabase as any)
      .from('pontos_rules')
      .update({
        points: regra.points,
        daily_cap: regra.daily_cap,
        enabled: regra.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('code', regra.code),
    {
      onSuccess: (_d, regra) => {
        toast({ title: 'Regra salva', description: `${regra.label}: ${regra.points} pontos` });
        setRascunho((r) => {
          const { [regra.code]: _, ...resto } = r;
          return resto;
        });
        refetch();
      },
      onError: (e) => toast({
        title: 'Não deu para salvar',
        description: e?.message ?? 'Confira sua conexão e tente de novo.',
        variant: 'destructive',
      }),
    },
  );

  const valorAtual = (r: RegraDePontos, campo: 'points' | 'daily_cap' | 'enabled') =>
    rascunho[r.code]?.[campo] ?? r[campo];

  const alterado = (code: string) => Boolean(rascunho[code]);

  const editar = (code: string, campo: keyof RegraDePontos, valor: unknown) =>
    setRascunho((r) => ({ ...r, [code]: { ...r[code], [campo]: valor } }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const porMotor = (motor: RegraDePontos['motor']) => (regras ?? []).filter((r) => r.motor === motor);

  const tabela = (motor: RegraDePontos['motor']) => {
    const linhas = porMotor(motor);
    if (linhas.length === 0) return null;
    return (
      <section className="mb-10">
        <div className="mb-2">
          <h2 className="text-lg font-semibold">{MOTOR_LABEL[motor]}</h2>
          <p className="text-sm text-muted-foreground">{MOTOR_HINT[motor]}</p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead className="w-32 text-right">Pontos</TableHead>
                {motor === 'episodico' && <TableHead className="w-32 text-right">Máx/dia</TableHead>}
                <TableHead className="w-24 text-center">Ativo</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((r) => (
                <TableRow key={r.code}>
                  <TableCell>
                    <div className="font-medium">{r.label}</div>
                    <code className="text-xs text-muted-foreground">{r.code}</code>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={100000}
                      className="w-24 text-right"
                      value={String(valorAtual(r, 'points') ?? 0)}
                      onChange={(e) => editar(r.code, 'points', Number(e.target.value))}
                      aria-label={`pontos de ${r.label}`}
                    />
                  </TableCell>
                  {motor === 'episodico' && (
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={1}
                        placeholder="—"
                        className="w-20 text-right"
                        value={valorAtual(r, 'daily_cap') === null ? '' : String(valorAtual(r, 'daily_cap'))}
                        onChange={(e) => editar(
                          r.code,
                          'daily_cap',
                          e.target.value === '' ? null : Number(e.target.value),
                        )}
                        aria-label={`Máximo por dia de ${r.label}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <Switch
                      checked={Boolean(valorAtual(r, 'enabled'))}
                      onCheckedChange={(v) => editar(r.code, 'enabled', v)}
                      aria-label={`Ativar ${r.label}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={alterado(r.code) ? 'default' : 'ghost'}
                      disabled={!alterado(r.code) || salvar.isPending}
                      onClick={() => salvar.mutate({ ...r, ...rascunho[r.code] } as RegraDePontos)}
                    >
                      {salvar.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <><Save className="mr-1 h-3.5 w-3.5" />Salvar</>}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    );
  };

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Zap className="h-6 w-6 text-orange-500" />
          Economia de Pontos
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Estes valores valem para o app inteiro, sem precisar de release.
        </p>
      </header>

      <div className="mb-8 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-sm">
          <p className="font-medium">Mudar um valor afeta o dia corrente.</p>
          <p className="mt-1 text-muted-foreground">
            Os eventos <b>diários</b> são recalculados a cada mudança que o usuário faz no dia,
            então aumentar o pontos do hábito hoje já muda o total de hoje. Os <b>episódicos</b> guardam
            o valor que valia na hora da concessão — quem já ganhou não é reajustado.
          </p>
        </div>
      </div>

      {tabela('diario')}
      {tabela('episodico')}
      {tabela('config')}

      <section>
        <div className="mb-2 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Extrato recente</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Últimas 50 concessões episódicas. Serve para responder de onde veio (ou por que não veio)
          o pontos de um usuário.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead className="text-right">Pontos</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(extrato ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma concessão episódica ainda.
                  </TableCell>
                </TableRow>
              )}
              {(extrato ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.profiles?.name ?? '—'}</TableCell>
                  <TableCell><code className="text-xs">{e.code}</code></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {/* 0 = marco de ofensiva já passado quando a regra entrou:
                        registrado para não creditar retroativo. */}
                    {e.points === 0
                      ? <span className="text-muted-foreground">0 (retroativo)</span>
                      : e.points}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.source_id ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
