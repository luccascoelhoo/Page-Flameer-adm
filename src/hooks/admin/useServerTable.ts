import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServerTableConfig {
  table: string;
  columns?: string; // select() string
  /** Column searched with ilike when the user types. */
  searchColumn?: string;
  defaultSort?: { column: string; ascending: boolean };
  pageSize?: number;
  /** Extra equality filters, e.g. { role: 'admin' }. Null/'all' values are ignored. */
  filters?: Record<string, string | null | undefined>;
}

/**
 * Server-side paginated / sorted / searched table backed by a Supabase table.
 * Uses range() + exact count so the panel scales past a few thousand rows,
 * unlike the fetch-everything-then-filter pattern the old lists used.
 */
export function useServerTable<T = any>(config: ServerTableConfig) {
  const pageSize = config.pageSize ?? 25;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(config.defaultSort ?? { column: 'created_at', ascending: false });

  const filters = config.filters ?? {};
  const filterKey = JSON.stringify(filters);

  const query = useQuery({
    queryKey: ['admin', 'table', config.table, page, pageSize, search, sort, filterKey],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = (supabase as any)
        .from(config.table)
        .select(config.columns ?? '*', { count: 'exact' });

      Object.entries(filters).forEach(([col, val]) => {
        if (val != null && val !== 'all' && val !== '') q = q.eq(col, val);
      });

      if (search && config.searchColumn) {
        q = q.ilike(config.searchColumn, `%${search}%`);
      }

      q = q.order(sort.column, { ascending: sort.ascending });
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as T[], total: count ?? 0 };
    },
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const toggleSort = (column: string) => {
    setSort((s) =>
      s.column === column ? { column, ascending: !s.ascending } : { column, ascending: true }
    );
    setPage(0);
  };

  const doSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  return {
    rows: query.data?.rows ?? [],
    total,
    page,
    pageSize,
    pageCount,
    setPage,
    search,
    setSearch: doSearch,
    sort,
    toggleSort,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
