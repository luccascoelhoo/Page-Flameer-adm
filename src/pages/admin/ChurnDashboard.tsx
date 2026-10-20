// ChurnDashboard.tsx — o funil de saída.
//
// ─────────────────────────────────────────────────────────────────
// AS DUAS REGRAS QUE ESTE PAINEL EXISTE PARA CUMPRIR
// ─────────────────────────────────────────────────────────────────
// 1. OS DOIS CHURNS APARECEM SEPARADOS, e no primeiro gráfico. Somá-los é o
//    defeito mais caro que um painel de assinatura pode ter: churn voluntário
//    (a pessoa decidiu sair) combate-se com produto; churn involuntário (o
//    cartão falhou) combate-se com mecânica — período de graça, recobrança,
//    aviso. Um número só faz a equipe passar meses melhorando o produto quando
//    metade da perda era cartão vencido.
//
// 2. A TAXA DE SAVE NUNCA É LIDA SOZINHA. Ela vem sempre ao lado de
//    "cancelamento fora do app" e "retomada D+90". Save subindo junto com
//    cancelamento fora do app não significa que a retenção melhorou — significa
//    que o fluxo virou obstáculo e a pessoa foi cancelar pelos Ajustes do
//    iPhone, onde não temos nada a oferecer.
//
// Consome EXCLUSIVAMENTE a RPC `get_churn_funnel`, que já exige
// `is_platform_admin()`. Nenhuma agregação no cliente: dois lugares contando a
// mesma coisa acabam discordando, e aí ninguém sabe qual acreditar.

import React, { useMemo, useState } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { supabase } from '@/integrations/supabase/client'
import { TrendingDown, CreditCard, Snowflake, Info, Loader2 } from 'lucide-react'

// Slots 1 e 2 da paleta categórica, validados para daltonismo (ΔE 26.5 protan,
// 32.3 visão normal, contraste ≥ 3:1 na superfície clara).
const COR_VOLUNTARIO = '#d4620a'   // decisão humana
const COR_INVOLUNTARIO = '#2a78d6' // cartão falhou
const TEXTO = '#1c1c1e'
const SECUNDARIO = '#6b7280'
const GRADE = '#e5e7eb'

type Funil = Record<string, number>

function diasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PERIODOS = [
  { rotulo: '7 dias', dias: 7 },
  { rotulo: '30 dias', dias: 30 },
  { rotulo: '90 dias', dias: 90 },
]

