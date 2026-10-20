// RegrasDeAcessoDoProduto.tsx — "o que este produto libera" (27/08/2026).
//
// A tabela `challenge_access_rules` é a matriz de permissões POR DESAFIO desde
// 03/08 (migration 20260803120000_fundacao_de_acesso.sql), e `tenho_acesso()`
// já a consulta como porteiro único do conteúdo pago. O que faltava era a
// PORTA DE ESCRITA: até hoje as flags só entravam por SQL na mão —
// `salvar_regras_do_desafio` grava em `public.challenges`, não aqui, e o
// ChallengeForm não citava nenhum destes campos.
//
// Este componente é só a TELA. Ele não fala com o banco: recebe o valor e
// devolve o valor mudado. Quem carrega e grava é o ChallengeForm, junto do
// resto do pacote — porque num desafio NOVO o uuid só existe depois que
// `save_challenge_package` responde.
//
// ⚠️ `grants_free_challenges` NÃO aparece aqui de propósito. O contrato da RPC
// de gravação é "chave ausente = campo intocado", e essa bandeira nasce `true`
// no banco: quem compra um produto continua tendo os desafios livres da
// comunidade. Não é decisão de tela — é o piso do produto.

import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  CalendarClock,
  Sparkles,
  Wand2,
  Users,
  LibraryBig,
  ShieldAlert,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  paraCentavos,
  paraTextoDeReais,
  type ModoDeDesbloqueio,
  type RegrasDeAcesso,
} from '@/components/admin/regrasDeAcesso';

interface CaixaDeLiberacao {
  chave: 'grants_own_plan' | 'grants_ai_workout' | 'grants_create_challenges' | 'grants_catalog';
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  detalhe: string;
}

const CAIXAS: CaixaDeLiberacao[] = [
  {
    chave: 'grants_own_plan',
    icone: Sparkles,
    titulo: 'Treino e dieta próprios',
    detalhe:
      'A pessoa passa a montar o próprio treino e o próprio cardápio, fora do que este desafio entrega.',
  },
  {
    chave: 'grants_ai_workout',
    icone: Wand2,
    titulo: 'Gerador por IA',
    detalhe: 'Libera a geração de treino por IA a partir do perfil e do equipamento que ela tem.',
  },
  {
    chave: 'grants_create_challenges',
    icone: Users,
    titulo: 'Criar desafios e convidar',
    detalhe: 'A pessoa cria os próprios desafios e chama outras pelo código de convite.',
  },
  {
    chave: 'grants_catalog',
    icone: LibraryBig,
    titulo: 'Todo o catálogo pago',
    detalhe:
      'Passe geral: entra em QUALQUER desafio pago da plataforma, não só neste. Marque com intenção.',
  },
];

interface Props {
  valor: RegrasDeAcesso;
  aoMudar: (proximo: RegrasDeAcesso) => void;
  /** Ligado quando a migration das RPCs ainda não foi aplicada no banco. */
  portaAusente?: boolean;
  /** Desafio ainda não salvo: as regras vão junto no primeiro "Gravar". */
  desafioNovo?: boolean;
}

