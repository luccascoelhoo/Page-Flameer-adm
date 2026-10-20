// regrasDeAcesso.ts — o contrato de `challenge_access_rules` (27/08/2026).
//
// Tipo, padrão e normalização moram fora do componente de propósito: a tela
// (RegrasDeAcessoDoProduto.tsx) só desenha, e quem carrega/grava é o
// ChallengeForm. Separado, o arquivo do componente exporta só componente —
// que é o que o fast refresh do Vite pede.

export type ModoDeDesbloqueio = 'mudo' | 'iap' | 'externo';

/**
 * O recorte de `challenge_access_rules` que o formulário de desafio governa.
 * Espelha as colunas uma a uma — nada de campo derivado, para o payload da
 * RPC poder ser o próprio objeto.
 *
 * ⚠️ `grants_free_challenges` NÃO está aqui de propósito. O contrato da RPC de
 * gravação é "chave ausente = campo intocado", e essa bandeira nasce `true` no
 * banco: quem compra um produto continua tendo os desafios livres da
 * comunidade. Não é decisão de tela — é o piso do produto.
 */
export interface RegrasDeAcesso {
  is_paid: boolean;
  /** NULL = o acesso dura o período do desafio (start_date → end_date). */
  access_days: number | null;
  grants_own_plan: boolean;
  grants_ai_workout: boolean;
  grants_create_challenges: boolean;
  grants_catalog: boolean;
  unlock_mode: ModoDeDesbloqueio;
  /** Só exibição no painel/relatórios enquanto `unlock_mode = 'mudo'`. */
  price_cents: number | null;
  external_product_ref: string | null;
}

/** O estado de um desafio novo = os defaults da tabela. Nada liberado. */
export const REGRAS_DE_ACESSO_PADRAO: RegrasDeAcesso = {
  is_paid: false,
  access_days: null,
  grants_own_plan: false,
  grants_ai_workout: false,
  grants_create_challenges: false,
  grants_catalog: false,
  unlock_mode: 'mudo',
  price_cents: null,
  external_product_ref: null,
};

function comoBooleano(v: unknown): boolean {
  return v === true;
}

/** Vazio, nulo ou não-numérico vira null — a coluna aceita e significa "sem valor". */
function comoInteiroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Normaliza o que a RPC de leitura devolver.
 *
 * ⚠️ `returns table` vira ARRAY no PostgREST — decodificar como objeto único
 * falha sempre. Aceita os dois formatos e cai no padrão quando não há linha
 * (desafio ainda sem regra: `tenho_acesso` já trata isso como falha fechada,
 * então a tela não pode sugerir liberação que o banco não tem).
 */
export function normalizarRegrasDeAcesso(bruto: unknown): RegrasDeAcesso {
  const cru = Array.isArray(bruto) ? bruto[0] : bruto;
  if (!cru || typeof cru !== 'object') return { ...REGRAS_DE_ACESSO_PADRAO };
  const linha = cru as Record<string, unknown>;

  const modo = linha.unlock_mode;
  const ref = linha.external_product_ref;

  return {
    is_paid: comoBooleano(linha.is_paid),
    access_days: comoInteiroOuNulo(linha.access_days),
    grants_own_plan: comoBooleano(linha.grants_own_plan),
    grants_ai_workout: comoBooleano(linha.grants_ai_workout),
    grants_create_challenges: comoBooleano(linha.grants_create_challenges),
    grants_catalog: comoBooleano(linha.grants_catalog),
    unlock_mode: modo === 'iap' || modo === 'externo' ? modo : 'mudo',
    price_cents: comoInteiroOuNulo(linha.price_cents),
    external_product_ref: typeof ref === 'string' && ref.trim() !== '' ? ref : null,
  };
}

/** "49,90" → 4990. Campo vazio → null. */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d.,]/g, '').replace(',', '.');
  if (!limpo.trim()) return null;
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** 4990 → "49,90". */
export function paraTextoDeReais(centavos: number | null): string {
  if (centavos === null || !Number.isFinite(centavos)) return '';
  return (centavos / 100).toFixed(2).replace('.', ',');
}
