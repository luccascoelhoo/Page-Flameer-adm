import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSupabaseQuery<T>(
  key: any[],
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options?: any
) {
  return useQuery<T, any, T>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await queryFn();
      if (error) throw error;
      return data as T;
    },
    ...options
  });
}

export function useSupabaseMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<{ data: TData | null; error: any }>,
  options?: {
    onSuccess?: (data: TData | null, variables: TVariables) => void;
    onError?: (error: any) => void;
    invalidateKeys?: any[][];
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const { data, error } = await mutationFn(variables);
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      if (options?.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    onError: (error) => {
      if (options?.onError) {
        options.onError(error);
      }
    }
  });
}
