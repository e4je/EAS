import { useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { parseApiResponse } from '@/lib/api';

export function useApi<T>(key: QueryKey, url: string) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(url);
      return parseApiResponse<T>(res);
    },
  });
}