export default function RegrasDeAcessoDoProduto({
  valor,
  aoMudar,
  portaAusente = false,
  desafioNovo = false,
}: Props) {
  // O preço vive como texto enquanto está sendo digitado — senão "12," vira
  // "12,00" no meio da digitação e o cursor pula. Só ressincroniza quando o
  // que chega de fora não bate com o que está escrito (carga do servidor).
  const [precoTexto, setPrecoTexto] = useState(() => paraTextoDeReais(valor.price_cents));
  useEffect(() => {
    if (paraCentavos(precoTexto) !== valor.price_cents) {
      setPrecoTexto(paraTextoDeReais(valor.price_cents));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor.price_cents]);

  const mudar = <K extends keyof RegrasDeAcesso>(chave: K, novo: RegrasDeAcesso[K]) =>
    aoMudar({ ...valor, [chave]: novo });

  const liberacoesMarcadas = CAIXAS.filter((c) => valor[c.chave]).length;

  return (
    <div className="bg-card border border-border rounded-md p-6 space-y-5">
      <div className="border-b border-border pb-3">
        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          5 · O que este produto libera
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Quem compra este desafio leva o quê, por quanto tempo, e como o app oferece o
          desbloqueio para quem ainda não comprou.
        </p>
      </div>

      {portaAusente && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-700 dark:text-amber-400 space-y-1">
            <strong className="block">
              A migration destas regras ainda não foi aplicada no banco.
            </strong>
            <span className="block">
              As RPCs <code>admin_regras_de_acesso</code> e{' '}
              <code>admin_salvar_regras_de_acesso</code> não existem lá ainda. O que está abaixo
              mostra os <strong>valores padrão</strong>, não o que o banco guarda — e gravar o
              desafio <strong>não</strong> aplica esta seção. O resto do formulário salva normal.
            </span>
          </div>
        </div>
      )}

      {desafioNovo && !portaAusente && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Desafio novo: estas regras são gravadas junto no primeiro "Gravar Desafio".
        </p>
      )}

      {/* ── É um produto vendido? ─────────────────────────────────────────── */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={valor.is_paid}
          onChange={(e) => mudar('is_paid', e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-input"
        />
        <span className="text-sm">
          <strong className="block text-foreground">É um produto vendido?</strong>
          <span className="text-[11px] text-muted-foreground">
            {valor.is_paid
              ? 'Sim: só entra quem tem uma concessão viva (compra, resgate de código ou cortesia). O conteúdo fica trancado para o resto.'
              : 'Não: desafio livre da comunidade — qualquer pessoa entra sem pagar nada.'}
          </span>
        </span>
      </label>

      {/* ── Por quantos dias o acesso vale ────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="access_days" className="flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
            Por quantos dias o acesso vale
          </Label>
          <Input
            id="access_days"
            type="number"
            min={1}
            placeholder="Deixe vazio para durar o desafio"
            value={valor.access_days ?? ''}
            onChange={(e) => {
              const bruto = e.target.value.trim();
              mudar('access_days', bruto === '' ? null : Math.max(1, Number(bruto)));
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            {valor.access_days
              ? `Conta ${valor.access_days} dia(s) a partir da liberação — depois disso o acesso expira sozinho.`
              : 'Vazio = o acesso dura o período do desafio (do início ao fim dele).'}
          </p>
        </div>

        {valor.is_paid && (
          <div className="space-y-1.5">
            <Label htmlFor="price_cents">Preço (R$)</Label>
            <Input
              id="price_cents"
              inputMode="decimal"
              placeholder="Ex: 49,90"
              value={precoTexto}
              onChange={(e) => {
                setPrecoTexto(e.target.value);
                mudar('price_cents', paraCentavos(e.target.value));
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              {valor.unlock_mode === 'mudo'
                ? 'Só para o painel e os relatórios — no modo "mudo" o app não mostra preço nenhum.'
                : 'Valor exibido junto da oferta de desbloqueio no app.'}
            </p>
          </div>
        )}
      </div>

      {/* ── O que libera além deste desafio ───────────────────────────────── */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
        <div>
          <Label className="text-sm font-semibold">O que libera além deste desafio</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Nada marcado = a compra dá acesso <strong>só ao conteúdo deste desafio</strong>. Os
            desafios livres da comunidade continuam abertos de qualquer jeito — isso não se
            desliga aqui.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {CAIXAS.map(({ chave, icone: Icone, titulo, detalhe }) => {
            const marcado = valor[chave];
            return (
              <label
                key={chave}
                className={`flex items-start gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${
                  marcado ? 'border-primary bg-primary/5' : 'border-border bg-background'
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={(e) => mudar(chave, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span className="text-sm">
                  <strong className="flex items-center gap-1.5 text-foreground">
                    <Icone className="w-3.5 h-3.5 text-primary" />
                    {titulo}
                  </strong>
                  <span className="text-[11px] text-muted-foreground">{detalhe}</span>
                </span>
              </label>
            );
          })}
        </div>

        {valor.grants_catalog && (
          <p className="text-[11px] text-amber-600 dark:text-amber-500">
            Passe geral marcado: quem comprar ESTE desafio entra em todos os outros pagos. Se a
            intenção era vender só este produto, desmarque.
          </p>
        )}

        <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
          <strong className="text-foreground">Resumo: </strong>
          {valor.is_paid ? 'quem comprar ' : 'quem entrar '}
          leva o conteúdo deste desafio
          {liberacoesMarcadas > 0
            ? ` e mais ${liberacoesMarcadas} liberação(ões)`
            : ' e nada além dele'}
          , {valor.access_days ? `por ${valor.access_days} dia(s).` : 'enquanto o desafio durar.'}
        </p>
      </div>

      {/* ── Como a tela oferece o desbloqueio ─────────────────────────────── */}
      {valor.is_paid ? (
        <div className="space-y-2">
          <Label htmlFor="unlock_mode">Como a tela oferece o desbloqueio</Label>
          <select
            id="unlock_mode"
            value={valor.unlock_mode}
            onChange={(e) => mudar('unlock_mode', e.target.value as ModoDeDesbloqueio)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="mudo">Mudo — só informa que faz parte de outro produto</option>
            <option value="iap">Compra dentro do app (StoreKit / Play Billing)</option>
            <option value="externo">Link para a página de vendas — risco de reprovação</option>
          </select>

          {valor.unlock_mode === 'mudo' && (
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-[11px] text-muted-foreground">
              <strong className="text-foreground">Sem risco de loja.</strong> O app diz que o
              conteúdo faz parte de outro produto e para por aí: nenhum preço, nenhum botão de
              compra, nenhum link para fora. É assim que o Flameer vende hoje, com a venda
              acontecendo fora do app e o acesso chegando por código ou por e-mail.
            </div>
          )}

          {valor.unlock_mode === 'iap' && (
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-[11px] text-muted-foreground space-y-1">
              <strong className="text-foreground block">Compra dentro do app.</strong>
              <span className="block">
                O caminho que as lojas aprovam — e o que elas cobram por ele. Exige o produto
                cadastrado na App Store Connect e no Google Play Console com o MESMO
                identificador do campo abaixo; sem isso a tela abre sem nada para vender.
              </span>
            </div>
          )}

          {valor.unlock_mode === 'externo' && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-1">
              <strong className="text-destructive flex items-center gap-1.5 text-[12px]">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                Risco real de reprovação nas lojas
              </strong>
              <span className="block text-[11px] text-destructive/90">
                Mandar o usuário para uma página de vendas para destravar conteúdo digital
                dentro do app é exatamente o que a Apple barra nas regras 3.1.1 (compra fora do
                IAP) e 3.1.3 (link de compra), e o que a política de Pagamentos do Google Play
                proíbe. Uma reprovação aqui pode derrubar a atualização inteira — não só esta
                tela.
              </span>
              <span className="block text-[11px] text-destructive/90">
                Se a venda acontece fora do app, o caminho seguro é <strong>Mudo</strong>: o app
                não oferece nada, e o acesso entra por código de resgate ou por e-mail.
              </span>
            </div>
          )}

          {valor.unlock_mode !== 'mudo' && (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="external_product_ref">
                {valor.unlock_mode === 'iap'
                  ? 'Identificador do produto na loja'
                  : 'Referência do produto no gateway'}
              </Label>
              <Input
                id="external_product_ref"
                value={valor.external_product_ref ?? ''}
                placeholder={
                  valor.unlock_mode === 'iap'
                    ? 'Ex: com.flameer.abdomen.insano'
                    : 'Ex: id do produto na Cakto'
                }
                onChange={(e) =>
                  mudar('external_product_ref', e.target.value.trim() === '' ? null : e.target.value)
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Este campo é só o que o app usa para OFERECER. Quem traduz a venda da Cakto em
                acesso continua sendo o mapeamento da tela de Pagamentos.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Desafio livre não tem desbloqueio para oferecer. Marque "É um produto vendido?" para
          escolher como o app apresenta a compra.
        </p>
      )}
    </div>
  );
}
