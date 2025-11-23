'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiSearch } from 'react-icons/fi';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import { MarketplaceErrorState } from './Marketplace.ErrorState';

import { listSpaces } from '@/lib/api/spaces';
import BackToTopButton from '@/components/ui/back-to-top';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FiltersState = {
  q: string;
};

const DEFAULT_FILTERS: FiltersState = { q: '', };

const buildQueryParams = (filters: FiltersState) => ({
  limit: 24,
  q: filters.q.trim() || undefined,
  include_pending: true,
});

export default function Marketplace() {
  const [filters, setFilters] = React.useState<FiltersState>(DEFAULT_FILTERS);
  const [searchValue, setSearchValue] = React.useState('');

  React.useEffect(() => {
    setSearchValue(filters.q);
  }, [filters]);

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['marketplace-spaces', filters],
    queryFn: async () => listSpaces(buildQueryParams(filters)),
    keepPreviousData: true,
  });

  const spaces = React.useMemo(() => data?.data ?? [], [data]);
  const hasError = Boolean(error);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((prev) => ({
      ...prev,
      q: searchValue.trim(),
    }));
  };

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="space-y-6">
        <form
          onSubmit={ handleSearchSubmit }
          className="flex w-full flex-1 flex-col gap-3 rounded-md shadow-sm md:flex-row md:items-center"
        >
          <div className="flex w-full flex-col gap-3 rounded-xl border bg-background p-3 shadow-sm sm:flex-row sm:items-center sm:p-2">
            <div className="flex flex-1 items-center gap-3 rounded-lg bg-transparent sm:rounded-none">
              <FiSearch aria-hidden="true" className="size-5 text-muted-foreground" />
              <Input
                value={ searchValue }
                onChange={ (event) => setSearchValue(event.target.value) }
                placeholder="Search by space name, neighborhood, or keyword"
                aria-label="Search spaces"
                className="border-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              Search marketplace
            </Button>
          </div>
        </form>

        { hasError ? (
          <div className="flex min-h-[70vh] w-full items-center justify-center px-4">
            <MarketplaceErrorState />
          </div>
        ) : (
          <div className="space-y-3">
            { isLoading ? (
              <SkeletonGrid />
            ) : (
              <CardsGrid items={ spaces } />
            ) }
            { isFetching && !isLoading && (
              <p className="text-xs text-muted-foreground">Refreshing latest availability…</p>
            ) }
          </div>
        ) }
      </div>

      <BackToTopButton />
    </section>
  );
}
