import { useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

export function useApi<T>(key: QueryKey, url: string) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
  });
}
