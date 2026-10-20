import React, { useState } from 'react';
import { ScrollText, Search, Loader2, Info, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useServerTable } from '@/hooks/admin/useServerTable';
import { TablePagination } from '@/components/admin/TableControls';
import { downloadCsv } from '@/lib/admin/export';

const ACTION_LABEL: Record<string, string> = {
  'challenges.status': 'Status de desafio',
  'challenges.feature': 'Destaque de desafio',
  'challenges.delete': 'Exclusão de desafio',
  'workouts.status': 'Status de treino',
  'workouts.delete': 'Exclusão de treino',
  'diets.status': 'Status de dieta',
  'diets.delete': 'Exclusão de dieta',
  'health.view': 'Visualização de saúde',
  'health.sensitive.decrypt': 'Acesso a dado sensível',
  'health.consent.grant': 'Consentimento concedido',
  'health.consent.revoke': 'Consentimento revogado',
};

function actionBadgeClass(action: string) {
  if (action.includes('delete')) return 'bg-destructive/10 text-destructive border-destructive/20';
  if (action.includes('sensitive')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  if (action.includes('health')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  return 'bg-secondary text-secondary-foreground border-border';
}

export default function AuditLog() {
  const [actionFilter, setActionFilter] = useState('all');

  const table = useServerTable<any>({
    table: 'admin_audit_log',
    columns: 'id, action, entity, entity_id, metadata, created_at, profiles:actor_id(name, avatar_url)',
    searchColumn: 'action',
    defaultSort: { column: 'created_at', ascending: false },
    filters: { action: actionFilter },
    pageSize: 30,
  });

  const exportCsv = () => {
    downloadCsv('auditoria', table.rows, [
      { header: 'Data', accessor: (r) => new Date(r.created_at).toLocaleString('pt-BR') },
      { header: 'Autor', accessor: (r) => r.profiles?.name ?? '' },
      { header: 'Ação', accessor: (r) => r.action },
      { header: 'Entidade', accessor: (r) => r.entity ?? '' },
      { header: 'ID', accessor: (r) => r.entity_id ?? '' },
      { header: 'Detalhes', accessor: (r) => JSON.stringify(r.metadata ?? {}) },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Auditoria</h1>
            <p className="text-sm text-muted-foreground">
              Trilha de ações administrativas — quem fez o quê, e quando.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={table.rows.length === 0} className="gap-1.5 h-9 text-xs">
          <Download className="w-3.5 h-3.5" />
          Exportar página
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ação (ex.: health.view, challenges.status)…"
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            table.setPage(0);
          }}
          className="h-10 px-3.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todas as ações</option>
          {Object.entries(ACTION_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        {table.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Carregando auditoria…</span>
          </div>
        ) : table.rows.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {new Date(r.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-border">
                          {r.profiles?.avatar_url ? <AvatarImage src={r.profiles.avatar_url} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                            {(r.profiles?.name ?? '??').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-foreground">{r.profiles?.name ?? 'Sistema'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${actionBadgeClass(r.action)}`}>
                        {ACTION_LABEL[r.action] ?? r.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.entity ?? '—'}
                      {r.entity_id && (
                        <span className="block text-[10px] font-mono opacity-70 truncate max-w-[140px]">{r.entity_id}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono max-w-[260px] truncate">
                      {r.metadata && Object.keys(r.metadata).length > 0 ? JSON.stringify(r.metadata) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              total={table.total}
              pageSize={table.pageSize}
              onPage={table.setPage}
              isFetching={table.isFetching}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Nenhum registro de auditoria</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              As ações administrativas (publicações, exclusões, visualizações de saúde,
              mudanças de permissão) aparecem aqui. Requer a migração
              <code className="mx-1 text-[11px] bg-secondary px-1 py-0.5 rounded">20260714100000_admin_foundation</code>
              aplicada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
