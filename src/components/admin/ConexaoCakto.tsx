// ConexaoCakto.tsx — o lugar no painel onde o dono LIGA o gateway (C3 · 18/08/2026).
//
// Aqui o dono cola as credenciais da conta Cakto dele: o segredo do webhook
// (o que autentica cada notificação de venda) e, opcionalmente, as chaves
// OAuth da API. A partir daí a esteira que já existe (webhook → gateway_events
// → acesso) passa a funcionar — é a peça que faltava para o dinheiro entrar.
//
// SEGURANÇA: os segredos vão para o banco por admin_cakto_salvar e NUNCA voltam
// em claro. admin_cakto_status devolve só se estão preenchidos + uma dica
// mascarada. Os campos abrem vazios de propósito: em branco = mantém o guardado.

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  PlugZap, Copy, Check, CheckCircle2, XCircle, KeyRound, Loader2, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const dataHora = (v: any) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;

function Indicador({ ok, sim, nao }: { ok: boolean; sim: string; nao: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded',
      ok ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {ok ? sim : nao}
    </span>
  );
}

export default function ConexaoCakto() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    webhook_secret: '', api_client_id: '', api_client_secret: '', ambiente: 'producao',
  });
  const [salvando, setSalvando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const { data: status, isLoading, refetch } = useSupabaseQuery<any>(
    ['admin', 'cakto-status'], async () => {
      const { data, error } = await (supabase as any).rpc('admin_cakto_status');
      return { data, error };
    });

  const s = status ?? {};
  const eventos: string[] = s.eventos_suportados ?? [];
  const ultimoEvento = dataHora(s.ultimo_evento_recebido);
  const temSegredo = !!s.tem_webhook_secret;

  // O estado que importa para o dono, em uma frase.
  const situacao = ultimoEvento
    ? { cor: 'bg-success/15 text-success', texto: 'Recebendo eventos' }
    : temSegredo
      ? { cor: 'bg-primary/15 text-primary', texto: 'Segredo configurado — aguardando o 1º evento' }
      : { cor: 'bg-muted text-muted-foreground', texto: 'Ainda não configurado' };

  const copiar = async (texto: string, id: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      toast({ title: 'Não deu para copiar', description: 'Selecione e copie manualmente.', variant: 'destructive' });
    }
  };

  const salvar = async () => {
    const payload: any = { ambiente: form.ambiente };
    if (form.webhook_secret.trim()) payload.webhook_secret = form.webhook_secret.trim();
    if (form.api_client_id.trim()) payload.api_client_id = form.api_client_id.trim();
    if (form.api_client_secret.trim()) payload.api_client_secret = form.api_client_secret.trim();
    setSalvando(true);
    const { error } = await (supabase as any).rpc('admin_cakto_salvar', { p_dados: payload });
    setSalvando(false);
    if (error) {
      toast({ title: 'Não deu para salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Conexão salva', description: 'As credenciais foram guardadas com segurança.' });
    setForm({ webhook_secret: '', api_client_id: '', api_client_secret: '', ambiente: form.ambiente });
    refetch();
  };

  // Verifica as chaves OAuth chamando a API da Cakto (RPC admin_cakto_testar, C4).
  const verificar = async () => {
    setVerificando(true);
    const { data, error } = await (supabase as any).rpc('admin_cakto_testar');
    setVerificando(false);
    if (error) {
      toast({ title: 'Falha ao verificar', description: error.message, variant: 'destructive' });
      refetch();
      return;
    }
    if (data?.conectado) {
      toast({ title: 'API conectada', description: 'As credenciais da Cakto responderam com sucesso.' });
    } else {
      toast({ title: 'Não conectou', description: data?.erro ?? 'A Cakto recusou as credenciais.', variant: 'destructive' });
    }
    refetch();
  };

  return (
    <div className="bg-card border border-border rounded-md p-5 space-y-4">
      {/* Cabeçalho + estado numa frase */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <PlugZap className="w-3.5 h-3.5" /> Conexão com a Cakto
        </h2>
        <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded', situacao.cor)}>
          {isLoading ? 'Carregando…' : situacao.texto}
        </span>
      </div>

      {/* Indicadores do que já está preenchido */}
      <div className="flex flex-wrap gap-2">
        <Indicador ok={temSegredo} sim={`Segredo do webhook ${s.webhook_secret_dica ?? ''}`} nao="Segredo do webhook" />
        <Indicador ok={!!s.tem_api_client_id} sim={`Client ID ${s.client_id_dica ?? ''}`} nao="Client ID" />
        <Indicador ok={!!s.tem_api_client_secret} sim="Client Secret" nao="Client Secret" />
        <Indicador ok={!!s.conectado} sim="API verificada" nao="API não verificada" />
        {ultimoEvento && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1">
            Último evento: {ultimoEvento} · {s.eventos_recebidos_total ?? 0} no total
          </span>
        )}
      </div>

      {/* Passo 1 — a URL para colar no painel da Cakto + os eventos a assinar */}
      <div className="rounded-md border border-border/70 bg-background/40 p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          1. Na Cakto, crie um webhook apontando para esta URL
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono bg-muted/60 rounded px-2 py-1.5 truncate">
            {s.webhook_url ?? 'https://…/functions/v1/webhook-pagamento'}
          </code>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0"
                  onClick={() => copiar(s.webhook_url ?? '', 'url')} disabled={!s.webhook_url}>
            {copiado === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado === 'url' ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        {eventos.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Assine estes {eventos.length} eventos:</span>
              <button className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                      onClick={() => copiar(eventos.join(', '), 'eventos')}>
                {copiado === 'eventos' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                copiar lista
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {eventos.map((e) => (
                <span key={e} className="text-[10px] font-mono bg-muted/60 text-muted-foreground rounded px-1.5 py-0.5">{e}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Passo 2 — colar as credenciais da conta Cakto */}
      <div className="rounded-md border border-border/70 bg-background/40 p-3 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" /> 2. Cole as credenciais da sua conta Cakto
        </p>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Campos em branco mantêm o que já está guardado. O valor salvo nunca é reexibido — só uma dica dos últimos dígitos.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              Segredo do webhook <span className="text-primary">(essencial)</span>
            </label>
            <Input type="password" className="h-8 text-xs font-mono"
                   placeholder={temSegredo ? '•••• (guardado — deixe em branco para manter)' : 'cole o secret do webhook da Cakto'}
                   value={form.webhook_secret}
                   onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })} />
            <p className="text-[10px] text-muted-foreground">
              A Cakto envia este segredo dentro de cada notificação; é o que prova que a venda é real.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">API Client ID</label>
            <Input className="h-8 text-xs font-mono" placeholder="Integrações → Cakto API"
                   value={form.api_client_id}
                   onChange={(e) => setForm({ ...form, api_client_id: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">API Client Secret</label>
            <Input type="password" className="h-8 text-xs font-mono"
                   placeholder={s.tem_api_client_secret ? '•••• (guardado)' : 'aparece uma vez, na criação da chave'}
                   value={form.api_client_secret}
                   onChange={(e) => setForm({ ...form, api_client_secret: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Ambiente</label>
            <select className="h-8 w-full px-2 rounded-md border border-input bg-background text-xs"
                    value={form.ambiente}
                    onChange={(e) => setForm({ ...form, ambiente: e.target.value })}>
              <option value="producao">Produção</option>
              <option value="teste">Teste</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Salvar conexão
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                  onClick={verificar} disabled={verificando || !s.tem_api_client_secret}
                  title={!s.tem_api_client_secret ? 'Salve as chaves da API antes de verificar' : 'Chama a API da Cakto para conferir as chaves'}>
            {verificando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Verificar credenciais da API
          </Button>
        </div>
        {s.ultimo_erro && (
          <p className="text-[11px] text-destructive">Última verificação: {s.ultimo_erro}</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Depois de conectar, mapeie cada produto da Cakto para um desafio no bloco abaixo — é o que faz uma venda virar acesso.
      </p>
    </div>
  );
}
