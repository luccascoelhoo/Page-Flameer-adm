import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Flame, Award, Eye, Info, Download, ShieldCheck, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useServerTable } from '@/hooks/admin/useServerTable';
import { TablePagination, SortableHead } from '@/components/admin/TableControls';
import { downloadCsv } from '@/lib/admin/export';

const ROLES = [
  { value: 'user', label: 'Usuário' },
  { value: 'professional', label: 'Profissional' },
  { value: 'admin', label: 'Administrador' },
];

function roleBadgeClass(role: string) {
  switch (role) {
    case 'admin':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'professional':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    default:
      return 'bg-secondary text-secondary-foreground border-border';
  }
}

export default function UsersList() {
  const { toast } = useToast();
  const { profile } = useAdminAuth(false);
  const canChangeRoles = profile?.role === 'admin';
  const [roleFilter, setRoleFilter] = useState('all');
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [applying, setApplying] = useState(false);

  const table = useServerTable<any>({
    table: 'profiles',
    columns: 'id, name, avatar_url, email, role, cohort_group, streak, xp, level, created_at',
    searchColumn: 'name',
    defaultSort: { column: 'created_at', ascending: false },
    filters: { role: roleFilter },
    pageSize: 25,
  });

  const selectedIds = useMemo(() => Object.keys(selected), [selected]);
  const allOnPageSelected = table.rows.length > 0 && table.rows.every((r) => selected[r.id]);

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = { ...prev };
      if (allOnPageSelected) {
        table.rows.forEach((r) => delete next[r.id]);
      } else {
        table.rows.forEach((r) => (next[r.id] = r));
      }
      return next;
    });
  };

  const toggleOne = (row: any) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[row.id]) delete next[row.id];
      else next[row.id] = row;
      return next;
    });
  };

  const clearSelection = () => setSelected({});

  const bulkSetRole = async (role: string) => {
    if (selectedIds.length === 0) return;
    setApplying(true);
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ role })
      .in('id', selectedIds);
    setApplying(false);
    if (error) {
      toast({ title: 'Erro ao atualizar permissões', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Permissões atualizadas',
      description: `${selectedIds.length} usuário(s) agora são "${role}".`,
    });
    // trilha de auditoria (best-effort; requer migração admin_foundation)
    try {
      await (supabase as any).rpc('admin_log_action', {
        p_action: 'users.role.bulk',
        p_entity: 'profiles',
        p_entity_id: selectedIds.join(','),
        p_metadata: { role, count: selectedIds.length },
      });
    } catch {
      /* auditoria ainda não migrada */
    }
    clearSelection();
    table.refetch();
  };

  const exportRows = (rows: any[], filename: string) => {
    downloadCsv(filename, rows, [
      { header: 'Nome', accessor: (r) => r.name },
      { header: 'Email', accessor: (r) => r.email ?? '' },
      { header: 'Permissão', accessor: (r) => r.role },
      { header: 'Coorte', accessor: (r) => r.cohort_group ?? '' },
      { header: 'Ofensiva', accessor: (r) => r.streak },
      { header: 'XP', accessor: (r) => r.xp },
      { header: 'Nível', accessor: (r) => r.level },
      { header: 'Cadastro', accessor: (r) => new Date(r.created_at).toLocaleDateString('pt-BR') },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {table.total} usuários · paginação e busca no servidor, ações em massa e exportação.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 text-xs"
          onClick={() => exportRows(table.rows, 'usuarios-pagina')}
          disabled={table.rows.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Exportar página
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            table.setPage(0);
          }}
          className="h-10 px-3.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todas as permissões</option>
          <option value="user">Usuário comum</option>
          <option value="professional">Profissional</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-4 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <span className="text-xs font-semibold text-foreground flex items-center gap-2">
            <Checkbox checked className="pointer-events-none" />
            {selectedIds.length} selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            {canChangeRoles && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={applying}>
                    {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Alterar permissão
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Definir como</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ROLES.map((r) => (
                    <DropdownMenuItem key={r.value} onClick={() => bulkSetRole(r.value)} className="text-xs">
                      {r.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => exportRows(Object.values(selected), 'usuarios-selecionados')}
            >
              <Download className="w-3.5 h-3.5" />
              Exportar
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelection}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {table.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Carregando usuários…</span>
          </div>
        ) : table.rows.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} aria-label="Selecionar tudo" />
                  </TableHead>
                  <SortableHead label="Perfil" column="name" activeColumn={table.sort.column} ascending={table.sort.ascending} onSort={table.toggleSort} />
                  <TableHead>Permissão</TableHead>
                  <TableHead>Coorte</TableHead>
                  <SortableHead label="Fogo" column="streak" activeColumn={table.sort.column} ascending={table.sort.ascending} onSort={table.toggleSort} className="text-center" />
                  <SortableHead label="XP" column="xp" activeColumn={table.sort.column} ascending={table.sort.ascending} onSort={table.toggleSort} className="text-center" />
                  <SortableHead label="Nível" column="level" activeColumn={table.sort.column} ascending={table.sort.ascending} onSort={table.toggleSort} className="text-center" />
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((u) => (
                  <TableRow key={u.id} data-state={selected[u.id] ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox checked={!!selected[u.id]} onCheckedChange={() => toggleOne(u)} aria-label={`Selecionar ${u.name}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={u.name} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                            {u.name?.substring(0, 2).toUpperCase() || 'AD'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground">{u.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(u.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${roleBadgeClass(u.role)}`}>
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-secondary text-secondary-foreground border-border">
                        {u.cohort_group || 'Não Definido'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 font-bold text-amber-500 text-sm">
                        <Flame className="w-4 h-4" />
                        <span className="tabular-nums">{u.streak}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-foreground tabular-nums">{u.xp}</TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-foreground">
                        <Award className="w-3.5 h-3.5 text-primary" />
                        <span className="tabular-nums">{u.level}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5">
                        <Link to={`/users/${u.id}`} title="Ver perfil detalhado">
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
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
            <h3 className="font-semibold text-lg text-foreground">Nenhum usuário encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Nenhuma correspondência com os filtros informados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
