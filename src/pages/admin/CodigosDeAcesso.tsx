// CodigosDeAcesso.tsx — a esteira de venda por código, do lado da gerência.
//
// NÃO confundir com ReferralCodes (cupons de indicação). Esta página gerencia
// os códigos de COMPRA: os que a LP emite via gateway e os que o admin gera à
// mão para cortesia/suporte. Criada em 14/08/2026, junto com a migration
// 20260814120000 — antes, códigos de compra eram improvisados na tabela de
// cupons, com Math.random() no navegador, sem expiração por padrão e sem
// registro de quem resgatou.
//
// Tudo aqui passa por RPC com portão de admin (`admin_emitir_codigo_de_acesso`
// e `admin_listar_codigos_de_acesso`) — a tabela crua não tem grant nenhum
// para `authenticated`, de propósito.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, KeyRound, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface CodigoDeAcesso {
  id: string;
  code: string;
  challenge_id: string;
  challenge_title: string;
  origem: 'gateway' | 'manual';
  email_da_compra: string | null;
  order_ref: string | null;
  expires_at: string;
  redeemed: boolean;
  redeemed_by_name: string | null;
  redeemed_at: string | null;
  created_at: string;
}

interface DesafioOpcao { id: string; title: string }

export default function CodigosDeAcesso() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [desafioId, setDesafioId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [expiraDias, setExpiraDias] = useState('90');
  const [copiado, setCopiado] = useState<string | null>(null);

  const { data: desafios } = useQuery({
    queryKey: ['desafios-para-codigo'],
    queryFn: async (): Promise<DesafioOpcao[]> => {
      const { data, error } = await supabase
        .from('challenges').select('id, title').order('title');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: codigos, isLoading, isError, refetch } = useQuery({
    queryKey: ['codigos-de-acesso'],
    queryFn: async (): Promise<CodigoDeAcesso[]> => {
      const { data, error } = await (supabase as any)
        .rpc('admin_listar_codigos_de_acesso', { p_challenge_id: null });
      if (error) throw error;
      return data ?? [];
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      if (!desafioId) throw new Error('Escolha o desafio.');
      const { data, error } = await (supabase as any)
        .rpc('admin_emitir_codigo_de_acesso', {
          p_challenge_id: desafioId,
          p_quantidade: Math.max(1, Math.min(100, Number(quantidade) || 1)),
          p_expira_dias: Math.max(1, Math.min(730, Number(expiraDias) || 90)),
        });
      if (error) throw error;
      return (data ?? []) as { code: string }[];
    },
    onSuccess: (novos) => {
      queryClient.invalidateQueries({ queryKey: ['codigos-de-acesso'] });
      toast({
        title: `${novos.length} código${novos.length === 1 ? '' : 's'} gerado${novos.length === 1 ? '' : 's'}`,
        description: novos.map((n) => n.code).join(' · '),
      });
    },
    onError: (e: Error) =>
      toast({ title: 'Não gerou', description: e.message, variant: 'destructive' }),
  });

  const copiar = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiado(code);
    setTimeout(() => setCopiado(null), 1600);
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="w-6 h-6" /> Códigos de acesso
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Códigos de COMPRA (uso único, expiração obrigatória). Os automáticos
          nascem no webhook do gateway; os manuais, aqui. Cupons de indicação
          continuam na página própria.
        </p>
      </div>

      {/* Geração manual — cortesia e suporte */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Desafio</label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-56"
            value={desafioId}
            onChange={(e) => setDesafioId(e.target.value)}
          >
            <option value="">Escolha…</option>
            {(desafios ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Quantidade</label>
          <Input className="w-24" type="number" min={1} max={100}
                 value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Expira em (dias)</label>
          <Input className="w-28" type="number" min={1} max={730}
                 value={expiraDias} onChange={(e) => setExpiraDias(e.target.value)} />
        </div>
        <Button onClick={() => gerar.mutate()} disabled={gerar.isPending || !desafioId}>
          {gerar.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : 'Gerar código(s)'}
        </Button>
      </div>

      {/* A lista — com quem resgatou, que era o que o painel não sabia dizer */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : isError ? (
        /* Falha de RPC NÃO pode virar "Nenhum código ainda" — numa página de
           dinheiro, o falso negativo faz o admin achar que a venda não gerou
           código (achado da rodada 3). */
        <div className="rounded-md border border-destructive/40 p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-destructive">Não foi possível carregar os códigos.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Desafio</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Compra</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead>Resgate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(codigos ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-semibold">
                  <button
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                    onClick={() => copiar(c.code)}
                    title="Copiar"
                  >
                    {c.code}
                    {copiado === c.code
                      ? <Check className="w-3.5 h-3.5 text-green-600" />
                      : <Copy className="w-3.5 h-3.5 opacity-40" />}
                  </button>
                </TableCell>
                <TableCell className="text-sm">{c.challenge_title}</TableCell>
                <TableCell className="text-xs">
                  <span className={c.origem === 'gateway'
                    ? 'rounded bg-blue-500/10 px-2 py-0.5 text-blue-600'
                    : 'rounded bg-muted px-2 py-0.5'}>
                    {c.origem === 'gateway' ? 'Venda' : 'Manual'}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.email_da_compra ?? '—'}
                  {c.order_ref ? <div className="text-[10px]">{c.order_ref}</div> : null}
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(c.expires_at) <= new Date()
                    ? <span className="text-destructive">expirou {fmt(c.expires_at)}</span>
                    : fmt(c.expires_at)}
                </TableCell>
                <TableCell className="text-xs">
                  {c.redeemed
                    ? <span>✓ {c.redeemed_by_name ?? 'conta'} · {fmt(c.redeemed_at)}</span>
                    : <span className="text-muted-foreground">disponível</span>}
                </TableCell>
              </TableRow>
            ))}
            {(codigos ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum código ainda. Os de venda aparecem sozinhos quando o
                  gateway estiver ligado; os manuais nascem no formulário acima.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
