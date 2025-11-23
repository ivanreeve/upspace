'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FiHome, FiSearch, FiUser } from 'react-icons/fi';

import { CardsGrid, SkeletonGrid } from './Marketplace.Cards';
import { MarketplaceErrorState } from './Marketplace.ErrorState';

import { listSpaces } from '@/lib/api/spaces';
import { useSession } from '@/components/auth/SessionProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import BackToTopButton from '@/components/ui/back-to-top';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from '@/components/ui/sidebar';

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
  const { session, } = useSession();

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

  const avatarUrl = session?.user?.user_metadata?.avatar_url
    ?? session?.user?.user_metadata?.picture
    ?? null;
  const avatarFallback =
    session?.user?.user_metadata?.full_name?.slice(0, 2)?.toUpperCase()
    ?? session?.user?.email?.slice(0, 2)?.toUpperCase()
    ?? 'US';

  return (
    <SidebarProvider className="bg-background">
      <div className="flex">
        <Sidebar className="hidden md:block">
          <SidebarHeader className="pt-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Home">
                  <Link href="/">
                    <FiHome className="size-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Search">
                  <Link href="/marketplace">
                    <FiSearch className="size-4" />
                    <span>Search</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Profile</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Account">
                      <Link href="/onboarding">
                        <Avatar className="size-8">
                          { avatarUrl ? (
                            <AvatarImage src={ avatarUrl } alt="User avatar" />
                          ) : (
                            <AvatarFallback>{ avatarFallback }</AvatarFallback>
                          ) }
                        </Avatar>
                        <span>Account</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="bg-background w-full pb-28 md:pb-10">
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
        </SidebarInset>
      </div>

      <MobileBottomBar
        avatarUrl={ avatarUrl }
        avatarFallback={ avatarFallback }
      />
    </SidebarProvider>
  );
}

function MobileBottomBar({
  avatarUrl,
  avatarFallback,
}: {
  avatarUrl: string | null
  avatarFallback: string
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-md shadow-lg md:hidden">
      <div className="mx-auto flex max-w-[480px] items-center justify-around px-6 py-3">
        <Link
          href="/"
          className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Home"
        >
          <FiHome className="size-5" aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link
          href="/marketplace"
          className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Search"
        >
          <FiSearch className="size-5" aria-hidden="true" />
          <span>Search</span>
        </Link>
        <Link
          href="/onboarding"
          className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Account"
        >
          <Avatar className="size-8">
            { avatarUrl ? (
              <AvatarImage src={ avatarUrl } alt="User avatar" />
            ) : (
              <AvatarFallback>{ avatarFallback }</AvatarFallback>
            ) }
          </Avatar>
          <span>Account</span>
        </Link>
      </div>
    </nav>
  );
}
