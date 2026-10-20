import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ContentStatus } from '@/lib/admin/lifecycle';

const sb = supabase as any;

/** Best-effort audit trail — never blocks the action if the RPC isn't installed. */
async function audit(action: string, entity: string, entityId: string, metadata: any = {}) {
  try {
    await sb.rpc('admin_log_action', {
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId,
      p_metadata: metadata,
    });
  } catch {
    /* audit table not migrated yet — ignore */
  }
}

type ContentTable = 'challenges' | 'workouts' | 'diets';

export function useContentActions(table: ContentTable) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin', 'table', table] });
    qc.invalidateQueries({ queryKey: ['admin', 'intel'] });
  }, [qc, table]);

  /**
   * Set lifecycle status. For challenges we mirror it onto `visibility` so the
   * iOS app (which filters on visibility='public') reflects it immediately.
   */
  const setStatus = useCallback(
    async (id: string, status: ContentStatus) => {
      setBusyId(id);
      const patch: Record<string, any> = { status };
      if (table === 'challenges') {
        patch.visibility = status === 'published' ? 'public' : 'private';
      }
      const { error } = await sb.from(table).update(patch).eq('id', id);
      setBusyId(null);
      if (error) {
        toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
        return false;
      }
      await audit(`${table}.status`, table, id, patch);
      invalidate();
      return true;
    },
    [table, toast, invalidate]
  );

  const toggleFeatured = useCallback(
    async (id: string, value: boolean) => {
      setBusyId(id);
      const { error } = await sb.from('challenges').update({ is_featured: value }).eq('id', id);
      setBusyId(null);
      if (error) {
        toast({ title: 'Erro ao destacar', description: error.message, variant: 'destructive' });
        return false;
      }
      await audit('challenges.feature', 'challenges', id, { is_featured: value });
      invalidate();
      return true;
    },
    [toast, invalidate]
  );

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      const { error } = await sb.from(table).delete().eq('id', id);
      setBusyId(null);
      if (error) {
        // Violação de FK não pode chegar crua ao admin. Desde que
        // workouts/diets/habits ganharam FK para `challenges` com ON DELETE
        // RESTRICT, o erro mais provável aqui é justamente esse — e o texto do
        // Postgres ("update or delete on table ... violates foreign key
        // constraint ... on table ...") não diz o que fazer.
        const eFK = error.code === '23503'
          || /foreign key constraint/i.test(error.message ?? '');
        toast({
          title: eFK ? 'Ainda há conteúdo vinculado' : 'Erro ao excluir',
          description: eFK
            ? 'Remova os treinos, dietas e hábitos deste desafio antes de excluí-lo. ' +
              'O banco recusa a exclusão em cascata de propósito: conteúdo pago sem ' +
              'desafio vira conteúdo público.'
            : error.message,
          variant: 'destructive',
        });
        return false;
      }
      await audit(`${table}.delete`, table, id);
      invalidate();
      return true;
    },
    [table, toast, invalidate]
  );

  return { setStatus, toggleFeatured, remove, busyId };
}

/**
 * Deep-clone a challenge (details + habits + workouts + diets) into a new
 * DRAFT via the save_challenge_package RPC. The RPC treats a payload with no
 * `id` as an insert, so we simply rebuild the package shape and omit the id.
 */
export async function duplicateChallenge(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await sb
    .from('challenges')
    .select(
      `*,
      habits(*),
      workouts(id, title, duration_minutes, focus, metadata,
        workout_days(day_of_week),
        exercises(id, name, muscle, rest_seconds, order_index, metadata,
          exercise_sets(id, reps, weight, order_index))),
      diets(id, title, metadata,
        meals(id, name, time, calories, protein, carbs, fat, order_index, metadata,
          meal_items(id, name, quantity, order_index)))`
    )
    .eq('id', id)
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'não encontrado' };

  const sortByOrder = (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0);

  const payload = {
    // no id → RPC inserts a new challenge
    title: `${data.title} (cópia)`,
    subtitle: data.subtitle ?? null,
    tier: data.tier,
    visibility: 'private',
    status: 'draft',
    challenge_type: data.challenge_type ?? 'individual',
    max_participants: data.max_participants ?? null,
    invite_code: null,
    category: data.category,
    duration_days: data.duration_days,
    prize: data.prize ?? null,
    icon_name: data.icon_name ?? 'trophy',
    theme_colors: data.theme_colors ?? ['#6B1D2F', '#F7F4EF'],
    cover_image_url: data.cover_image_url ?? null,
    share_code: `FLM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    is_featured: false,
    metadata: data.metadata ?? {},
    habits: (data.habits ?? []).map((h: any) => ({
      label: h.label,
      icon_name: h.icon_name,
      color: h.color,
      kind: h.kind,
      unit: h.unit,
      target: h.target,
      metadata: h.metadata ?? {},
    })),
    workouts: (data.workouts ?? []).map((w: any) => ({
      title: w.title,
      duration_minutes: w.duration_minutes,
      focus: w.focus,
      days: (w.workout_days ?? []).map((d: any) => d.day_of_week),
      metadata: w.metadata ?? {},
      exercises: (w.exercises ?? []).sort(sortByOrder).map((e: any) => ({
        name: e.name,
        muscle: e.muscle,
        rest_seconds: e.rest_seconds,
        metadata: e.metadata ?? {},
        sets: (e.exercise_sets ?? []).sort(sortByOrder).map((s: any) => ({
          reps: String(s.reps ?? ''),
          weight: String(s.weight ?? ''),
        })),
      })),
    })),
    diets: (data.diets ?? []).map((d: any) => ({
      title: d.title,
      metadata: d.metadata ?? {},
      meals: (d.meals ?? []).sort(sortByOrder).map((m: any) => ({
        name: m.name,
        time: m.time,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        metadata: m.metadata ?? {},
        items: (m.meal_items ?? []).sort(sortByOrder).map((it: any) => ({
          name: it.name,
          quantity: it.quantity,
        })),
      })),
    })),
  };

  const { error: rpcError } = await sb.rpc('save_challenge_package', { p_payload: payload });
  if (rpcError) return { ok: false, error: rpcError.message };
  return { ok: true };
}
