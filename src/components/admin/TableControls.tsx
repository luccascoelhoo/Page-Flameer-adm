import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  isFetching,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  isFetching?: boolean;
}) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <span className="text-xs text-muted-foreground tabular-nums">
        {from}–{to} de {total}
        {isFetching && <span className="ml-2 opacity-60">atualizando…</span>}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums px-1">
          {page + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
        >
          Próxima
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SortableHead({
  label,
  column,
  activeColumn,
  ascending,
  onSort,
  className,
}: {
  label: string;
  column: string;
  activeColumn: string;
  ascending: boolean;
  onSort: (c: string) => void;
  className?: string;
}) {
  const active = activeColumn === column;
  const Icon = !active ? ChevronsUpDown : ascending ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground transition-colors',
          active ? 'text-foreground font-semibold' : 'text-muted-foreground'
        )}
      >
        {label}
        <Icon className="w-3 h-3" />
      </button>
    </TableHead>
  );
}
