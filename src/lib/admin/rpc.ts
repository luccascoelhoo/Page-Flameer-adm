import { supabase } from '@/integrations/supabase/client';

/**
 * Attempt a Supabase RPC and transparently signal "not installed yet" so
 * callers can fall back to client-side aggregation. This lets the Intelligence
 * Center work the moment it ships, and automatically get faster once the
 * analytics migrations (supabase/migrations) are applied.
 */
export async function tryRpc<T = any>(
  fn: string,
  params?: Record<string, unknown>
): Promise<{ data: T | null; missing: boolean; error: any }> {
  const { data, error } = await (supabase as any).rpc(fn, params ?? {});
  if (error) {
    // 42883 = undefined_function, PGRST202 = no matching function in schema cache
    const missing =
      error.code === '42883' ||
      error.code === 'PGRST202' ||
      /does not exist|could not find|not found/i.test(error.message ?? '');
    return { data: null, missing, error: missing ? null : error };
  }
  return { data: data as T, missing: false, error: null };
}
