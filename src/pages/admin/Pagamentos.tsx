// Pagamentos.tsx — o dinheiro, com olhos (J5 · 17/08/2026).
//
// A esteira existe desde 14/08 (webhook → gateway_events → código → acesso)
// e nunca teve tela: o próprio comentário do webhook manda "mapeie o produto
// no painel", numa página que não existia. Aqui estão as quatro coisas que a
// gerência precisa ver: quanto entrou, o que cada evento fez, quem pagou e
// NÃO recebeu, e o mapa produto→desafio.

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, CreditCard, Link2, Loader2, RefreshCw, TrendingUp, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/admin/PageHeader';
import StatCard from '@/components/admin/StatCard';
import ConexaoCakto from '@/components/admin/ConexaoCakto';
import { useToast } from '@/hooks/use-toast';
import { useConfirmar } from '@/components/admin/Confirmar';
import { CHART_COLORS, axisStyle, tooltipStyle } from '@/lib/admin/charts';
import { cn } from '@/lib/utils';

const brl = (c: any) =>
  c == null ? '—' : (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = (v: any) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const STATUS_META: Record<string, string> = {
  aplicado: 'bg-success/15 text-success',
  erro: 'bg-destructive/15 text-destructive',
  intencao: 'bg-primary/15 text-primary',
  ignorado: 'bg-muted text-muted-foreground',
  recebido: 'bg-secondary text-foreground',
};

export default function Pagamentos() {
  const { toast } = useToast();
  const confirmar = useConfirmar();
  const [dias, setDias] = useState(30);
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const [novoMapa, setNovoMapa] = useState({ gateway: 'cakto', produto: '', challenge_id: '', dias: '' });

  const { data, isLoading, refetch } = useSupabaseQuery<any>(
    ['admin', 'pagamentos', String(dias)], async () => {
      const { data, error } = await (supabase as any)
        .rpc('admin_painel_de_pagamentos', { p_dias: dias });
      return { data, error };
    });

  const { data: desafios } = useSupabaseQuery<any[]>(['admin', 'desafios-mapa'], async () => {
    const { data, error } = await (supabase as any)
      .from('challenges').select('id, title').order('title');
    return { data, error };
  });

  // OS PRODUTOS VÊM DA CAKTO, E NÃO DA MEMÓRIA DE QUEM DIGITA.
  //
  // Até 31/08/2026 o campo abaixo era texto livre: colava-se um UUID de 36
  // caracteres à mão. Errar um caractere não dá erro na hora — dá uma venda
  // que cai como "produto não mapeado", e a edge function responde 200 ao
  // gateway assim mesmo, então ele nunca reenvia. A venda some em silêncio.
  //
  // E há um erro pior que o de digitação, medido na conta real: existem DOIS
  // produtos chamados "Desafio Abdômen Insano", ambos R$ 42, ambos ativos —
  // um com oferta de assinatura (entrega fora do app, 238 assinantes) e outro
  // de pagamento único (a campanha nova, entrega dentro do app). Escolher o
  // primeiro não dá erro nenhum: dá acesso no app a cada renovação de
  // assinante antigo.
  //
  // Por isso a lista mostra o TIPO da oferta e marca o que já está mapeado.
  // A credencial da Cakto não passa por aqui: quem chama a API é o servidor,
  // em `admin_cakto_produtos()`.
  const { data: produtosCakto, isLoading: carregandoProdutos } =
    useSupabaseQuery<any>(['admin', 'cakto-produtos'], async () => {
      const { data, error } = await (supabase as any).rpc('admin_cakto_produtos');
      return { data, error };
    });
  const listaCakto: any[] = produtosCakto?.ok ? (produtosCakto.produtos ?? []) : [];

  const resumo = data?.resumo ?? {};
  const transacoes: any[] = data?.transacoes ?? [];
  const pendencias: any[] = data?.pendencias ?? [];
  const produtos: any[] = data?.produtos ?? [];
  const serie = (data?.por_dia ?? []).map((d: any) => ({
    dia: String(d.dia).slice(5), reais: Number(d.centavos) / 100,
  }));

  const reprocessar = async (t: any) => {
    if (!await confirmar({
      titulo: 'Reprocessar este evento?',
      descricao: `O evento ${t.evento} de ${t.email ?? 'sem e-mail'} será processado de novo — se der certo, o acesso é concedido agora.`,
      confirmar: 'Reprocessar',
    })) return;
    setReprocessando(t.id);
    const { data: res, error } = await (supabase as any)
      .rpc('admin_reprocessar_evento', { p_id: t.id });
    setReprocessando(null);
    if (error) {
      toast({ title: 'Não deu para reprocessar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Reprocessado', description: `Resultado: ${res?.status ?? 'sem status'}` });
    refetch();
  };

  // LIBERAR À MÃO — o botão que faltava embaixo do alarme.
  //
  // A tela mostrava "pagou e não recebeu" desde 17/08 e não tinha o que fazer
  // a respeito: `grep 'conceder_acesso'` no schema devolvia zero, e a única
  // concessão manual era o lote de códigos de `/codigos`, que serve para
  // cortesia planejada e não para consertar um comprador específico.
  //
  // ⚠️ E "liberar a pendência" não é a ação certa: uma pendência JÁ está
  // esperando, e `materializar_acessos_pendentes()` a consome sozinha no
  // primeiro login. O caso que de fato trava é outro — a pessoa comprou com um
  // e-mail e se cadastrou com outro. Por isso o campo é o e-mail, escolhido, e
  // não um botão preso à linha da pendência.
  const [liberar, setLiberar] = useState({ email: '', challenge_id: '', dias: '', motivo: '' });
  const [liberando, setLiberando] = useState(false);

  const liberarAcesso = async () => {
    if (!liberar.email.trim() || !liberar.challenge_id) {
      toast({ title: 'Faltam dados', description: 'Informe o e-mail e o desafio.', variant: 'destructive' });
      return;
    }
    setLiberando(true);
    const { data: r, error } = await (supabase as any).rpc('admin_conceder_acesso', {
      p_email: liberar.email.trim(),
      p_challenge_id: liberar.challenge_id,
      p_dias: liberar.dias ? Number(liberar.dias) : null,
      p_motivo: liberar.motivo.trim() || null,
    });
    setLiberando(false);
    if (error) {
      toast({ title: 'Não deu para liberar', description: error.message, variant: 'destructive' });
      return;
    }
    // As quatro situações são distintas e o dono precisa saber qual foi:
    // conceder de novo quem já tinha não é erro, mas também não é conquista.
    const msg: Record<string, string> = {
      concedido: 'Acesso liberado. A pessoa já vê o desafio ao abrir o app.',
      ja_tinha: 'Essa conta já tinha acesso ativo — nada foi duplicado.',
      pendencia_criada: r?.aviso ?? 'Ficou esperando: o acesso entra no primeiro login com esse e-mail.',
      ja_pendente: 'Já havia uma pendência para esse e-mail e desafio.',
    };
    toast({ title: r?.desafio ?? 'Pronto', description: msg[r?.situacao] ?? JSON.stringify(r) });
    setLiberar({ ...liberar, email: '', motivo: '' });
    refetch();
  };

  const mapear = async () => {
    if (!novoMapa.produto.trim() || !novoMapa.challenge_id) {
      toast({ title: 'Faltam dados', description: 'Informe o ID do produto no gateway e o desafio.', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).rpc('admin_mapear_produto', {
      p_gateway: novoMapa.gateway,
      p_produto_externo: novoMapa.produto.trim(),
      p_challenge_id: novoMapa.challenge_id,
      p_dias_de_acesso: novoMapa.dias ? Number(novoMapa.dias) : null,
      p_ativo: true,
    });
    if (error) {
      toast({ title: 'Não deu para mapear', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Produto mapeado', description: 'Vendas desse produto passam a liberar o desafio.' });
    setNovoMapa({ ...novoMapa, produto: '', dias: '' });
    refetch();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Pagamentos"
        subtitulo="O que a Cakto informou, o que virou acesso e o que ficou pelo caminho. Nenhum dado de cartão é armazenado por nós."
        acoes={
          <div className="flex gap-1">
            {[7, 30, 90, 365].map((d) => (
              <button key={d} onClick={() => setDias(d)}
                className={cn('px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                  dias === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {d === 365 ? '1 ano' : `${d}d`}
              </button>
            ))}
          </div>
        }
      />

      <ConexaoCakto />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard rotulo="Receita no período" valor={brl(resumo.receita_centavos)} icone={TrendingUp} tom="sucesso"
                  contexto={`${resumo.aprovados ?? 0} aprovado(s)`} />
        <StatCard rotulo="Ticket médio" valor={brl(resumo.ticket_medio_centavos)} icone={CreditCard} />
        <StatCard rotulo="Estornos" valor={brl(resumo.valor_estornado_centavos)} icone={Undo2}
                  tom={(resumo.estornos ?? 0) > 0 ? 'alerta' : 'neutro'}
                  contexto={`${resumo.estornos ?? 0} evento(s)`} />
        <StatCard rotulo="Intenções (pix gerado)" valor={resumo.intencoes ?? 0} icone={Loader2}
                  contexto="geraram e ainda não pagaram" />
        <StatCard rotulo="Eventos com erro" valor={resumo.erros ?? 0} icone={AlertTriangle}
                  tom={(resumo.erros ?? 0) > 0 ? 'alerta' : 'sucesso'} />
      </div>

      {/* PENDÊNCIAS — o alarme que estava mudo */}
      {pendencias.length > 0 && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-md p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Pagou e não recebeu ({pendencias.length})
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Compras confirmadas cujo acesso não chegou — geralmente conta ainda não criada com esse e-mail.
          </p>
          <div className="mt-3 space-y-2">
            {pendencias.map((p, i) => (
              <div key={i} className="text-xs flex items-center justify-between gap-3">
                <span className="font-semibold text-foreground">{p.email}</span>
                <span className="text-muted-foreground truncate">
                  {p.desafio ?? 'sem desafio'} · {p.tentativas ?? 0} tentativa(s)
                  {p.ultimo_erro ? ` · ${p.ultimo_erro}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIBERAR À MÃO — o conserto, ao lado do alarme */}
      <div className="bg-card border border-border rounded-md p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Liberar acesso à mão
        </h2>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-2xl">
          Para quem pagou e ficou sem acesso. Se o e-mail já tem conta confirmada, o desafio
          libera na hora. Se ainda não tem, fica esperando e entra sozinho no primeiro login —
          é a mesma via que o gateway usa, não um atalho.
        </p>
        <div className="flex flex-wrap items-end gap-2 mt-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">E-mail</label>
            <Input className="h-8 w-64 text-xs" type="email" placeholder="o e-mail da pessoa"
                   value={liberar.email}
                   onChange={(e) => setLiberar({ ...liberar, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Desafio</label>
            <select className="h-8 w-56 px-2 rounded-md border border-input bg-background text-xs"
                    value={liberar.challenge_id}
                    onChange={(e) => setLiberar({ ...liberar, challenge_id: e.target.value })}>
              <option value="">Escolha…</option>
              {(desafios ?? []).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Dias</label>
            <Input className="h-8 w-24 text-xs" type="number" placeholder="regra"
                   value={liberar.dias}
                   onChange={(e) => setLiberar({ ...liberar, dias: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Motivo</label>
            <Input className="h-8 w-56 text-xs" placeholder="fica no registro"
                   value={liberar.motivo}
                   onChange={(e) => setLiberar({ ...liberar, motivo: e.target.value })} />
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={liberarAcesso} disabled={liberando}>
            {liberando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Liberar'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Deixe <strong>Dias</strong> em branco para seguir a regra do desafio. Toda liberação
          fica registrada com o motivo — o histórico é o que responde “por que essa pessoa tem
          acesso?” daqui a seis meses.
        </p>
      </div>

      {/* Receita por dia */}
      <div className="bg-card border border-border rounded-md p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receita por dia</h2>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : serie.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-12 text-center">
            Nenhuma venda no período. Quando o gateway estiver ligado e um produto mapeado, as vendas aparecem aqui.
          </p>
        ) : (
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="dia" {...axisStyle} />
                <YAxis {...axisStyle} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`R$ ${v}`, 'receita']} />
                <Area type="monotone" dataKey="reais" stroke={CHART_COLORS.primary}
                      fill={CHART_COLORS.primary} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Mapa produto → desafio */}
      <div className="bg-card border border-border rounded-md p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5" /> Produtos do gateway → desafio
        </h2>
        <p className="text-[11px] text-muted-foreground mt-1">
          Sem este mapa, uma venda aprovada não sabe qual desafio liberar e vira evento com erro.
        </p>
        <div className="flex flex-wrap items-end gap-2 mt-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Gateway</label>
            <Input className="h-8 w-28 text-xs" value={novoMapa.gateway}
                   onChange={(e) => setNovoMapa({ ...novoMapa, gateway: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Produto na Cakto</label>
            {listaCakto.length > 0 ? (
              // O caminho normal: escolher da conta real.
              <select className="h-8 w-72 px-2 rounded-md border border-input bg-background text-xs"
                      value={novoMapa.produto}
                      onChange={(e) => setNovoMapa({ ...novoMapa, produto: e.target.value })}>
                <option value="">Escolha…</option>
                {listaCakto.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ja_mapeado ? '🔗 ' : ''}{p.nome}
                    {p.tipo ? ` · ${p.tipo === 'subscription' ? 'assinatura' : 'pagamento único'}` : ''}
                    {p.preco ? ` · R$ ${p.preco}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              // DEGRADA, NÃO QUEBRA. Se a credencial da Cakto não estiver
              // configurada ou a API estiver fora, o campo volta a ser texto
              // livre — mapear à mão continua possível. Bloquear aqui seria
              // trocar um risco de digitação por uma tela inútil.
              <Input className="h-8 w-72 text-xs"
                     placeholder={carregandoProdutos ? 'carregando da Cakto…' : 'id que a Cakto envia'}
                     value={novoMapa.produto}
                     onChange={(e) => setNovoMapa({ ...novoMapa, produto: e.target.value })} />
            )}
            {!carregandoProdutos && listaCakto.length === 0 && (
              <p className="text-[10px] text-amber-600 max-w-72">
                Não consegui listar os produtos da Cakto. Confira a conexão logo acima —
                se as chaves foram rotacionadas, é preciso salvá-las de novo.
              </p>
            )}
            {listaCakto.length > 0 && (
              <p className="text-[10px] text-muted-foreground max-w-72">
                🔗 = já mapeado. ⚠️ Confira o tipo: produto de <strong>assinatura</strong> libera
                acesso a cada renovação, inclusive de cliente antigo.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Desafio</label>
            <select className="h-8 w-56 px-2 rounded-md border border-input bg-background text-xs"
                    value={novoMapa.challenge_id}
                    onChange={(e) => setNovoMapa({ ...novoMapa, challenge_id: e.target.value })}>
              <option value="">Escolha…</option>
              {(desafios ?? []).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Dias de acesso</label>
            <Input className="h-8 w-28 text-xs" type="number" placeholder="padrão"
                   value={novoMapa.dias} onChange={(e) => setNovoMapa({ ...novoMapa, dias: e.target.value })} />
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={mapear}>Mapear</Button>
        </div>

        <div className="mt-4 space-y-1.5">
          {produtos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nenhum produto mapeado ainda — é isto que falta para a primeira venda virar acesso automático.
            </p>
          ) : produtos.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5 last:border-0">
              <span className="font-mono text-foreground">{p.gateway} · {p.produto_externo}</span>
              <span className="text-muted-foreground">
                → {p.desafio ?? 'desafio removido'}
                {p.dias_de_acesso ? ` · ${p.dias_de_acesso} dias` : ''}
                {!p.ativo && ' · inativo'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transações */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Transações ({transacoes.length})
          </h2>
        </div>
        {transacoes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground italic">
            Nenhum evento recebido no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2">Quando</th><th className="px-4 py-2">E-mail</th>
                  <th className="px-4 py-2">Evento</th><th className="px-4 py-2">Desafio</th>
                  <th className="px-4 py-2">Método</th><th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2">Status</th><th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {transacoes.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{dataHora(t.recebido_em)}</td>
                    <td className="px-4 py-2 text-xs truncate max-w-[180px]">{t.email ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">{t.evento}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[160px]">
                      {t.desafio ?? (t.produto_externo ? `produto ${t.produto_externo} sem mapa` : '—')}
                    </td>
                    <td className="px-4 py-2 text-xs">{t.metodo ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{brl(t.valor_centavos)}</td>
                    <td className="px-4 py-2">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
                        STATUS_META[t.status] ?? 'bg-muted text-muted-foreground')}>{t.status}</span>
                      {t.erro && <div className="text-[10px] text-destructive mt-0.5 max-w-[200px] truncate">{t.erro}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {t.status === 'erro' && (
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1"
                                onClick={() => reprocessar(t)} disabled={reprocessando === t.id}>
                          {reprocessando === t.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <RefreshCw className="w-3 h-3" />}
                          Reprocessar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