export default function ChurnDashboard() {
  const [dias, setDias] = useState(30)
  const de = useMemo(() => diasAtras(dias), [dias])
  const ate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const { data: funil, isLoading, error } = useSupabaseQuery<Funil>(
    ['admin', 'churn', de, ate],
    async () => {
      const { data, error } = await (supabase as any).rpc('get_churn_funnel', {
        p_from: de, p_to: ate,
      })
      return { data: (data ?? {}) as Funil, error }
    },
  )

  const n = (chave: string) => Number(funil?.[chave] ?? 0)

  // Voluntário = decidiu sair. Involuntário = a cobrança falhou.
  const voluntario = n('auto_renew_off') + n('expired')
  const involuntario = n('expired_involuntary') + n('grace_expired')

  const intencao = n('cancel_intent')
  const congelou = n('frozen')
  const concluiuCancelamento = n('auto_renew_off')

  // Taxa de save: de quem abriu o cancelamento, quantos congelaram.
  const taxaSave = intencao > 0 ? (congelou / intencao) * 100 : null

  // CANCELAMENTO FORA DO APP: cancelou sem ter passado pela nossa tela.
  // É o contraponto obrigatório da taxa de save.
  const foraDoApp = Math.max(0, concluiuCancelamento - intencao)
  const pctForaDoApp = concluiuCancelamento > 0
    ? (foraDoApp / concluiuCancelamento) * 100 : null

  const retomada = n('expired') > 0 ? (n('reactivated') / n('expired')) * 100 : null
  const recuperacaoCobranca = n('billing_failed') > 0
    ? (1 - n('grace_expired') / n('billing_failed')) * 100 : null

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm" style={{ color: SECUNDARIO }}>
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando o funil…
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm font-medium" style={{ color: TEXTO }}>
          Não foi possível carregar o funil.
        </p>
        <p className="mt-1 text-sm" style={{ color: SECUNDARIO }}>
          {String((error as any)?.message ?? error)}
        </p>
      </div>
    )
  }

  const totalChurn = voluntario + involuntario

  return (
    <div className="space-y-8 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-sans" style={{ color: TEXTO }}>Churn</h1>
          <p className="mt-1 text-sm" style={{ color: SECUNDARIO }}>
            Quem saiu, por qual motivo, e o que foi recuperado.
          </p>
        </div>
        {/* Filtros numa linha só, acima dos gráficos. */}
        <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: GRADE }}>
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className="rounded-md px-3 py-1.5 text-sm font-medium transition"
              style={dias === p.dias
                ? { background: TEXTO, color: '#fff' }
                : { color: SECUNDARIO }}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </header>

      {/* ─── 1. OS DOIS CHURNS, SEPARADOS ─── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: SECUNDARIO }}>
          Saídas por natureza
        </h2>
        <p className="mt-1 text-sm" style={{ color: SECUNDARIO }}>
          Nunca somados: um se combate com produto, o outro com mecânica de cobrança.
        </p>

        {totalChurn === 0 ? (
          <p className="mt-6 text-sm" style={{ color: SECUNDARIO }}>
            Nenhuma saída registrada neste período.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <BarraNomeada
              rotulo="Voluntário"
              descricao="A pessoa decidiu sair"
              valor={voluntario}
              total={totalChurn}
              cor={COR_VOLUNTARIO}
            />
            <BarraNomeada
              rotulo="Involuntário"
              descricao="A cobrança falhou — ninguém decidiu nada"
              valor={involuntario}
              total={totalChurn}
              cor={COR_INVOLUNTARIO}
            />
          </div>
        )}

        {/* Legenda: identidade nunca fica só na cor. */}
        <div className="mt-5 flex flex-wrap gap-5 text-sm" style={{ color: SECUNDARIO }}>
          <Chave cor={COR_VOLUNTARIO} texto="Voluntário" />
          <Chave cor={COR_INVOLUNTARIO} texto="Involuntário" />
        </div>
      </section>

      {/* ─── 2. A TAXA DE SAVE, E OS DOIS NÚMEROS QUE A QUALIFICAM ─── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: SECUNDARIO }}>
          Retenção
        </h2>
        <div
          className="mt-2 flex items-start gap-2 rounded-lg p-3 text-sm"
          style={{ background: '#f3f4f6', color: SECUNDARIO }}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            A taxa de save só significa alguma coisa ao lado das outras duas.
            Se ela sobe junto com “cancelou fora do app”, o fluxo virou obstáculo —
            a pessoa desistiu de cancelar aqui e foi cancelar pelos Ajustes.
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Placar
            icone={<Snowflake className="h-4 w-4" />}
            rotulo="Taxa de save"
            valor={taxaSave}
            detalhe={`${congelou} congelaram de ${intencao} que abriram o cancelamento`}
          />
          <Placar
            icone={<TrendingDown className="h-4 w-4" />}
            rotulo="Cancelou fora do app"
            valor={pctForaDoApp}
            detalhe={`${foraDoApp} cancelaram sem passar pela nossa tela`}
            alertaSeAcimaDe={30}
          />
          <Placar
            icone={<CreditCard className="h-4 w-4" />}
            rotulo="Retomada D+90"
            valor={retomada}
            detalhe={`${n('reactivated')} voltaram de ${n('expired')} que expiraram`}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Placar
            icone={<CreditCard className="h-4 w-4" />}
            rotulo="Recuperação de cobrança"
            valor={recuperacaoCobranca}
            detalhe={`${n('billing_failed')} falhas, ${n('grace_expired')} viraram perda`}
          />
        </div>
      </section>

      {/* ─── 3. O FUNIL, PASSO A PASSO ─── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: SECUNDARIO }}>
          Do “quero cancelar” até o fim
        </h2>
        <div className="mt-4 space-y-3">
          {[
            ['Abriu o cancelamento', intencao],
            ['Viu a tela de retenção', n('retention_shown')],
            ['Congelou em vez de cancelar', congelou],
            ['Seguiu para cancelar', n('retention_declined')],
            ['Cancelamento confirmado', concluiuCancelamento],
          ].map(([rotulo, valor]) => (
            <BarraNomeada
              key={rotulo as string}
              rotulo={rotulo as string}
              valor={valor as number}
              total={Math.max(intencao, concluiuCancelamento, 1)}
              cor={COR_VOLUNTARIO}
            />
          ))}
        </div>
      </section>

      {/* ─── 4. A TABELA — identidade sem depender de cor ─── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: SECUNDARIO }}>
          Eventos no período
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: SECUNDARIO }}>
                <th className="border-b py-2 text-left font-medium" style={{ borderColor: GRADE }}>Evento</th>
                <th className="border-b py-2 text-right font-medium" style={{ borderColor: GRADE }}>Total</th>
              </tr>
            </thead>
            <tbody style={{ color: TEXTO }}>
              {Object.entries(funil ?? {}).length === 0 ? (
                <tr><td colSpan={2} className="py-4" style={{ color: SECUNDARIO }}>
                  Nenhum evento no período.
                </td></tr>
              ) : (
                Object.entries(funil ?? {})
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .map(([chave, valor]) => (
                    <tr key={chave}>
                      <td className="border-b py-2" style={{ borderColor: GRADE }}>
                        {rotuloDoEvento(chave)}
                      </td>
                      <td className="border-b py-2 text-right tabular-nums" style={{ borderColor: GRADE }}>
                        {Number(valor)}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ── peças ──

function Chave({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-sm" style={{ background: cor }} />
      {texto}
    </span>
  )
}

/** Barra horizontal com rótulo direto — sem legenda-only, sem número flutuante. */
function BarraNomeada({ rotulo, descricao, valor, total, cor }: {
  rotulo: string; descricao?: string; valor: number; total: number; cor: string
}) {
  const pct = total > 0 ? (valor / total) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium" style={{ color: TEXTO }}>{rotulo}</span>
        <span className="text-sm tabular-nums" style={{ color: TEXTO }}>
          {valor}
          {total > 0 && <span style={{ color: SECUNDARIO }}> · {pct.toFixed(0)}%</span>}
        </span>
      </div>
      {descricao && (
        <p className="mt-0.5 text-xs" style={{ color: SECUNDARIO }}>{descricao}</p>
      )}
      {/* Trilho recessivo, marca fina, ponta arredondada de 4px na extremidade
          do dado — a base encosta no zero. */}
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-sm" style={{ background: GRADE }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.max(pct, valor > 0 ? 1.5 : 0)}%`,
            background: cor,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
          }}
          title={`${rotulo}: ${valor}`}
        />
      </div>
    </div>
  )
}

