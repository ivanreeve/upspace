import { useInfiniteQuery } from '@tanstack/react-query';

import { listSpaces, type ListSpacesParams } from '@/lib/api/spaces';

export const spacesQueryKey = (params: ListSpacesParams = {}) => ['spaces', params] as const;

export function useSpaces(params: ListSpacesParams = {}) {
  return useInfiniteQuery({
    queryKey: spacesQueryKey(params),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: ({
 pageParam = null, signal, 
}) => {
      const cursor = pageParam ?? null;
      const requestParams: ListSpacesParams = {
        ...params,
        cursor,
      };
      const options = signal ? { signal, } : undefined;
      return listSpaces(requestParams, options);
    },
  });
}
