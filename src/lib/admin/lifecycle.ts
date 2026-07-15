/**
 * Content lifecycle model shared by Challenges / Workouts / Diets.
 *
 * `status` is the admin source of truth (draft|published|paused|archived).
 * Because the iOS app only shows challenges with visibility='public', the
 * action layer keeps visibility in sync so publish/pause take effect in the
 * app immediately (see useContentActions).
 */

export type ContentStatus = 'draft' | 'published' | 'paused' | 'archived';

export interface StatusMeta {
  value: ContentStatus;
  label: string;
  /** Tailwind classes for a badge. */
  badge: string;
  dot: string;
}

export const STATUS_META: Record<ContentStatus, StatusMeta> = {
  published: {
    value: 'published',
    label: 'Publicado',
    badge: 'bg-success/10 text-success border-success/20',
    dot: 'bg-success',
  },
  draft: {
    value: 'draft',
    label: 'Rascunho',
    badge: 'bg-secondary text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
  paused: {
    value: 'paused',
    label: 'Pausado',
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  archived: {
    value: 'archived',
    label: 'Arquivado',
    badge: 'bg-muted text-muted-foreground border-border opacity-80',
    dot: 'bg-muted-foreground',
  },
};

export function statusOf(
  row: { status?: string | null; visibility?: string | null },
  fallback: ContentStatus = 'draft'
): ContentStatus {
  const s = row.status as ContentStatus | undefined;

  // For challenges, `visibility` is what the iOS app actually honours, so it is
  // authoritative for the published bit. `paused`/`archived` are explicit admin
  // overrides (which also force visibility=private), so they win.
  if (row.visibility === 'public' || row.visibility === 'private') {
    if (s === 'paused' || s === 'archived') return s;
    if (row.visibility === 'public') return 'published';
    return 'draft';
  }

  // Tables without a visibility column (workouts/diets): trust `status`.
  if (s && STATUS_META[s]) return s;
  return fallback;
}

export type TimeState = 'scheduled' | 'active' | 'ended' | 'evergreen';

export interface TimeStateMeta {
  state: TimeState;
  label: string;
  className: string;
}

/** Derive an activity window state from start/end dates (published only). */
export function timeStateOf(row: {
  start_date?: string | null;
  end_date?: string | null;
}): TimeStateMeta {
  const now = Date.now();
  const start = row.start_date ? new Date(row.start_date).getTime() : null;
  const end = row.end_date ? new Date(row.end_date).getTime() : null;

  if (start && start > now) {
    return { state: 'scheduled', label: 'Agendado', className: 'text-blue-500' };
  }
  if (end && end < now) {
    return { state: 'ended', label: 'Encerrado', className: 'text-muted-foreground' };
  }
  if (start || end) {
    return { state: 'active', label: 'Em andamento', className: 'text-success' };
  }
  return { state: 'evergreen', label: 'Contínuo', className: 'text-muted-foreground' };
}

export const STATUS_TABS: { value: ContentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'published', label: 'Publicados' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'paused', label: 'Pausados' },
  { value: 'archived', label: 'Arquivados' },
];