/** Número grande com o que ele significa embaixo. Nunca a porcentagem sozinha. */
function Placar({ icone, rotulo, valor, detalhe, alertaSeAcimaDe }: {
  icone: React.ReactNode; rotulo: string; valor: number | null
  detalhe: string; alertaSeAcimaDe?: number
}) {
  const alerta = alertaSeAcimaDe != null && valor != null && valor > alertaSeAcimaDe
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: GRADE }}>
      <div className="flex items-center gap-2 text-sm" style={{ color: SECUNDARIO }}>
        {icone}{rotulo}
      </div>
      <div className="mt-2 text-3xl font-black tabular-nums" style={{ color: TEXTO }}>
        {/* Sem denominador, "0%" seria mentira: mostra o travessão. */}
        {valor == null ? '—' : `${valor.toFixed(0)}%`}
      </div>
      <p className="mt-1 text-xs" style={{ color: alerta ? COR_VOLUNTARIO : SECUNDARIO }}>
        {detalhe}
      </p>
    </div>
  )
}

function rotuloDoEvento(chave: string): string {
  const mapa: Record<string, string> = {
    cancel_intent: 'Abriu o cancelamento',
    retention_shown: 'Viu a tela de retenção',
    frozen: 'Congelou o desafio',
    retention_declined: 'Seguiu para cancelar',
    auto_renew_off: 'Desligou a renovação',
    auto_renew_on: 'Religou a renovação',
    expired: 'Acesso expirou',
    expired_involuntary: 'Expirou por falha de cobrança',
    refunded: 'Reembolsado',
    billing_failed: 'Cobrança falhou',
    grace_started: 'Entrou em período de graça',
    grace_expired: 'Período de graça acabou',
    winback_shown: 'Viu oferta de retomada',
    winback_redeemed: 'Aceitou oferta de retomada',
    reactivated: 'Reativou a assinatura',
  }
  return mapa[chave] ?? chave
}
