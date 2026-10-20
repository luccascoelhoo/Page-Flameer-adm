// RelatorioDeGrupo.tsx — extrair um GRUPO de alunos (J3c · 17/08/2026).
//
// Pedido do dono: "caso eu queira transferir os dados de um grupo de usuários
// que pesam acima de 100kg, ou pessoas com intolerância a lactose, problemas
// na lombar, e assim sucessivamente".
//
// Uma porta só no banco (admin_relatorio_de_grupo, com gate e auditoria) e
// aqui a composição dos filtros + as três saídas: ver na tela, exportar CSV
// e imprimir (o navegador vira PDF).

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { Download, Loader2, Printer, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/admin/PageHeader';
import StatCard from '@/components/admin/StatCard';
import { downloadCsv } from '@/lib/admin/export';
import { cn } from '@/lib/utils';

type Filtros = Record<string, string | number | boolean>;

const ROTULO: Record<string, string> = {
  lose: 'Emagrecer', gain: 'Ganhar massa', maintain: 'Manter',
  beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado',
  full_gym: 'Academia completa', basic_gym: 'Academia de prédio', home: 'Casa',
  male: 'Masculino', female: 'Feminino',
  ativo: 'Ativo', oscilando: 'Oscilando', sumido: 'Sumido', nunca_ativou: 'Nunca ativou',
};
const r = (v: any) => (v == null || v === '' ? '—' : (ROTULO[String(v)] ?? String(v)));

/** Atalhos que respondem perguntas reais da gerência num clique. */
const PRESETS: { nome: string; filtros: Filtros }[] = [
  { nome: 'Acima de 100 kg', filtros: { peso_min: 100 } },
  { nome: 'IMC 30+', filtros: { imc_min: 30 } },
  { nome: 'Intolerantes a lactose', filtros: { alergia: 'lactose' } },
  { nome: 'Problema na lombar', filtros: { lesao: 'lombar' } },
  { nome: 'Sumidos', filtros: { adesao: 'sumido' } },
  { nome: 'Ativos de verdade', filtros: { adesao: 'ativo' } },
  { nome: 'Querem emagrecer', filtros: { objetivo: 'lose' } },
  { nome: 'Iniciantes', filtros: { nivel: 'beginner' } },
];

export default function RelatorioDeGrupo() {
  const [rascunho, setRascunho] = useState<Filtros>({});
  const [aplicados, setAplicados] = useState<Filtros>({});

  const { data, isLoading, isFetching } = useSupabaseQuery<any>(
    ['admin', 'relatorio-grupo', JSON.stringify(aplicados)],
    async () => {
      const { data, error } = await (supabase as any)
        .rpc('admin_relatorio_de_grupo', { p_filtros: aplicados, p_limite: 500 });
      return { data, error };
    });

  const alunos: any[] = data?.alunos ?? [];
  const ag = data?.agregados ?? {};

  const setCampo = (chave: string, valor: string) => {
    setRascunho((f) => {
      const novo = { ...f };
      if (valor === '' || valor == null) delete novo[chave];
      else novo[chave] = /^(peso|imc)_/.test(chave) ? Number(valor) : valor;
      return novo;
    });
  };

  const aplicarPreset = (p: Filtros) => { setRascunho(p); setAplicados(p); };

  const exportar = () => {
    downloadCsv(`grupo-${new Date().toISOString().slice(0, 10)}`, alunos, [
      { header: 'Nome', accessor: (a) => a.nome ?? '' },
      { header: 'E-mail', accessor: (a) => a.email ?? '' },
      { header: 'Idade', accessor: (a) => a.idade ?? '' },
      { header: 'Sexo', accessor: (a) => r(a.sexo) },
      { header: 'Peso (kg)', accessor: (a) => a.peso ?? '' },
      { header: 'Altura (cm)', accessor: (a) => a.altura ?? '' },
      { header: 'IMC', accessor: (a) => a.imc ?? '' },
      { header: 'Meta de peso', accessor: (a) => a.peso_desejado ?? '' },
      { header: 'Objetivo', accessor: (a) => r(a.objetivo) },
      { header: 'Nível', accessor: (a) => r(a.nivel) },
      { header: 'Onde treina', accessor: (a) => r(a.local) },
      { header: 'Lesões', accessor: (a) => (a.lesoes ?? []).join('; ') },
      { header: 'Alergias', accessor: (a) => (a.alergias ?? []).join('; ') },
      { header: 'Adesão', accessor: (a) => r(a.adesao) },
      { header: 'Dias ativos (30d)', accessor: (a) => a.dias_ativos_30 ?? 0 },
      { header: 'Última atividade', accessor: (a) => a.ultima_atividade ?? '' },
      { header: 'Pontos', accessor: (a) => a.pontos ?? 0 },
      { header: 'Premium', accessor: (a) => (a.premium ? 'Sim' : 'Não') },
    ]);
  };

  const chips = Object.entries(aplicados);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Relatório por grupo"
        subtitulo="Componha um recorte da base — peso, IMC, objetivo, saúde declarada ou adesão — e leve os dados para fora."
        acoes={
          <>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                    onClick={exportar} disabled={alunos.length === 0}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                    onClick={() => window.print()} disabled={alunos.length === 0}>
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
          </>
        }
      />

      {/* Atalhos */}
      <div className="flex flex-wrap gap-1.5 print:hidden">
        {PRESETS.map((p) => (
          <button key={p.nome} onClick={() => aplicarPreset(p.filtros)}
            className="text-xs px-2.5 py-1 rounded border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
            {p.nome}
          </button>
        ))}
      </div>

      {/* Filtros compostos */}
      <div className="bg-card border border-border rounded-md p-4 print:hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Campo rotulo="Peso mín (kg)" tipo="number" chave="peso_min" v={rascunho} set={setCampo} />
          <Campo rotulo="Peso máx (kg)" tipo="number" chave="peso_max" v={rascunho} set={setCampo} />
          <Campo rotulo="IMC mín" tipo="number" chave="imc_min" v={rascunho} set={setCampo} />
          <Campo rotulo="IMC máx" tipo="number" chave="imc_max" v={rascunho} set={setCampo} />
          <Seleto rotulo="Objetivo" chave="objetivo" v={rascunho} set={setCampo}
                  opcoes={[['lose', 'Emagrecer'], ['gain', 'Ganhar massa'], ['maintain', 'Manter']]} />
          <Seleto rotulo="Nível" chave="nivel" v={rascunho} set={setCampo}
                  opcoes={[['beginner', 'Iniciante'], ['intermediate', 'Intermediário'], ['advanced', 'Avançado']]} />
          <Seleto rotulo="Onde treina" chave="local" v={rascunho} set={setCampo}
                  opcoes={[['full_gym', 'Academia completa'], ['basic_gym', 'Academia de prédio'], ['home', 'Casa']]} />
          <Seleto rotulo="Sexo" chave="sexo" v={rascunho} set={setCampo}
                  opcoes={[['male', 'Masculino'], ['female', 'Feminino']]} />
          <Seleto rotulo="Adesão" chave="adesao" v={rascunho} set={setCampo}
                  opcoes={[['ativo', 'Ativo'], ['oscilando', 'Oscilando'], ['sumido', 'Sumido'], ['nunca_ativou', 'Nunca ativou']]} />
          <Seleto rotulo="Assinatura" chave="premium" v={rascunho} set={setCampo}
                  opcoes={[['true', 'Premium'], ['false', 'Grátis']]} />
          <Campo rotulo="Alergia contém" chave="alergia" v={rascunho} set={setCampo} placeholder="lactose" />
          <Campo rotulo="Lesão contém" chave="lesao" v={rascunho} set={setCampo} placeholder="lombar" />
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAplicados(rascunho)}>
            <Search className="w-3.5 h-3.5" /> Buscar grupo
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                  onClick={() => { setRascunho({}); setAplicados({}); }}>
            Limpar
          </Button>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-2">
              {chips.map(([k, val]) => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
                  {k}: {String(val)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agregados do grupo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard rotulo="Alunos no grupo" valor={data?.total ?? 0} icone={Users} tom="acento" />
        <StatCard rotulo="Peso médio" valor={ag.peso_medio != null ? `${ag.peso_medio} kg` : '—'} />
        <StatCard rotulo="IMC médio" valor={ag.imc_medio ?? '—'} />
        <StatCard rotulo="Idade média" valor={ag.idade_media != null ? `${ag.idade_media} anos` : '—'} />
        <StatCard rotulo="Premium no grupo" valor={ag.premium ?? 0} />
      </div>

      {data?.truncado && (
        <p className="text-xs text-primary font-semibold">
          ⚠️ A lista foi cortada no teto de {data?.teto} alunos — refine os filtros para ver o grupo inteiro.
        </p>
      )}

      {/* O grupo */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        {isLoading || isFetching ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Compondo o grupo…</span>
          </div>
        ) : alunos.length === 0 ? (
          <div className="py-16 text-center">
            <X className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum aluno casa com esses filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2.5">Aluno</th>
                  <th className="px-4 py-2.5 text-right">Idade</th>
                  <th className="px-4 py-2.5 text-right">Peso</th>
                  <th className="px-4 py-2.5 text-right">IMC</th>
                  <th className="px-4 py-2.5">Objetivo</th>
                  <th className="px-4 py-2.5">Saúde declarada</th>
                  <th className="px-4 py-2.5">Adesão</th>
                  <th className="px-4 py-2.5 text-right">Ativo (30d)</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link to={`/users/${a.id}`} className="font-medium text-foreground hover:text-primary">
                        {a.nome ?? 'Sem nome'}
                      </Link>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">{a.email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a.idade ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a.peso ? `${a.peso} kg` : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a.imc ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs">{r(a.objetivo)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[240px] truncate">
                      {[...(a.lesoes ?? []), ...(a.alergias ?? [])].join(', ') || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
                        a.adesao === 'ativo' ? 'bg-success/15 text-success'
                          : a.adesao === 'sumido' ? 'bg-destructive/15 text-destructive'
                          : a.adesao === 'oscilando' ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground')}>
                        {r(a.adesao)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a.dias_ativos_30 ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground print:block hidden">
        Relatório gerado pelo painel Flameer em {new Date().toLocaleString('pt-BR')} · dados sensíveis: uso interno.
      </p>
    </div>
  );
}

function Campo({ rotulo, chave, v, set, tipo = 'text', placeholder }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{rotulo}</label>
      <Input type={tipo} placeholder={placeholder} className="h-8 text-xs"
             value={(v[chave] as any) ?? ''} onChange={(e) => set(chave, e.target.value)} />
    </div>
  );
}

function Seleto({ rotulo, chave, v, set, opcoes }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{rotulo}</label>
      <select value={(v[chave] as any) ?? ''} onChange={(e) => set(chave, e.target.value)}
        className="w-full h-8 px-2 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring">
        <option value="">Todos</option>
        {opcoes.map(([val, lab]: [string, string]) => <option key={val} value={val}>{lab}</option>)}
      </select>
    </div>
  );
}
