import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';

import { listSpaces, type ListSpacesParams } from '@/lib/api/spaces';

export const spacesQueryKey = (params: ListSpacesParams = {}) => ['spaces', params] as const;

export const spacesQueryOptions = (params: ListSpacesParams = {}) =>
  queryOptions({
    queryKey: spacesQueryKey(params),
    queryFn: ({ signal, }) => {
      const options = signal ? { signal, } : undefined;
      return listSpaces(params, options);
    },
    placeholderData: keepPreviousData,
  });

export function useSpaces(params: ListSpacesParams = {}) {
  return useQuery(spacesQueryOptions(params));
}
